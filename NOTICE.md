# Third-party notices

This project reuses ideas and algorithms from the following open-source work.

## kakaocli

- Project: https://github.com/silver-flight-group/kakaocli
- Copyright (c) 2026 Silver Flight Group, LLC
- License: MIT

The database file name and SQLCipher key derivation in `src/libs/database/crypto-keys.ts`, the userId recovery in `src/libs/device/user-id.ts`, and the Accessibility approach for sending messages are ported from kakaocli's Swift sources.

## Key derivation reference

- https://gist.github.com/blluv/8418e3ef4f4aa86004657ea524f2de14

The key derivation was originally documented in this gist, which kakaocli also cites.

## Disclaimer

This project is not affiliated with or endorsed by Kakao Corp. or Silver Flight Group.
