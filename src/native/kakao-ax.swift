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
// --no-foreground forbids activating KakaoTalk at all; the run then fails instead of taking focus.
// The Node side passes it unless KAKAOTALK_ALLOW_FOREGROUND is set.
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
	// Only undo a focus change this run caused: if KakaoTalk is not in front, the user has already moved on
	// and pulling them back to an older app would steal focus from where they are working now.
	guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier == bundleId else { return }
	guard let previous = previousApp, previous.bundleIdentifier != bundleId, !previous.isTerminated else { return }
	previous.activate(options: [])
}

// runs on every exit path, so a window this run opened is closed even when the run ends with an error
var cleanup: (() -> Void)?

func fail(_ code: String, _ detail: String = "") -> Never {
	cleanup?()
	cleanup = nil
	restoreFocus()
	emit(["ok": false, "code": code, "detail": detail])
	exit(0)
}

func succeed(_ object: [String: Any]) {
	cleanup?()
	cleanup = nil
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

// MARK: - Windows on other Spaces

// An app's AXWindows list only holds windows on the Space that is showing. The technique AltTab uses reaches the rest:
// an element for each possible id of the app is created from a remote token, and the ones that are windows are kept.
// _AXUIElementCreateWithRemoteToken is undocumented, so it is looked up at runtime and everything works without it.
// It needs the same Accessibility permission as the normal calls and changes nothing on the system.
typealias RemoteTokenCreate = @convention(c) (CFData) -> Unmanaged<AXUIElement>?
let remoteTokenCreate: RemoteTokenCreate? = {
	guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "_AXUIElementCreateWithRemoteToken") else { return nil }
	return unsafeBitCast(symbol, to: RemoteTokenCreate.self)
}()

// switched on by ensureMainWindow when the normal list does not show the main window
var remoteWindowSearch = false
// window element ids grow as the app creates elements, so the next scan reaches a bit past the highest id seen so far
var highestWindowElementId = 0

// CoreGraphics lists windows with titles and needs no special permission. It cannot control them, but it shows which windows
// are really on screen. A window that was closed lingers in this list under the same number (it is reused when the chat is
// opened again) without the on-screen flag, and one that is just closing is still on screen but fading; neither counts.
// What counts is a window that is on screen, fully opaque and titled: the tool must be able to see all of those, and a key
// press is never sent while one exists that it cannot see.
func windowTitlesFromWindowServer(pid: pid_t) -> [String] {
	let list = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] ?? []
	return list.compactMap { entry in
		guard (entry["kCGWindowOwnerPID"] as? Int32) == pid || (entry["kCGWindowOwnerPID"] as? Int) == Int(pid), (entry["kCGWindowLayer"] as? Int) == 0 else { return nil }
		guard ((entry["kCGWindowAlpha"] as? Double) ?? 1) >= 0.99 else { return nil }
		let bounds = entry["kCGWindowBounds"] as? [String: Any] ?? [:]
		guard ((bounds["Width"] as? Double) ?? 0) > 300, ((bounds["Height"] as? Double) ?? 0) > 300 else { return nil }
		let name = entry["kCGWindowName"] as? String ?? ""
		return name.isEmpty ? nil : name
	}
}

func remoteWindows(pid: pid_t) -> [AXUIElement] {
	guard let create = remoteTokenCreate else { return [] }
	var token = Data(count: 20)
	token.replaceSubrange(0..<4, with: withUnsafeBytes(of: pid) { Data($0) })
	token.replaceSubrange(4..<8, with: withUnsafeBytes(of: Int32(0)) { Data($0) })
	token.replaceSubrange(8..<12, with: withUnsafeBytes(of: Int32(0x636f636f)) { Data($0) })
	var found: [AXUIElement] = []
	let expected = windowTitlesFromWindowServer(pid: pid).count
	// element ids keep growing while the app runs, so a fixed range eventually misses new windows. The scan stops as soon as
	// every window that the window server reports has been found, and only goes far when some are still missing.
	let firstRange = max(12_000, highestWindowElementId + 6_000)
	// a real window was measured at id 3125 on a long running app; 40000 leaves a wide margin and costs about half a second
	let hardLimit = 40_000
	var id = 0
	while id < hardLimit {
		token.replaceSubrange(12..<20, with: withUnsafeBytes(of: UInt64(id)) { Data($0) })
		if let element = create(token as CFData)?.takeRetainedValue(), (attribute(element, "AXRole") as? String) == "AXWindow" {
			found.append(element)
			highestWindowElementId = max(highestWindowElementId, id)
		}
		id += 1
		if id >= firstRange && found.count >= expected { break }
	}
	return found
}

func windows(of app: AXUIElement) -> [AXUIElement] {
	var list = (attribute(app, "AXWindows") as? [AXUIElement]) ?? []
	guard remoteWindowSearch else { return list }
	var pid: pid_t = 0
	AXUIElementGetPid(app, &pid)
	for window in remoteWindows(pid: pid) where !list.contains(where: { CFEqual($0, window) }) { list.append(window) }
	return list
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
	// Measured on a real Mac: setting AXMain and AXFocusedWindow does not bring the app forward, while AXRaise does.
	// So these two are always set, even when the window already claims focus, because after one of our chat windows
	// was closed AXFocusedWindow can still name the main window without it being the key window.
	_ = AXUIElementSetAttributeValue(window, "AXMain" as CFString, kCFBooleanTrue)
	_ = AXUIElementSetAttributeValue(app, "AXFocusedWindow" as CFString, window)
	if isFocused() { return true }
	// raising is the only extra step that takes focus, so it is reserved for foreground mode
	guard foregroundAllowed else { return false }
	_ = AXUIElementPerformAction(window, "AXRaise" as CFString)
	return waitUntil(2) { isFocused() }
}

// Titles of windows the window server shows but the Accessibility search could not find.
func uncontrollableWindowTitles(app: AXUIElement, pid: pid_t) -> [String] {
	var remaining = windows(of: app).compactMap { title($0) }
	var missing: [String] = []
	for name in windowTitlesFromWindowServer(pid: pid) {
		if let index = remaining.firstIndex(of: name) { remaining.remove(at: index) } else { missing.append(name) }
	}
	return missing
}

func pressKey(pid: pid_t, key: CGKeyCode) {
	for down in [true, false] {
		CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: down)?.postToPid(pid)
	}
}

func pressReturn(pid: pid_t) {
	pressKey(pid: pid, key: returnKey)
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
	// the window list can be empty for a moment right after another window closed, so look again before giving up
	var settled: AXUIElement?
	_ = waitUntil(3) {
		settled = findMainWindow(app)
		return settled != nil
	}
	if let window = settled { return window }
	// the window may sit on another Space: reach it with the remote search, which never touches the user's focus
	remoteWindowSearch = true
	if let window = findMainWindow(app) { return window }
	remoteWindowSearch = false
	// in background mode the app is never brought forward: ask the user to show the window instead
	guard foregroundAllowed else { fail("MAIN_WINDOW_MISSING", "background mode: the main window was not found on any Space, it is probably closed") }
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
		var openNote = ""
		func fireOpen() -> Bool {
			// another chat window may be the key window; Return would then land in its input box
			guard focusWindow(app, main) else { return false }
			_ = AXUIElementSetAttributeValue(list, "AXFocused" as CFString, kCFBooleanTrue)
			Thread.sleep(forTimeInterval: 0.2)
			// a key press goes to whichever window is key; if a window exists that this tool cannot see, it might be that one
			// the window server lags a moment behind right after a window was closed, so the two views get time to agree
			var unseen: [String] = []
			_ = waitUntil(2.5, step: 0.3) {
				unseen = uncontrollableWindowTitles(app: app, pid: pid)
				return unseen.isEmpty
			}
			guard unseen.isEmpty else {
				openNote = "another KakaoTalk window cannot be inspected: \(unseen.joined(separator: ", "))"
				return false
			}
			pressReturn(pid: pid)
			return true
		}
		func waitForChatWindow(_ seconds: Double) {
			_ = waitUntil(seconds) {
				// The app names its focused window straight away, which stays cheap and correct even when the new window's
				// element id lies far beyond the range the window search covers (ids keep growing while the app runs).
				if let focused = attribute(app, "AXFocusedWindow"), CFGetTypeID(focused) == AXUIElementGetTypeID() {
					let candidate = focused as! AXUIElement
					if !CFEqual(candidate, main), identifier(candidate) != mainWindowId, !contains(before, candidate) {
						chatWindow = candidate
						return true
					}
				}
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
		guard chatWindow != nil else { fail("CHAT_WINDOW_NOT_OPENED", openNote.isEmpty ? "no new window appeared after Return" : openNote) }
		openedByUs = true
	}

	let window = chatWindow!
	func closeIfOurs() {
		if openedByUs { closeWindow(window) }
	}

	// a window that has just appeared may not carry its title yet, so the title gets a moment to settle before it is judged
	if !waitUntil(2, { title(window) == chat }) {
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
	if openedByUs { cleanup = { closeWindow(window) } }
	return ChatSession(window: window, input: field, openedByUs: openedByUs, closed: tidy.closed, clearedDrafts: tidy.clearedDrafts)
}

// Puts `message` into the open chat's input and sends it with the Send button (Return is only a foreground fallback).
// Ends the run with an error when the text cannot be placed or the send is not confirmed. Returns the method used.
func submit(_ app: AXUIElement, pid: pid_t, session: ChatSession, message: String) -> String {
	let window = session.window
	let field = session.input
	_ = AXUIElementSetAttributeValue(field, "AXFocused" as CFString, kCFBooleanTrue)
	guard AXUIElementSetAttributeValue(field, "AXValue" as CFString, message as CFString) == .success,
		text(field, "AXValue") == message else {
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
				fail("SEND_UNVERIFIED", "the Send button did not become available")
		}
		openApp()
		_ = waitUntil(3) { runningApp()?.isActive ?? false }
		guard focusWindow(app, window) else {
				fail("WINDOW_MISMATCH", "the chat window is not the focused window")
		}
		pressReturn(pid: pid)
	}

	// the input empties once the message left; anything else is reported instead of assumed
	let cleared = waitUntil(4) { (text(field, "AXValue") ?? "").isEmpty }
	if !cleared { fail("SEND_UNVERIFIED") }
	return pressedSend ? "send-button" : "return-key"
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

	let method = submit(app, pid: pid, session: session, message: message)
	closeIfOurs()
	succeed(["ok": true, "sent": true, "method": method, "reusedWindow": !openedByUs, "closedWindows": tidy.closed, "clearedDrafts": tidy.clearedDrafts])
}

// MARK: - Message menu probe (read only)

func messageTable(in window: AXUIElement) -> AXUIElement? {
	for area in children(window) where role(area) == "AXScrollArea" {
		for item in children(area) where role(item) == "AXTable" { return item }
	}
	return nil
}

func allLabels(in element: AXUIElement, depth: Int = 6) -> [String] {
	var found: [String] = []
	if role(element) == "AXStaticText", let value = text(element, "AXValue") { found.append(value) }
	if depth > 0 { for child in children(element) { found += allLabels(in: child, depth: depth - 1) } }
	return found
}

func actionNames(_ element: AXUIElement) -> [String] {
	var names: CFArray?
	return AXUIElementCopyActionNames(element, &names) == .success ? (names as? [String] ?? []) : []
}

func descendants(_ element: AXUIElement, depth: Int) -> [AXUIElement] {
	guard depth > 0 else { return [] }
	return children(element).flatMap { [$0] + descendants($0, depth: depth - 1) }
}

// Opens a message's context menu and returns it only when it really is that menu: it must hold one of the expected
// items, so the system menu bar can never be mistaken for it. Waits for the menu instead of sleeping.
func openContextMenu(app: AXUIElement, window: AXUIElement, cell: AXUIElement, expecting items: Set<String>) -> AXUIElement? {
	_ = AXUIElementPerformAction(cell, "AXShowMenu" as CFString)
	var found: AXUIElement?
	_ = waitUntil(2.5) {
		for root in [cell, window, app] {
			found = ([root] + descendants(root, depth: 8)).first { candidate in
				role(candidate) == "AXMenu" && children(candidate).contains { role($0) == "AXMenuItem" && items.contains(title($0) ?? "") }
			}
			if found != nil { return true }
		}
		return false
	}
	return found
}

// Prints the structure of the row that holds an exact message text and the titles of its context menu. Never clicks an item.
func probeMenu(_ app: AXUIElement, pid: pid_t, chat: String, match: String, press item: String?) {
	let session = openChat(app, pid: pid, chat: chat)
	defer { session.closeIfOurs() }
	guard let table = messageTable(in: session.window) else { fail("INPUT_NOT_FOUND", "no message table") }
	let rows = children(table).filter { role($0) == "AXRow" }
	guard let row = rows.last(where: { candidate in ([candidate] + descendants(candidate, depth: 6)).contains { item in ["AXValue", "AXDescription", "AXTitle"].contains { (text(item, $0) ?? "").contains(match) } } }) else { fail("CHAT_NOT_FOUND", "message not visible, rows: \(rows.count)") }
	var report: [String: Any] = ["rows": rows.count, "rowActions": actionNames(row)]
	var holders: [String] = []
	for item in [row] + descendants(row, depth: 6) {
		for name in ["AXValue", "AXDescription", "AXTitle"] {
			if let value = text(item, name), value.contains(match) { holders.append("\(role(item) ?? "?").\(name)") }
		}
	}
	report["textHeldBy"] = holders
	var cells: [[String: Any]] = []
	for cell in children(row) {
		cells.append(["role": role(cell) ?? "?", "actions": actionNames(cell), "kids": children(cell).map { role($0) ?? "?" }])
	}
	report["cells"] = cells
	// the context menu belongs to the row's cell
	let candidates = [row] + descendants(row, depth: 4)
	if let target = candidates.first(where: { actionNames($0).contains("AXShowMenu") }) {
		let menu = openContextMenu(app: app, window: session.window, cell: target, expecting: ["Copy", "Reply", "Delete for Everyone", "Delete only for me"])
		if let menu = menu {
			report["menuItems"] = children(menu).compactMap { role($0) == "AXMenuItem" ? (title($0) ?? "") : nil }
			if let name = item, let entry = children(menu).first(where: { role($0) == "AXMenuItem" && title($0) == name }) {
				let beforeWindows = windows(of: app)
				let beforeTree = descendants(session.window, depth: 10)
				press(entry)
				Thread.sleep(forTimeInterval: 1.0)
				var found: [[String: String]] = []
				let afterWindows = windows(of: app).filter { !contains(beforeWindows, $0) }
				let fresh = descendants(session.window, depth: 10).filter { !contains(beforeTree, $0) } + afterWindows.flatMap { [$0] + descendants($0, depth: 10) }
				let interesting: Set<String> = ["AXButton", "AXMenuItem", "AXCheckBox", "AXRadioButton", "AXPopUpButton", "AXSheet", "AXPopover", "AXDialog", "AXMenu", "AXWindow", "AXMenuButton", "AXImage"]
				for element in fresh where interesting.contains(role(element) ?? "") {
					let named = !(title(element) ?? "").isEmpty || !(text(element, "AXDescription") ?? "").isEmpty
					if ["AXButton", "AXImage"].contains(role(element) ?? "") && (!named || text(element, "AXDescription") == "Profile") { continue }
					found.append(["role": role(element) ?? "?", "title": title(element) ?? "", "desc": text(element, "AXDescription") ?? "", "id": identifier(element) ?? ""])
				}
				// the emoji buttons carry no name, so list every readable attribute of the first few to find what identifies them
				var emojiDetails: [[String: String]] = []
				for element in fresh where role(element) == "AXButton" && text(element, "AXDescription") == "emoji" {
					if emojiDetails.count >= 6 { break }
					var names: CFArray?
					_ = AXUIElementCopyAttributeNames(element, &names)
					var detail: [String: String] = [:]
					for name in (names as? [String]) ?? [] {
						if let value = attribute(element, name) {
							if let str = value as? String { detail[name] = String(str.prefix(40)) }
							else if let list = value as? [AXUIElement] { detail[name] = "children:\(list.count) " + list.map { role($0) ?? "?" }.joined(separator: ",") }
						}
					}
					for kid in children(element) {
						for name in ["AXDescription", "AXValue", "AXTitle", "AXHelp"] {
							if let str = text(kid, name), !str.isEmpty { detail["child.\(role(kid) ?? "?").\(name)"] = String(str.prefix(40)) }
						}
					}
					emojiDetails.append(detail)
				}
				let emojiCount = fresh.filter { role($0) == "AXButton" && text($0, "AXDescription") == "emoji" }.count
				// selection mode (delete only for me): which tick boxes exist and which are ticked
				let boxes = descendants(session.window, depth: 12).filter { role($0) == "AXCheckBox" }
				func ticked(_ box: AXUIElement) -> Bool { (attribute(box, "AXValue") as? NSNumber)?.intValue == 1 }
				let rowBoxes = ([row] + descendants(row, depth: 8)).filter { role($0) == "AXCheckBox" }
				report["selection"] = ["boxes": boxes.count, "ticked": boxes.filter(ticked).count, "targetRowBoxes": rowBoxes.count, "targetRowTicked": rowBoxes.filter(ticked).count]
				// edit / reply mode: is the input pre-filled with the message, and what do the window's own buttons say
				var windowButtons: [[String: Any]] = []
				for button in children(session.window) where role(button) == "AXButton" {
					let name = title(button) ?? ""
					if name.isEmpty { continue }
					windowButtons.append(["title": name, "enabled": (attribute(button, "AXEnabled") as? Bool) ?? false])
				}
				report["windowButtons"] = windowButtons
				report["inputPrefilledWithMessage"] = (text(session.input, "AXValue") ?? "") == match
				report["inputLength"] = (text(session.input, "AXValue") ?? "").count
				report["afterPress"] = ["newWindows": afterWindows.count, "emojiButtons": emojiCount, "emojiDetails": emojiDetails, "otherControls": found.filter { $0["desc"] != "emoji" }]
				// back out without confirming anything; selection mode has its own Cancel button
				if let cancel = descendants(session.window, depth: 12).first(where: { role($0) == "AXButton" && title($0) == "Cancel" }) { press(cancel) }
				for window in afterWindows { closeWindow(window) }
				_ = AXUIElementPerformAction(session.window, "AXCancel" as CFString)
				for element in fresh where ["AXSheet", "AXPopover", "AXDialog", "AXMenu"].contains(role(element) ?? "") {
					_ = AXUIElementPerformAction(element, "AXCancel" as CFString)
				}
				if focusWindow(app, session.window) { pressKey(pid: pid, key: 53) }
			} else {
				_ = AXUIElementPerformAction(menu, "AXCancel" as CFString)
			}
		} else {
			report["menuItems"] = "no menu element found"
		}
	} else {
		report["menuItems"] = "no element offers AXShowMenu"
	}
	succeed(["ok": true, "probe": report])
}

// MARK: - Message actions (delete, reply, react)

let menuTitles: [String: String] = [
	"delete-everyone": "Delete for Everyone",
	"delete-me": "Delete only for me",
	"reply": "Reply",
	"react": "Reactions",
	"edit": "Edit",
]

func exactTexts(in element: AXUIElement) -> [String] {
	([element] + descendants(element, depth: 6)).compactMap { item in
		["AXTextArea", "AXStaticText"].contains(role(item) ?? "") ? text(item, "AXValue") : nil
	}
}

func emojiButtons(app: AXUIElement, window: AXUIElement) -> [AXUIElement] {
	for root in [window, app] {
		for popover in ([root] + descendants(root, depth: 8)).filter({ role($0) == "AXPopover" }) {
			let buttons = descendants(popover, depth: 8).filter { role($0) == "AXButton" && text($0, "AXDescription") == "emoji" }
			if !buttons.isEmpty { return buttons }
		}
	}
	return []
}

func frame(of element: AXUIElement) -> CGRect? {
	if let value = attribute(element, "AXFrame"), CFGetTypeID(value) == AXValueGetTypeID() {
		var rect = CGRect.zero
		if AXValueGetValue(value as! AXValue, .cgRect, &rect), rect.height > 0 { return rect }
	}
	guard let positionValue = attribute(element, "AXPosition"), let sizeValue = attribute(element, "AXSize"),
		CFGetTypeID(positionValue) == AXValueGetTypeID(), CFGetTypeID(sizeValue) == AXValueGetTypeID() else { return nil }
	var point = CGPoint.zero
	var size = CGSize.zero
	guard AXValueGetValue(positionValue as! AXValue, .cgPoint, &point), AXValueGetValue(sizeValue as! AXValue, .cgSize, &size) else { return nil }
	return CGRect(origin: point, size: size)
}

// the first of the message's own elements that reports a position: the row, then its cell and text
func messageFrame(row: AXUIElement) -> CGRect? {
	([row] + descendants(row, depth: 6)).lazy.compactMap { frame(of: $0) }.first
}

func isTicked(_ box: AXUIElement) -> Bool { (attribute(box, "AXValue") as? NSNumber)?.intValue == 1 }

// "Delete only for me" turns the chat into a selection mode: a tick box next to every message plus OK and Cancel.
// The tick boxes are not inside the message row, so the one for the target is found by where it sits on screen.
// Nothing is confirmed unless exactly the target's box is ticked; any doubt cancels the selection instead.
func deleteOnlyForMe(window: AXUIElement, locateRow: () -> AXUIElement?) -> String {
	func button(_ name: String) -> AXUIElement? {
		descendants(window, depth: 12).first { role($0) == "AXButton" && title($0) == name }
	}
	var ok: AXUIElement?
	_ = waitUntil(3) {
		ok = button("OK")
		return ok != nil
	}
	guard let okButton = ok else { fail("MENU_NOT_FOUND", "the selection mode did not open") }
	func abort(_ detail: String) -> Never {
		if let cancel = button("Cancel") { press(cancel) }
		fail("MENU_NOT_FOUND", detail)
	}
	// the list is rebuilt when selection mode starts, so the message row is looked up again instead of reusing the old one
	var freshRow: AXUIElement?
	_ = waitUntil(2) {
		freshRow = locateRow()
		return freshRow != nil
	}
	guard let row = freshRow else { abort("the message row is gone after selection mode started") }
	let boxes = descendants(window, depth: 12).filter { role($0) == "AXCheckBox" }
	var matching = ([row] + descendants(row, depth: 8)).filter { role($0) == "AXCheckBox" }
	if matching.count != 1, let rowFrame = messageFrame(row: row) {
		matching = boxes.filter { box in frame(of: box).map { rowFrame.minY - 2 <= $0.midY && $0.midY <= rowFrame.maxY + 2 } ?? false }
	}
	guard matching.count == 1, let target = matching.first else { abort("expected one tick box for the message, found \(matching.count)") }
	if !isTicked(target) { press(target) }
	guard waitUntil(1.5, { isTicked(target) }) else { abort("the message could not be ticked") }
	guard boxes.filter(isTicked).count == 1 else { abort("more than the target message is ticked") }

	let before = descendants(window, depth: 12)
	press(okButton)
	Thread.sleep(forTimeInterval: 0.8)
	// a confirmation may follow; only a NEW button with an exact confirming title is pressed
	let confirmTitles: Set<String> = ["Delete", "Confirm", "Yes"]
	let fresh = descendants(window, depth: 12).filter { !contains(before, $0) && role($0) == "AXButton" && confirmTitles.contains(title($0) ?? "") }
	if let confirm = fresh.first {
		press(confirm)
		Thread.sleep(forTimeInterval: 0.8)
		return "confirmed:\(title(confirm) ?? "")"
	}
	return "no-confirmation"
}

// The button that saves an edit. It is looked up by its exact title among the window's own buttons; if none is found
// the edit is abandoned, so nothing is guessed. Send is accepted because some versions reuse it in edit mode.
func saveEditButton(in window: AXUIElement) -> AXUIElement? {
	let titles: Set<String> = ["Send", "전송", "Save", "저장", "Edit", "수정", "Done", "완료", "Update"]
	return children(window).first { role($0) == "AXButton" && titles.contains(title($0) ?? "") }
}

// Edit mode pre-fills the input with the current text. It is only used when that really is the case, then the text is replaced.
func editMessage(window: AXUIElement, input: AXUIElement, original: String, newText: String) -> String {
	func closeEditMode() {
		if let close = descendants(window, depth: 8).first(where: { role($0) == "AXButton" && text($0, "AXDescription") == "Close" }) { press(close) }
		_ = AXUIElementSetAttributeValue(input, "AXValue" as CFString, "" as CFString)
	}
	let prefilled = waitUntil(3) { (text(input, "AXValue") ?? "") == original }
	guard prefilled else {
		closeEditMode()
		fail("INPUT_NOT_FOUND", "edit mode did not pre-fill the message text")
	}
	guard AXUIElementSetAttributeValue(input, "AXValue" as CFString, newText as CFString) == .success, text(input, "AXValue") == newText else {
		closeEditMode()
		fail("INPUT_NOT_FOUND", "the new text could not be placed in the input")
	}
	var saved: AXUIElement?
	_ = waitUntil(2) {
		saved = saveEditButton(in: window)
		return saved != nil && ((attribute(saved!, "AXEnabled") as? Bool) ?? false)
	}
	guard let button = saved else {
		closeEditMode()
		fail("INPUT_NOT_FOUND", "no button to save the edit was found")
	}
	press(button)
	// edit mode ends and the input empties once the edit is saved
	let finished = waitUntil(4) { (text(input, "AXValue") ?? "x").isEmpty }
	if !finished { fail("SEND_UNVERIFIED", "the edit was not confirmed by the window") }
	return title(button) ?? "button"
}

// Runs one action from a message's context menu. The message is found by its exact text, counted from the newest
// (nth = 0 is the latest copy), so an identical older message is never touched by mistake.
func messageAction(_ app: AXUIElement, pid: pid_t, chat: String, match: String, nth: Int, action: String, replyText: String?, reactionIndex: Int, dryRun: Bool) {
	guard action == "delete-auto" || menuTitles[action] != nil else { fail("USAGE", "unknown action") }
	if (action == "reply" || action == "edit") && !dryRun && (replyText ?? "").isEmpty { fail("USAGE", "\(action) needs the new text") }
	let session = openChat(app, pid: pid, chat: chat)
	// a freshly opened window fills its message list a moment later, so wait for the message instead of reading once
	func locateRow() -> AXUIElement? {
		guard let table = messageTable(in: session.window) else { return nil }
		let rows = children(table).filter { role($0) == "AXRow" && exactTexts(in: $0).contains(match) }
		return rows.count > nth ? rows[rows.count - 1 - nth] : nil
	}
	var found: AXUIElement?
	_ = waitUntil(5) {
		found = locateRow()
		return found != nil
	}
	guard let row = found else { fail("MESSAGE_NOT_VISIBLE", "the message was not found in the loaded window") }
	guard let cell = ([row] + descendants(row, depth: 4)).first(where: { actionNames($0).contains("AXShowMenu") }) else { fail("MENU_NOT_FOUND") }
	guard let menu = openContextMenu(app: app, window: session.window, cell: cell, expecting: Set(menuTitles.values).union(["Copy"])) else { fail("MENU_NOT_FOUND") }
	let available = children(menu).compactMap { role($0) == "AXMenuItem" ? title($0) : nil }.filter { !$0.isEmpty }
	// delete-auto: "Delete for Everyone" only exists for recent messages of your own, otherwise only "Delete only for me" does
	let wanted = action == "delete-auto"
		? (available.contains(menuTitles["delete-everyone"]!) ? menuTitles["delete-everyone"]! : menuTitles["delete-me"]!)
		: menuTitles[action]!
	guard let item = children(menu).first(where: { role($0) == "AXMenuItem" && title($0) == wanted }) else {
		_ = AXUIElementPerformAction(menu, "AXCancel" as CFString)
		fail("MENU_ITEM_UNAVAILABLE", wanted)
	}
	if dryRun {
		_ = AXUIElementPerformAction(menu, "AXCancel" as CFString)
		succeed(["ok": true, "dryRun": true, "action": action, "wouldPress": wanted, "available": available])
		return
	}

	press(item)
	switch action {
	case "delete-everyone", "delete-me", "delete-auto":
		if wanted == menuTitles["delete-me"] {
			// delete only for me works through a selection mode that has to be confirmed
			let step = deleteOnlyForMe(window: session.window, locateRow: locateRow)
			succeed(["ok": true, "action": action, "applied": "me", "step": step])
		} else {
			// delete for everyone runs right away, without a confirmation dialog
			Thread.sleep(forTimeInterval: 1.2)
			succeed(["ok": true, "action": action, "applied": "everyone"])
		}
	case "edit":
		let used = editMessage(window: session.window, input: session.input, original: match, newText: replyText ?? "")
		succeed(["ok": true, "action": action, "savedWith": used])
	case "reply":
		_ = waitUntil(2) { descendants(session.window, depth: 8).contains { role($0) == "AXButton" && text($0, "AXDescription") == "Close" } }
		let method = submit(app, pid: pid, session: session, message: replyText ?? "")
		succeed(["ok": true, "action": action, "method": method])
	default:
		var emoji: [AXUIElement] = []
		_ = waitUntil(2) {
			emoji = emojiButtons(app: app, window: session.window)
			return !emoji.isEmpty
		}
		guard reactionIndex >= 0, reactionIndex < emoji.count else { fail("REACTION_NOT_FOUND", "the picker offers \(emoji.count) reactions") }
		press(emoji[reactionIndex])
		Thread.sleep(forTimeInterval: 1.0)
		succeed(["ok": true, "action": action, "reactionIndex": reactionIndex, "offered": emoji.count])
	}
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
	// inspect is diagnostics only and obeys --no-foreground like every other command
	_ = ensureMainWindow(appElement)
	inspect(appElement)
case "probe-menu":
	guard let flag = arguments.firstIndex(of: "--chat"), flag + 1 < arguments.count,
		let matchFlag = arguments.firstIndex(of: "--match"), matchFlag + 1 < arguments.count else { fail("USAGE") }
	let pressFlag = arguments.firstIndex(of: "--press")
	probeMenu(appElement, pid: process.processIdentifier, chat: arguments[flag + 1], match: arguments[matchFlag + 1], press: pressFlag.flatMap { $0 + 1 < arguments.count ? arguments[$0 + 1] : nil })
case "message-action":
	func value(_ name: String) -> String? {
		guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else { return nil }
		return arguments[index + 1]
	}
	// the message text and the reply text arrive as JSON on stdin so they never show up in the process list
	let payload = (try? JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile())) as? [String: Any] ?? [:]
	guard let chat = value("--chat"), let match = payload["match"] as? String, !match.isEmpty, let action = value("--do") else { fail("USAGE") }
	messageAction(
		appElement, pid: process.processIdentifier, chat: chat, match: match, nth: Int(value("--nth") ?? "0") ?? 0, action: action,
		replyText: payload["text"] as? String, reactionIndex: Int(value("--reaction-index") ?? "0") ?? 0, dryRun: arguments.contains("--dry-run"))
case "send":
	guard let flag = arguments.firstIndex(of: "--chat"), flag + 1 < arguments.count else { fail("USAGE") }
	let chat = arguments[flag + 1]
	let message = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
	if message.isEmpty && !arguments.contains("--dry-run") { fail("USAGE", "empty text") }
	send(appElement, pid: process.processIdentifier, chat: chat, dryRun: arguments.contains("--dry-run"), message: message)
default:
	fail("USAGE")
}
