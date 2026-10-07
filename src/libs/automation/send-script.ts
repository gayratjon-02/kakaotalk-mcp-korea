// AppleScript driven through System Events. Chat name and text arrive as argv, never interpolated.
// A row matches when one of its labels equals the chat name exactly (label ids differ between app versions).
// Rows and the opened window must match the chat name exactly: a partial match such as "Anna" for "Anna Lee"
// could open the wrong person, so it fails instead. The script aborts before typing on any mismatch.
// With dryRun it stops right after the checks: the chat window is opened and closed, nothing is typed.
// Elements are found with plain loops: a whose-filter throws on elements without an AXIdentifier and try would hide it.
// Windows are addressed by index and re-resolved after every close, because closing shifts indexes.
export const SEND_SCRIPT = `
on run argv
	set chatName to item 1 of argv
	set msgText to item 2 of argv
	set dryRun to ((item 3 of argv) is "1")
	tell application "KakaoTalk" to activate
	delay 0.6
	tell application "System Events"
		tell process "KakaoTalk"
			repeat with i from (count of windows) to 1 by -1
				try
					if (value of attribute "AXIdentifier" of window i) is not "Main Window" then
						perform action "AXPress" of (value of attribute "AXCloseButton" of window i)
					end if
				end try
			end repeat
			delay 0.3
			set mainWin to missing value
			repeat with i from 1 to (count of windows)
				if (value of attribute "AXIdentifier" of window i) is "Main Window" then set mainWin to window i
			end repeat
			if mainWin is missing value then error "NO_MAIN_WINDOW"
			repeat with el in UI elements of mainWin
				try
					if (value of attribute "AXIdentifier" of el) is "chatrooms" then perform action "AXPress" of el
				end try
			end repeat
			delay 0.6
			set theTable to missing value
			repeat with sa in scroll areas of mainWin
				if (count of tables of sa) > 0 then set theTable to table 1 of sa
			end repeat
			if theTable is missing value then error "CHAT_LIST_NOT_FOUND"
			set exactRows to {}
			repeat with r in rows of theTable
				try
					set matched to false
					repeat with labelItem in static texts of UI element 1 of r
						try
							if (value of labelItem) is chatName then set matched to true
						end try
					end repeat
					if matched then set end of exactRows to contents of r
				end try
			end repeat
			if (count of exactRows) is 1 then
				set targetRow to item 1 of exactRows
			else if (count of exactRows) is 0 then
				error "CHAT_NOT_FOUND"
			else
				error "CHAT_AMBIGUOUS"
			end if
			set selected of targetRow to true
			delay 0.2
			key code 36
			delay 0.9
			set chatWin to missing value
			repeat with i from 1 to (count of windows)
				if (value of attribute "AXIdentifier" of window i) is not "Main Window" then set chatWin to window i
			end repeat
			if chatWin is missing value then error "INPUT_NOT_FOUND"
			if (name of chatWin) is not chatName then
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
