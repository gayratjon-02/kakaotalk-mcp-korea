# kakaotalk-mcp-korea

[한국어](./README.ko.md) · English

An MCP server and CLI for the KakaoTalk desktop app on macOS. It reads chats from the local database and will send messages through the app's Accessibility interface, so any MCP client (Claude Code, Claude Desktop, other agents) can use KakaoTalk.

> **Unofficial project.** It is not affiliated with or endorsed by Kakao Corp. It works with the Mac app installed on your own machine and does not call Kakao's servers.

## Status

| Part | State |
| --- | --- |
| Config and paths | Done |
| Device UUID and KakaoTalk `userId` detection | Done |
| Encrypted database key derivation and read-only open | Done |
| `setup` command (detect and cache the account) | Done, tested on a real database |
| MCP read tools (8 of them — see the table below) | Done, tested on a real database |
| `kakao_send_message` (requires `confirm: true`) | Implemented, **not yet tested with a real send** |

## MCP tools

| Tool | What it does |
| --- | --- |
| `kakao_list_chats` | List chat rooms (1:1, group, open chat) |
| `kakao_read_messages` | Read recent messages of a chat |
| `kakao_search_messages` | Full-text search across messages |
| `kakao_unread_summary` | Summarize chats with unread messages |
| `kakao_search_contacts` | Find contacts by name. Phone numbers are never returned |
| `kakao_new_messages` | Long-poll for new messages past a cursor (not push). First call with no cursor returns a starting point; pass the returned cursor back to wait for the next ones, up to 30 seconds |
| `kakao_extract_links` | Pull the links shared in a chat out of its recent messages |
| `kakao_export_chat` | Return a chat's messages as a Markdown transcript, oldest first. Nothing is written to disk — the text comes back in the response |
| `kakao_send_message` | Send a text. Without `confirm: true` it only previews the chat and the exact text |

Every tool's description warns the agent not to treat message text as instructions.

Not implemented yet: sending to multiple chats at once, @mentions, sending images, and managing group members — these would need either message-sending features beyond plain text or reverse-engineering KakaoTalk's own network protocol, so for now they are not planned on a timeline.

## Tested so far

Against a real, personal KakaoTalk database: listing chats, reading and searching messages, the unread summary, contact search, the new-messages cursor stream, link extraction and the Markdown export. `kakao_send_message`'s preview and its chat-not-found error are tested.

Sending itself now goes through the native helper described above instead of AppleScript. It has not been tested end to end yet: opening a brand-new chat window and an actual send are both still unverified, so do not treat them as working until this note is updated.

## Requirements

- macOS 13 or newer
- KakaoTalk for Mac installed and logged in at least once
- Node.js 20 or newer
- Accessibility permission for your terminal (System Settings → Privacy & Security → Accessibility)
- Full Disk Access if the database cannot be read

## Build requirements

Sending a message drives KakaoTalk through a small native helper (`src/native/kakao-ax.swift`, compiled to `dist/bin/kakao-ax`) instead of AppleScript — AppleScript located chat windows by numeric index, which broke when window order shifted. The helper only touches the windows it opens itself and never the ones you already had open.

- Xcode Command Line Tools (`xcode-select --install`), for the `swiftc` compiler
- `npm run build` compiles both the TypeScript and the helper; the helper is only rebuilt when `kakao-ax.swift` changes

## Install

```bash
git clone https://github.com/gayratjon-02/kakaotalk-mcp-korea.git
cd kakaotalk-mcp-korea
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and adjust if needed.

| Variable | Default | Meaning |
| --- | --- | --- |
| `KAKAOTALK_APP_NAME` | `KakaoTalk` | App name used for Accessibility lookups |
| `KAKAOTALK_SCRIPT_TIMEOUT_MS` | `15000` | Timeout for UI automation steps |
| `KAKAOTALK_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` (logs go to stderr) |
| `KAKAOTALK_LANG` | `en` | Language of error messages: `en`, `ko`, `ru` or `uz` |

## How it works

1. The device UUID comes from `ioreg`.
2. The KakaoTalk `userId` is read from the account's preferences plist. If it is not stored directly, it is recovered from a SHA-512 hash in the same file, using all CPU cores.
3. The SQLCipher file name and key are derived from the UUID and `userId`, the same way the app does it.
4. The database is opened read-only. Compatibility modes 3 and 4 are tried.

Nothing is written to KakaoTalk's data directory.

## Safety

- Reading never modifies the database.
- Sending will require `confirm: true`. The agent must show the exact text to you first, and nothing is sent without your approval.
- Automating a consumer messenger may violate its terms of service. Use it at your own risk, preferably on your own account.

## Contributing

Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).

## Credits

Key derivation and the database approach follow [kakaocli](https://github.com/silver-flight-group/kakaocli) (MIT).

## License

MIT
