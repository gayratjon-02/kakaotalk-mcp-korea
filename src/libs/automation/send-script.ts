// AppleScript driven through System Events. Chat name and text arrive as argv, never interpolated.
// The script aborts before typing when the opened window title does not match the target chat.
// With dryRun it stops right after the checks: the chat window is opened and closed, nothing is typed.
export const SEND_SCRIPT = `
on run argv
	set chatName to item 1 of argv
	set msgText to item 2 of argv
	set dryRun to ((item 3 of argv) is "1")
	tell application "KakaoTalk" to activate
	delay 0.6
	tell application "System Events"
		tell process "KakaoTalk"
			set mainWin to missing value
			repeat with w in windows
				if (value of attribute "AXIdentifier" of w) is "Main Window" then set mainWin to w
			end repeat
			if mainWin is missing value then error "NO_MAIN_WINDOW"
			repeat with w in windows
				if (value of attribute "AXIdentifier" of w) is not "Main Window" then
					try
						perform action "AXPress" of (value of attribute "AXCloseButton" of w)
					end try
				end if
			end repeat
			try
				perform action "AXPress" of (first checkbox of mainWin whose value of attribute "AXIdentifier" is "chatrooms")
			end try
			delay 0.3
			set theTable to table 1 of scroll area 1 of mainWin
			set exactRows to {}
			set looseRows to {}
			repeat with r in rows of theTable
				try
					set rowName to value of (first static text of UI element 1 of r whose value of attribute "AXIdentifier" is "_NS:18")
					if rowName is chatName then set end of exactRows to contents of r
					if rowName contains chatName then set end of looseRows to contents of r
				end try
			end repeat
			if (count of exactRows) is 1 then
				set targetRow to item 1 of exactRows
			else if (count of exactRows) is 0 and (count of looseRows) is 1 then
				set targetRow to item 1 of looseRows
			else if (count of exactRows) + (count of looseRows) is 0 then
				error "CHAT_NOT_FOUND"
			else
				error "CHAT_AMBIGUOUS"
			end if
			set selected of targetRow to true
			delay 0.2
			key code 36
			delay 0.9
			set chatWin to missing value
			repeat with w in windows
				if (value of attribute "AXIdentifier" of w) is not "Main Window" then set chatWin to contents of w
			end repeat
			if chatWin is missing value then error "INPUT_NOT_FOUND"
			if (name of chatWin) does not contain chatName then
				try
					perform action "AXPress" of (value of attribute "AXCloseButton" of chatWin)
				end try
				error "WINDOW_MISMATCH"
			end if
			set inputArea to missing value
			repeat with sa in scroll areas of chatWin
				if (count of tables of sa) is 0 then
					try
						set inputArea to text area 1 of sa
					end try
				end if
			end repeat
			if inputArea is missing value then error "INPUT_NOT_FOUND"
			if dryRun then
				try
					perform action "AXPress" of (value of attribute "AXCloseButton" of chatWin)
				end try
				return "DRY_OK"
			end if
			perform action "AXRaise" of chatWin
			set focused of inputArea to true
			set value of inputArea to msgText
			delay 0.2
			key code 36
			delay 0.4
			try
				perform action "AXPress" of (value of attribute "AXCloseButton" of chatWin)
			end try
		end tell
	end tell
	return "OK"
end run
`;
