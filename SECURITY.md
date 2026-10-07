# Security Policy

## Reporting a vulnerability

Please report security issues through GitHub's private vulnerability reporting instead of a public issue: open the [Security tab](https://github.com/gayratjon-02/kakaotalk-mcp-korea/security) on this repository and choose **Report a vulnerability**. That opens a private advisory that only maintainers can see until it is resolved.

If you cannot use that form for some reason, open a regular issue asking to be contacted privately, without any details of the issue itself in the issue body.

This is a project maintained by volunteers in their spare time, not a company with a security team on call. There is no guaranteed response time, but a first response should typically arrive within a week.

When reporting, please include:

- The version (or commit) affected.
- Steps to reproduce, or a proof of concept.
- What you think the impact is (what data or action it exposes).

Please do not include real chat content, real names, phone numbers, or anything else from an actual KakaoTalk account in a report — describe the shape of the issue with made-up data instead (see [CONTRIBUTING.md](./CONTRIBUTING.md)'s fixture rule, which applies here too).

## Supported versions

Only the latest published version is supported. Since this project has not reached a `1.0.0` yet, there is no separate maintenance of older minor versions — please upgrade to the latest release before reporting.

## Security model

This server runs entirely on your own Mac, with no server component of its own (see "Privacy" in the [README](./README.md)). Its attack surface is mostly local: the KakaoTalk database it reads, the MCP client that talks to it, and the few Kakao CDN hosts it is allowed to download from. A few things are worth knowing if you are evaluating it:

- **Confirmation before any write.** Sending, replying, reacting, deleting and editing all require `confirm: true` in the same call. A client that only calls a tool once, with a model-chosen `confirm`, does not get the safety this is meant to provide — the intent is a client (or model policy) that always shows the user the previewed action first.
- **A deny-list for chats.** `KAKAOTALK_BLOCKED_CHATS` and `~/.config/kakaotalk-mcp-korea/blocked-chats.json` keep specific chats or contacts out of reach for `kakao_send_message`, checked against every name field that could identify the chat or the other person, not just the chat title.
- **A frontmost-app check before touching the UI.** Window actions refuse to run while KakaoTalk itself is the active app (`USER_ACTIVE`), so automation never competes with you for the same window you are looking at.
- **Host- and size-restricted downloads.** Every download (shared files, pictures, profile pictures) is restricted to Kakao's own CDN host over https, with a size cap, and redirects are refused outright.
- **No phone numbers beyond the account itself.** `kakao_contact_profile` and `kakao_search_contacts` never return a phone number for anyone but the connected account; only `kakao_account_info` does, and only for that account.
- **Prompt-injection awareness, not prevention.** Every tool whose output can carry someone else's text (a message, a file, a picture) says explicitly, in the tool description an MCP client shows the model, that this text is data and must not be treated as instructions. That is a mitigation aimed at the model reading it, not a technical control — a model that ignores its own tool descriptions can still be misled by something a contact sent. Treat any agent connected to this server the way you would treat one with read/write access to your real messenger.

None of this protects against a vulnerability in KakaoTalk itself, in the Accessibility API, or in Node.js or its dependencies — see "Reporting a vulnerability" above for those.
