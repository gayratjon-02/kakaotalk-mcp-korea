# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

Nothing yet.

## [0.1.0]

First release.

### Added

- An MCP server (`kakaotalk-mcp-korea`, stdio) and a `setup` CLI command, for any MCP client to read and send KakaoTalk on macOS.
- Account detection and encrypted database access: device UUID from `ioreg`, KakaoTalk `userId` recovery from the account preferences plist (direct value or SHA-512 hash search), SQLCipher key derivation, and a read-only database open, with the detected account cached on disk after the first `setup`.
- Read tools: `kakao_list_chats`, `kakao_read_messages`, `kakao_search_messages`, `kakao_unread_summary`, `kakao_search_contacts`, `kakao_new_messages` (cursor-based long poll), `kakao_extract_links`, `kakao_export_chat` (Markdown transcript).
- File tools: `kakao_list_files` and `kakao_read_file`, extracting text from pdf, docx/doc/rtf, pptx, xlsx, txt/md/csv/json/html and zip (listing only), downloading from Kakao's own CDN host only, capped by `KAKAOTALK_MAX_FILE_MB`.
- Picture tools: `kakao_list_images` and `kakao_get_image`, covering single photos and albums, with a local-copy / full-download / thumbnail fallback.
- Account and contact tools: `kakao_account_info` (full profile and counts), `kakao_contact_profile`, `kakao_profile_image` — phone numbers are returned only for the connected account, never for anyone else.
- Send and message-action tools, each requiring `confirm: true`: `kakao_send_message`, `kakao_reply_message`, `kakao_react_message`, `kakao_delete_message` (with an `auto`/`everyone`/`me` scope, verified by its own distinct trace rather than a type flag), and `kakao_edit_message`.
- A native Swift Accessibility helper (`kakao-ax`, compiled at install time) that drives KakaoTalk's own UI instead of AppleScript, matching windows by name rather than a numeric index.
- Focus-minimizing sending: other open chat windows are closed first (clearing any unsent draft in them) so they cannot swallow the keypress meant for the target chat; the target window is focused and driven without activating KakaoTalk or bringing it to the foreground; a cross-Space window search (the technique [AltTab](https://alt-tab-macos.netlify.app/) uses) finds the main window on another Space or display without touching focus. `KAKAOTALK_ALLOW_FOREGROUND` and `KAKAOTALK_KEEP_OTHER_WINDOWS` opt out of either behavior.
- A frontmost-app check (`USER_ACTIVE`) that skips a window action outright while KakaoTalk itself is the active app, instead of competing with you for the same window.
- A local chat/contact block list (`KAKAOTALK_BLOCKED_CHATS`, and `~/.config/kakaotalk-mcp-korea/blocked-chats.json` for names that should not live in `.env`), checked against every name that could identify a chat or its other person.
- Reliable deleted-message and reply detection in `kakao_read_messages`, `kakao_search_messages`, `kakao_export_chat` and `kakao_new_messages`, based on the message's own companion row rather than a type bit also reused for other things.
- A short account summary sent to the MCP client's `initialize` response, with the login id and phone number deliberately left out of it.
- Localized messages in English, Korean, Russian and Uzbek (`KAKAOTALK_LANG`).
- A bilingual README (English and Korean) with an architecture diagram, and CI running the test suite on macOS across two Node versions plus a check of the published package's contents.

[Unreleased]: https://github.com/gayratjon-02/kakaotalk-mcp-korea/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gayratjon-02/kakaotalk-mcp-korea/releases/tag/v0.1.0
