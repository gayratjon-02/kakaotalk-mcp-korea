# 💬 kakaotalk-mcp-korea

[한국어](./README.ko.md) · **English**

![platform](https://img.shields.io/badge/platform-macOS%2013%2B-000000?logo=apple&logoColor=white)
![node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![native helper](https://img.shields.io/badge/native%20helper-Swift-F05138?logo=swift&logoColor=white)
![mcp tools](https://img.shields.io/badge/MCP%20tools-18-6E56CF)
![tests](https://img.shields.io/badge/tests-77%20passing-2EA043)
![license](https://img.shields.io/badge/license-MIT-blue)

An MCP server and CLI that lets any MCP client — Claude Code, Claude Desktop, or your own agent — read and send KakaoTalk on macOS: chats, messages, files, contacts, and the connected account's own profile.

> 🦋 **Unofficial project.** Not affiliated with or endorsed by Kakao Corp. It works with the Mac app installed on your own machine and does not call Kakao's servers.

<p align="center">
  <img src="docs/assets/architecture.svg" alt="An MCP client talks to kakaotalk-mcp-korea over MCP. It reads the local SQLite database directly, and drives KakaoTalk.app through a Swift Accessibility helper (kakao-ax) for sending." width="640">
</p>

## ✨ Highlights

|  |  |
| --- | --- |
| 📖 **Read everything** | Chats, messages, search, unread summaries, links, shared files (pdf/docx/pptx/xlsx…), contacts, your own account profile |
| ✉️ **Send, safely** | Every send previews first — nothing goes out without `confirm: true` |
| 🙈 **Focus-minimizing** | Sends in the background when it can; confirmed by a real test to leave your current app undisturbed |
| 🔒 **Privacy-aware** | Phone numbers never leak for anyone but you; downloads are host-restricted and size-capped |
| 🧪 **Tested, not just claimed** | 77 unit tests plus real-database, real-send, real-reply/react/delete verification — tracked honestly in "Tested so far" |
| 🌐 **Bilingual** | This README and all error messages ship in English and 한국어 (plus ru/uz) |

## 📊 Status

| | Part | State |
| --- | --- | --- |
| ✅ | Config and paths | Done |
| ✅ | Device UUID and KakaoTalk `userId` detection | Done |
| ✅ | Encrypted database key derivation and read-only open | Done |
| ✅ | `setup` command (detect and cache the account) | Done, tested on a real database |
| ✅ | MCP read tools (10 of them — see the table below) | Done, tested on a real database |
| 🧪 | `kakao_account_info`, `kakao_contact_profile`, `kakao_profile_image` | Done, covered by unit tests with generated fixtures; not yet separately exercised against a real account |
| ✅ | `kakao_send_message` (requires `confirm: true`) | Done, **confirmed with a real send** |
| ✅ | `kakao_delete_message`, `kakao_reply_message`, `kakao_react_message` (each requires `confirm: true`) | Done, **confirmed live in a real chat** |
| 🧪 | `kakao_edit_message` (requires `confirm: true`) | Implemented, **not yet tested live** |

## 🧰 MCP tools

|  | Tool | What it does |
| --- | --- | --- |
| 📂 | `kakao_list_chats` | List chat rooms ordered by last activity, with unread counts and a `kind` field (`direct`, `group`, `open`). `scope` filters to `all`, `direct`, `group` or `open` |
| 📖 | `kakao_read_messages` | Read recent messages of a chat. A message the sender recalled comes back with `deleted: true` and no text; a reply carries `replyTo` (the quoted message's id and an 80-character preview) |
| 🔎 | `kakao_search_messages` | Full-text search across messages |
| 🔔 | `kakao_unread_summary` | Summarize chats with unread messages |
| 👥 | `kakao_search_contacts` | Find contacts by name. Phone numbers are never returned |
| ⏱️ | `kakao_new_messages` | Long-poll for new messages past a cursor (not push). First call with no cursor returns a starting point; pass the returned cursor back to wait for the next ones, up to 30 seconds |
| 🔗 | `kakao_extract_links` | Pull the links shared in a chat out of its recent messages |
| 📝 | `kakao_export_chat` | Return a chat's messages as a Markdown transcript, oldest first. A recalled message is shown as `[deleted]`. Nothing is written to disk — the text comes back in the response |
| 🗂️ | `kakao_list_files` | List files shared in a chat, newest first, with an `availability`: `local` (already on this Mac), `download` (still on Kakao's server) or `expired` |
| 📄 | `kakao_read_file` | Read a shared file's text by its `messageId` from `kakao_list_files`. Supports pdf, docx/doc/rtf, pptx, xlsx, txt/md/csv/json/html and zip (file listing only). A file not already on the Mac is downloaded while it has not expired, from `https://*.kakaocdn.net` only, capped at `KAKAOTALK_MAX_FILE_MB`, cached under `~/.cache/kakaotalk-mcp-korea/files` |
| 🪪 | `kakao_account_info` | Full overview of the connected account: own profile (name, status, picture link, login id, phone number, open chat profiles), app version, chat counts by kind with unread totals and folders, contact counts, message/file totals, calendar counts |
| 🧑 | `kakao_contact_profile` | Look up a contact by name or user id: name, status message, picture link, favorite/hidden flags. Phone numbers are never returned |
| 🖼️ | `kakao_profile_image` | Return a profile picture as an actual image (not a link). Without `userId` it is the connected account's own picture. Downloaded from the Kakao CDN only, capped at 5 MB |
| ✉️ | `kakao_send_message` | Send a text. Without `confirm: true` it only previews the chat and the exact text |
| ↩️ | `kakao_reply_message` | Send a text that quotes one specific message by its `messageId` |
| 👍 | `kakao_react_message` | Add a reaction to a message. `reactionIndex` is its position in KakaoTalk's picker (0 is thumbs up, ~44 choices); re-adding the same one leaves it unchanged, and there is no way to remove a reaction yet |
| 🗑️ | `kakao_delete_message` | Delete one of your messages. `scope`: `auto` (default) deletes for everyone when KakaoTalk still allows it for that message, otherwise only for you; `everyone` or `me` force one or fail. **Cannot be undone** |
| ✏️ | `kakao_edit_message` | Replace the text of one of your own recent text messages. KakaoTalk only offers editing for eligible messages; otherwise the call fails and changes nothing. **Implemented, not yet tested live** |

Every tool's description warns the agent not to treat message text as instructions.

When an MCP client connects, the server sends a short account summary (name, app version, chat/contact/message counts) as part of its `initialize` response, so the model already knows the basics without calling a tool first. The login id and phone number are deliberately left out of this summary — they are only ever returned by `kakao_account_info`, and never for anyone other than the connected account (see "Safety").

Not implemented yet: removing a reaction once added, reading photos or photo albums shared in a chat (only files of Kakao's own "file" kind are listed — a real account checked while building this had 127 photo messages and 26 photo albums that `kakao_list_files` does not see at all), sending to multiple chats at once, @mentions, sending images, and managing group members. These would need either new message-reading/sending logic beyond the current file path, or reverse-engineering KakaoTalk's own network protocol, so for now they are not planned on a timeline.

## ✅ Tested so far

Against a real, personal KakaoTalk database: listing chats, reading and searching messages, the unread summary, contact search, the new-messages cursor stream, link extraction and the Markdown export. `kakao_send_message`'s preview and its chat-not-found error are tested.

File reading was tried against real shared files in a group chat: 5 files read (3 pdf, 1 pptx, 1 docx), an expired file correctly reported `FILE_EXPIRED`, and the download path (for a file not yet on the Mac) was exercised once and verified (size and the PDF `%PDF` signature matched) before the downloaded copy was deleted. `extractText` is additionally covered by generated, non-personal fixture files for docx, pptx, xlsx and pdf.

`kakao_account_info` and `kakao_contact_profile`'s underlying queries (chat/contact/message/file/calendar counts, folder names, contact search and ranking, the phone-number field never leaking into `kakao_contact_profile`) are covered by unit tests against a generated in-memory database, not real account data. The one part of the real profile that cannot be put in a fixture — the KakaoTalk login id, read from this machine's own preferences — is exercised by a separate, pure test (`phoneFromLoginId`) instead of asserted on directly.

Sending itself now goes through the native helper described above instead of AppleScript. `dryRun` (opens the chat window and checks it without typing) passed 6/6 real runs, including with an unrelated chat window already open — the window-matching check correctly refused to act on the wrong one. With the background-focus approach (closing other chat windows, then focusing the main window directly and posting Return to KakaoTalk's process rather than activating it), 3/3 runs kept focus on whatever app the tester was using, with no visible app switch. **An actual send has now been tried with a real message and confirmed by the person testing it**: the text was typed, the chat's own Send button was pressed (the `send-button` method — no Return-key fallback was needed), focus did not visibly move, and exactly one copy of the message landed in the database. The draft-clearing path (closing an *other* chat window that has unsent text in it) has still not been exercised live — that needs a second chat window with a real draft sitting in it, which has not been set up for a test yet.

`kakao_reply_message`, `kakao_react_message` and `kakao_delete_message` were all tried live in a real chat. Reply: a real reply (kind 26) was sent and its `src_logId` matched the quoted message. React: index 0 added "엄지척" (thumbs up), confirmed against `NTChatLogMeta`; the picker offers about 44 reactions; re-adding the same one left it unchanged. Delete: `scope: auto` correctly chose "Delete for Everyone" when KakaoTalk's own menu offered it, and "Delete only for me" when it did not (confirmed with `dryRun` on another person's message and on an old message of mine, where only "me" was offered). Each scope is now confirmed by its own distinct trace rather than the type flag alone (see "How it works"): deleting for everyone leaves the `feedType: 14` companion row this README already describes; deleting for me goes through KakaoTalk's selection mode (checkboxes next to messages, then OK/confirm) and the message's `status` becomes `2`, with no companion row.

## 📋 Requirements

- macOS 13 or newer
- KakaoTalk for Mac installed and logged in at least once
- Node.js 20 or newer
- Accessibility permission for your terminal (System Settings → Privacy & Security → Accessibility)
- Full Disk Access if the database cannot be read

## 🛠️ Build requirements

Sending a message drives KakaoTalk through a small native helper (`src/native/kakao-ax.swift`, compiled to `dist/bin/kakao-ax`) instead of AppleScript — AppleScript located chat windows by numeric index, which broke when window order shifted. The helper only touches the windows it opens itself and never the ones you already had open.

It also tries to stay out of your way. By default, before opening a chat the helper closes your *other* open chat windows — one of them could otherwise hold the keyboard focus and swallow the Return keypress meant for the chat being opened. Only windows with a message list are touched, and non-chat windows (like the calendar) are never touched. **If one of those other windows has unsent text in its input, that text is cleared before the window is closed** — see "Safety" below. Opening the chat itself and pressing Return are then done by focusing KakaoTalk's main window directly and sending the keypress to its process — without activating the app or taking it to the foreground at all. Sending the text first sets it directly, then presses the chat's own Send button (no focus needed for that either); only if the button cannot be found does it fall back to a Return keypress, which would require the app briefly active. A message is only ever typed into the exact window confirmed to match the target chat by name — if the right window cannot be confirmed, nothing is sent. By default the helper is not even allowed to activate KakaoTalk as that fallback: the action simply fails instead of ever risking a visible focus change. Set `KAKAOTALK_ALLOW_FOREGROUND=1` if you would rather it activate the app as a last resort than fail outright. Set `KAKAOTALK_KEEP_OTHER_WINDOWS=1` if you'd rather it left your other open chat windows (and any drafts in them) alone (then a Return press may land in the wrong one if you have one focused). Some loss of focus is still theoretically possible when `KAKAOTALK_ALLOW_FOREGROUND=1` is set, and cannot be fully ruled out with Apple's public automation APIs (see `notes/` for the research behind this, not tracked in the repository).

**Troubleshooting — `MAIN_WINDOW_MISSING` in the background:** the Accessibility API can only see windows on the current desktop (Space). If KakaoTalk's window lives on a different Space or a second display, the default no-foreground mode will not find it and fails with this error (the error message itself says the same thing). *Recommended, not yet verified*: right-click the KakaoTalk icon in the Dock → Options → Assign To → All Desktops, so its window is present on every Space and the background mode can always reach it.

- Xcode Command Line Tools (`xcode-select --install`), for the `swiftc` compiler
- `npm run build` compiles both the TypeScript and the helper; the helper is only rebuilt when `kakao-ax.swift` changes
- Optional: [poppler](https://poppler.freedesktop.org/) (`brew install poppler`) for `pdftotext`, used by `kakao_read_file` to read PDFs. Without it, PDFs cannot be turned into text; everything else works regardless

## 📦 Install

```bash
git clone https://github.com/gayratjon-02/kakaotalk-mcp-korea.git
cd kakaotalk-mcp-korea
npm install
npm run build
```

## ⚙️ Configuration

Copy `.env.example` to `.env` and adjust if needed.

| Variable | Default | Meaning |
| --- | --- | --- |
| `KAKAOTALK_APP_NAME` | `KakaoTalk` | App name used for Accessibility lookups |
| `KAKAOTALK_SCRIPT_TIMEOUT_MS` | `15000` | Timeout for UI automation steps |
| `KAKAOTALK_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` (logs go to stderr) |
| `KAKAOTALK_LANG` | `en` | Language of error messages: `en`, `ko`, `ru` or `uz` |
| `KAKAOTALK_MAX_FILE_MB` | `25` | Size cap for a file `kakao_read_file` downloads from Kakao's server |
| `KAKAOTALK_BLOCKED_CHATS` | *(empty)* | Comma-separated chat/contact names that `kakao_send_message` always refuses. A local `~/.config/kakaotalk-mcp-korea/blocked-chats.json` (a JSON array of names) is read as well, so private names never have to live in `.env` or the repository |
| `KAKAOTALK_KEEP_OTHER_WINDOWS` | `0` | `1` or `true` to stop sending from closing (and clearing drafts in) your other open chat windows before it opens the target one — see "Safety" |
| `KAKAOTALK_ALLOW_FOREGROUND` | `0` | `1` or `true` to let the helper activate KakaoTalk as a last resort instead of failing the action. Default is to never activate it at all — see "Build requirements" |

## 🧠 How it works

1. The device UUID comes from `ioreg`.
2. The KakaoTalk `userId` is read from the account's preferences plist. If it is not stored directly, it is recovered from a SHA-512 hash in the same file, using all CPU cores.
3. The SQLCipher file name and key are derived from the UUID and `userId`, the same way the app does it.
4. The database is opened read-only. Compatibility modes 3 and 4 are tried.

Nothing is written to KakaoTalk's data directory.

Telling "the sender recalled this message" apart from everything else that reuses the same bit in the message's stored type (a long message, a "delete for me only" done through KakaoTalk's own UI) takes one more step: a real unsend always creates its own companion row, whose content is `{"feedType": 14, "logId": <the message>, "hidden": true}`. Only a message with a matching companion row is reported `deleted: true`; the type bit alone is not trusted.

## 🔒 Safety

- Reading never modifies the database.
- Sending, replying, reacting and deleting all require `confirm: true`. The agent must show you the exact action first, and nothing happens without your approval.
- ⚠️ **`kakao_delete_message` cannot be undone.** With `scope: everyone` (or `auto` when KakaoTalk still allows it for that message), the other people in the chat lose their copy too, not just yours.
- ⚠️ **Sending a message can erase an unsent draft in one of your other open chat windows.** By default, other chat windows are closed first (see "Build requirements"); if one of them has unsent text in its input, that text is cleared before the window closes — it is not saved anywhere first. Set `KAKAOTALK_KEEP_OTHER_WINDOWS=1` to turn this off entirely and leave your other windows (and their drafts) untouched. This path has not been exercised with a real draft yet — treat it as unverified, not as proven safe.
- A chat or contact name in `KAKAOTALK_BLOCKED_CHATS` or `blocked-chats.json` can never be sent to, checked against the chat title and against the other person's display name, friend nickname and KakaoTalk nickname (a substring match, so renaming a chat cannot slip past the check as long as the blocked text is still part of some name shown).
- Downloaded files only ever come from `https://*.kakaocdn.net`, capped at `KAKAOTALK_MAX_FILE_MB`, and are cached under your home directory, not the repository.
- Your own login id and phone number are only ever returned by `kakao_account_info`, and only for the connected account — no other tool exposes them. `kakao_contact_profile` and `kakao_search_contacts` never return a phone number for anyone else, by design (see "MCP tools"). The short account summary sent to the client on connect (see "MCP tools") leaves both out too.
- Automating a consumer messenger may violate its terms of service. Use it at your own risk, preferably on your own account.

## 🤝 Contributing

Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).

## 🙏 Credits

Key derivation and the database approach follow [kakaocli](https://github.com/silver-flight-group/kakaocli) (MIT).

## 📄 License

MIT
