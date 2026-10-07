import AppKit
import ApplicationServices

// Small native helper that drives the KakaoTalk Mac window through the Accessibility API.
// Usage:  kakao-ax send --chat NAME [--dry-run]      message text is read from stdin
//         kakao-ax inspect                           prints window roles and ids, never any message text
// Every run prints exactly one JSON line. Exit code is 0 unless the process itself crashes.
//
// Design rules:
//  - elements are held as live references, never addressed by index, so closing a window cannot shift them
//  - windows that were open before the run are never closed; only a window this run opened is closed
//  - every step waits for its condition instead of sleeping a fixed time
//  - a chat row and the opened window must match the chat name exactly, otherwise nothing is typed

let bundleId = "com.kakao.KakaoTalkMac"
let mainWindowId = "Main Window"
let chatTabId = "chatrooms"
let returnKey: CGKeyCode = 36
// --no-foreground forbids activating KakaoTalk at all; the run then fails instead of taking focus
let foregroundAllowed = !CommandLine.arguments.contains("--no-foreground")
// other chat windows are closed first unless --keep-other-windows is given
let closeOthers = !CommandLine.arguments.contains("--keep-other-windows")
// --fresh also closes an empty window of the target chat, so the run exercises the open step (used for testing)
let freshRun = CommandLine.arguments.contains("--fresh")

func emit(_ object: [String: Any]) {
	guard let data = try? JSONSerialization.data(withJSONObject: object),
		let text = String(data: data, encoding: .utf8) else { return }
	print(text)
}

// The app in front when the run started. KakaoTalk has to be active while a chat is opened because the
// open step is a key press, so focus is handed back to this app as soon as the run ends.
var previousApp: NSRunningApplication? = NSWorkspace.shared.frontmostApplication

func restoreFocus() {
	guard let previous = previousApp, previous.bundleIdentifier != bundleId, !previous.isTerminated else { return }
	previous.activate(options: [])
}

func fail(_ code: String, _ detail: String = "") -> Never {
	restoreFocus()
	emit(["ok": false, "code": code, "detail": detail])
	exit(0)
}

func succeed(_ object: [String: Any]) {
	restoreFocus()
	emit(object)
}

// MARK: - Accessibility helpers

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
	var value: CFTypeRef?
	guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
	return value
}

func children(_ element: AXUIElement) -> [AXUIElement] {
	(attribute(element, "AXChildren") as? [AXUIElement]) ?? []
}

func text(_ element: AXUIElement, _ name: String) -> String? {
	attribute(element, name) as? String
}

func role(_ element: AXUIElement) -> String? { text(element, "AXRole") }
func identifier(_ element: AXUIElement) -> String? { text(element, "AXIdentifier") }
func title(_ element: AXUIElement) -> String? { text(element, "AXTitle") }

func press(_ element: AXUIElement) {
	_ = AXUIElementPerformAction(element, "AXPress" as CFString)
}

func windows(of app: AXUIElement) -> [AXUIElement] {
	(attribute(app, "AXWindows") as? [AXUIElement]) ?? []
}

func contains(_ list: [AXUIElement], _ element: AXUIElement) -> Bool {
	list.contains { CFEqual($0, element) }
}

func waitUntil(_ seconds: Double, step: Double = 0.2, _ condition: () -> Bool) -> Bool {
	let deadline = Date().addingTimeInterval(seconds)
	while true {
		if condition() { return true }
		if Date() >= deadline { return false }
		Thread.sleep(forTimeInterval: step)
	}
}

// A key press goes to whichever window is key, so it must never be sent before the intended window is the focused one.
// Raising a window of an app that is already active does not take focus from other apps.
func focusWindow(_ app: AXUIElement, _ window: AXUIElement) -> Bool {
	func isFocused() -> Bool {
		guard let focused = attribute(app, "AXFocusedWindow") else { return false }
		return CFEqual(focused, window)
	}
	if isFocused() { return true }
	_ = AXUIElementPerformAction(window, "AXRaise" as CFString)
	_ = AXUIElementSetAttributeValue(app, "AXFocusedWindow" as CFString, window)
	return waitUntil(2) { isFocused() }
}

func pressReturn(pid: pid_t) {
	for down in [true, false] {
		CGEvent(keyboardEventSource: nil, virtualKey: returnKey, keyDown: down)?.postToPid(pid)
	}
}

// MARK: - App and window discovery

func runningApp() -> NSRunningApplication? {
	NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
}

func openApp() {
	let process = Process()
	process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
	process.arguments = ["-b", bundleId]
	try? process.run()
	process.waitUntilExit()
}

func findMainWindow(_ app: AXUIElement) -> AXUIElement? {
	windows(of: app).first { identifier($0) == mainWindowId }
}

// The main window disappears when it was closed instead of hidden. Reopening the app asks it to show it again.
func ensureMainWindow(_ app: AXUIElement) -> AXUIElement {
	// the common case needs no activation at all, so the user's focus is left alone
	if let window = findMainWindow(app) { return window }
	// windows on another display or Space are invisible to the Accessibility API until the app is brought forward
	runningApp()?.activate(options: [.activateAllWindows])
	var seen: AXUIElement?
	_ = waitUntil(3) {
		seen = findMainWindow(app)
		return seen != nil
	}
	if let window = seen { return window }
	// the main window disappears when it was closed instead of hidden; reopening the app asks it to show it again
	openApp()
	var found: AXUIElement?
	_ = waitUntil(6) {
		found = findMainWindow(app)
		return found != nil
	}
	guard let window = found else { fail("MAIN_WINDOW_MISSING") }
	return window
}

func chatTable(in window: AXUIElement) -> AXUIElement? {
	for area in children(window) where role(area) == "AXScrollArea" {
		for item in children(area) where role(item) == "AXTable" { return item }
	}
	return nil
}

func labels(in element: AXUIElement, depth: Int = 3) -> [String] {
	var found: [String] = []
	if role(element) == "AXStaticText", let value = text(element, "AXValue") { found.append(value) }
	if depth > 0 { for child in children(element) { found += labels(in: child, depth: depth - 1) } }
	return found
}

func sendButton(in window: AXUIElement) -> AXUIElement? {
	let titles: Set<String> = ["Send", "전송", "Отправить"]
	return children(window).first { role($0) == "AXButton" && titles.contains(title($0) ?? "") }
}

func chatInput(in window: AXUIElement) -> AXUIElement? {
	for area in children(window) where role(area) == "AXScrollArea" {
		let parts = children(area)
		if parts.contains(where: { role($0) == "AXTable" }) { continue }
		if let field = parts.first(where: { role($0) == "AXTextArea" }) { return field }
	}
	return nil
}

// MARK: - Commands

func closeWindow(_ window: AXUIElement) {
	var closeButton: CFTypeRef?
	if AXUIElementCopyAttributeValue(window, "AXCloseButton" as CFString, &closeButton) == .success, let button = closeButton {
		press(button as! AXUIElement)
	}
}

func hasMessageList(_ window: AXUIElement) -> Bool {
	children(window).contains { area in
		role(area) == "AXScrollArea" && children(area).contains { role($0) == "AXTable" }
	}
}

// Another chat window can hold the key focus and swallow key presses, so other chat windows are closed first.
// A chat window is one with a message list; windows without one, such as the calendar, are left alone.
// Unsent text in a message input is cleared before the window is closed (the user asked for this). A window whose
// input could not be cleared stays open, so nothing is closed while it still looks like it holds a draft.
func closeOtherChatWindows(_ app: AXUIElement, keeping chat: String) -> (closed: Int, clearedDrafts: Int) {
	guard closeOthers else { return (0, 0) }
	var closed: [AXUIElement] = []
	var cleared = 0
	for window in windows(of: app) where identifier(window) != mainWindowId && (freshRun || title(window) != chat) {
		guard hasMessageList(window) else { continue }
		if let field = chatInput(in: window), !(text(field, "AXValue") ?? "").isEmpty {
			_ = AXUIElementSetAttributeValue(field, "AXValue" as CFString, "" as CFString)
			guard (text(field, "AXValue") ?? "x").isEmpty else { continue }
			cleared += 1
		}
		closeWindow(window)
		closed.append(window)
	}
	_ = waitUntil(2) { !windows(of: app).contains { window in contains(closed, window) } }
	return (closed.count, cleared)
}

func inspect(_ app: AXUIElement) {
	var rows: [[String: Any]] = []
	for window in windows(of: app) {
		let kinds = children(window).map { role($0) ?? "?" }
		rows.append(["id": identifier(window) ?? "", "title": title(window) ?? "", "children": kinds.count, "hasTable": kinds.contains("AXScrollArea")])
	}
	emit(["ok": true, "windows": rows])
}

// An open, verified chat window: the title matched the chat name exactly and the message input was found.
struct ChatSession {
	let window: AXUIElement
	let input: AXUIElement
	let openedByUs: Bool
	let closed: Int
	let clearedDrafts: Int

	// only a window this run opened is closed; one the user already had open stays
	func closeIfOurs() {
		if openedByUs { closeWindow(window) }
	}
}

func openChat(_ app: AXUIElement, pid: pid_t, chat: String) -> ChatSession {
	let main = ensureMainWindow(app)
	let tidy = closeOtherChatWindows(app, keeping: chat)
	let before = windows(of: app)

	// a chat window the user already has open for this chat is reused and left open
	var chatWindow = before.first { identifier($0) != mainWindowId && title($0) == chat }
	var openedByUs = false

	if chatWindow == nil {
		for tab in children(main) where identifier(tab) == chatTabId { press(tab) }
		var table: AXUIElement?
		_ = waitUntil(4) {
			table = chatTable(in: main)
			return table != nil
		}
		guard let list = table else { fail("CHAT_LIST_NOT_FOUND") }

		let rows = children(list).filter { role($0) == "AXRow" && labels(in: $0).contains(chat) }
		if rows.isEmpty { fail("CHAT_NOT_FOUND") }
		if rows.count > 1 { fail("CHAT_AMBIGUOUS") }

		guard AXUIElementSetAttributeValue(list, "AXSelectedRows" as CFString, [rows[0]] as CFArray) == .success else {
			fail("CHAT_WINDOW_NOT_OPENED", "row selection was refused")
		}
		func fireOpen() -> Bool {
			// another chat window may be the key window; Return would then land in its input box
			guard focusWindow(app, main) else { return false }
			_ = AXUIElementSetAttributeValue(list, "AXFocused" as CFString, kCFBooleanTrue)
			Thread.sleep(forTimeInterval: 0.2)
			pressReturn(pid: pid)
			return true
		}
		func waitForChatWindow(_ seconds: Double) {
			_ = waitUntil(seconds) {
				chatWindow = windows(of: app).first { !contains(before, $0) && identifier($0) != mainWindowId }
				return chatWindow != nil
			}
		}

		// first try without activating KakaoTalk, so the user's focus is never touched
		if fireOpen() { waitForChatWindow(2.5) }
		if chatWindow == nil && foregroundAllowed {
			// `open` goes through LaunchServices like a Dock click, which macOS honours for a background process
			openApp()
			_ = waitUntil(3) { runningApp()?.isActive ?? false }
			if fireOpen() { waitForChatWindow(6) }
		}
		guard chatWindow != nil else { fail("CHAT_WINDOW_NOT_OPENED") }
		openedByUs = true
	}

	let window = chatWindow!
	func closeIfOurs() {
		if openedByUs { closeWindow(window) }
	}

	if title(window) != chat {
		closeIfOurs()
		fail("WINDOW_MISMATCH")
	}

	var input: AXUIElement?
	_ = waitUntil(4) {
		input = chatInput(in: window)
		return input != nil
	}
	guard let field = input else {
		closeIfOurs()
		fail("INPUT_NOT_FOUND")
	}
	return ChatSession(window: window, input: field, openedByUs: openedByUs, closed: tidy.closed, clearedDrafts: tidy.clearedDrafts)
}

func send(_ app: AXUIElement, pid: pid_t, chat: String, dryRun: Bool, message: String) {
	let session = openChat(app, pid: pid, chat: chat)
	let window = session.window
	let field = session.input
	let openedByUs = session.openedByUs
	let tidy = (closed: session.closed, clearedDrafts: session.clearedDrafts)
	func closeIfOurs() { session.closeIfOurs() }

	if dryRun {
		closeIfOurs()
		succeed(["ok": true, "dryRun": true, "reusedWindow": !openedByUs, "closedWindows": tidy.closed, "clearedDrafts": tidy.clearedDrafts])
		return
	}

	_ = AXUIElementSetAttributeValue(field, "AXFocused" as CFString, kCFBooleanTrue)
	guard AXUIElementSetAttributeValue(field, "AXValue" as CFString, message as CFString) == .success,
		text(field, "AXValue") == message else {
		closeIfOurs()
		fail("INPUT_NOT_FOUND", "the text could not be placed in the input")
	}

	// Pressing the Send button needs no focus, so the app can stay in the background.
	// Return is only the fallback, and it is sent only to a window that is confirmed as the focused one.
	var pressedSend = false
	if let button = sendButton(in: window), waitUntil(1.5, { (attribute(button, "AXEnabled") as? Bool) ?? false }) {
		press(button)
		pressedSend = true
	}
	if !pressedSend {
		guard foregroundAllowed else {
			closeIfOurs()
			fail("SEND_UNVERIFIED", "the Send button did not become available")
		}
		openApp()
		_ = waitUntil(3) { runningApp()?.isActive ?? false }
		guard focusWindow(app, window) else {
			closeIfOurs()
			fail("WINDOW_MISMATCH", "the chat window is not the focused window")
		}
		pressReturn(pid: pid)
	}

	// the input empties once the message left; anything else is reported instead of assumed
	let cleared = waitUntil(4) { (text(field, "AXValue") ?? "").isEmpty }
	closeIfOurs()
	if !cleared { fail("SEND_UNVERIFIED") }
	succeed(["ok": true, "sent": true, "method": pressedSend ? "send-button" : "return-key", "reusedWindow": !openedByUs, "closedWindows": tidy.closed, "clearedDrafts": tidy.clearedDrafts])
}

// MARK: - Entry point

guard AXIsProcessTrusted() else { fail("ACCESSIBILITY_DENIED") }

let arguments = Array(CommandLine.arguments.dropFirst())
guard let command = arguments.first else { fail("USAGE") }

if runningApp() == nil {
	openApp()
	_ = waitUntil(10) { runningApp() != nil }
}
guard let process = runningApp() else { fail("APP_NOT_RUNNING") }
let appElement = AXUIElementCreateApplication(process.processIdentifier)

switch command {
case "inspect":
	_ = ensureMainWindow(appElement)
	inspect(appElement)
case "send":
	guard let flag = arguments.firstIndex(of: "--chat"), flag + 1 < arguments.count else { fail("USAGE") }
	let chat = arguments[flag + 1]
	let message = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
	if message.isEmpty && !arguments.contains("--dry-run") { fail("USAGE", "empty text") }
	send(appElement, pid: process.processIdentifier, chat: chat, dryRun: arguments.contains("--dry-run"), message: message)
default:
	fail("USAGE")
}
