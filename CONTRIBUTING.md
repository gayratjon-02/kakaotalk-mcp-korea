# Contributing

Thanks for taking the time to contribute. This project is a small, personal-use tool, so please keep that scope in mind — see "Not implemented yet" in the [README](./README.md) for what is intentionally left out for now.

## Building from source

```bash
git clone https://github.com/gayratjon-02/kakaotalk-mcp-korea.git
cd kakaotalk-mcp-korea
npm ci
npm run build
```

`npm run build` runs `tsc` and then compiles the native Swift helper (`scripts/build-native.mjs`), which needs the Xcode Command Line Tools (`xcode-select --install`). The helper is only recompiled when `src/native/kakao-ax.swift` changed since the last build.

Useful scripts while working on it:

- `npm run dev` — `tsc --watch`, for fast feedback on type errors.
- `npm start` — runs the built server over stdio, same as an MCP client would.
- `node dist/index.js setup` — detects the account and checks window reachability (see "Build requirements" in the README).

## Running the tests

```bash
npm test
```

This builds first, then runs every `*.test.js` file under `dist/test` with Node's own test runner:

```bash
node --test $(find dist/test -name '*.test.js')
```

(the explicit `find` is there so the same command works on Node 20 and 22, where glob patterns in `node --test` behave differently — though this package itself now requires Node 22+, see "Requirements").

Most of the test suite runs against a generated in-memory SQLite database (`src/test/support/memory-db.ts`) or generated fixture files (`src/test/support/file-fixtures.ts`), not a real KakaoTalk account — see "Fixture data" below. A handful of things were additionally verified by hand against a real, personal account during development; those are recorded honestly in the README's "Tested so far", not re-run automatically, and a PR does not need to repeat them.

## Fixture data

**Never commit real chat names, real messages, a real phone number, or any other real KakaoTalk data — your own account's or anyone else's.** Every fixture in this repository uses invented data: fictional names (Alice, Bob, Carol, …), made-up phone numbers, and generated file contents. Please follow the same rule in any fixture, test, or example you add, and in any issue or pull request description (see "Reporting a vulnerability" in [SECURITY.md](./SECURITY.md) for the same rule when filing a security report).

## Commit style

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `build:`, `ci:` or `chore:`, with a short, present-tense summary (for example `fix: refuse a blocked chat by any of its name fields`).

## Pull requests

1. Fork the repository and branch from `main`.
2. Keep a pull request focused on one change; unrelated cleanups make it harder to review.
3. Add or update tests for any behavior change — see "Running the tests" and "Fixture data" above.
4. Update the README (both `README.md` and `README.ko.md`) when the change affects a tool's behavior, a configuration variable, or anything else it documents. The two files should stay in sync.
5. Make sure `npm test` passes locally before opening the pull request; CI runs the same suite on macOS with two Node versions.
6. Describe what you tested and how in the pull request description — the project's own convention (see the README's "Tested so far") is to say plainly what was and was not verified, rather than imply more confidence than the testing supports.

Opening an issue first is welcome for anything larger than a small fix, so the approach can be discussed before you put time into it.
