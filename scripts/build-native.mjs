#!/usr/bin/env node
// Builds the native Accessibility helper (src/native/kakao-ax.swift) into dist/bin/kakao-ax with the Swift compiler of this Mac.
// It runs after `npm install`, so the binary always matches this machine's architecture and nothing prebuilt is shipped.
// With --soft a problem only prints a hint and the install still succeeds: reading chats works without the helper.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src/native/kakao-ax.swift');
const output = join(root, 'dist/bin/kakao-ax');
const soft = process.argv.includes('--soft');

function stop(message) {
	console.error(`kakaotalk-mcp-korea: ${message}`);
	process.exit(soft ? 0 : 1);
}

if (process.platform !== 'darwin') {
	console.log('kakaotalk-mcp-korea: native helper skipped (it is macOS only).');
	process.exit(0);
}
if (!existsSync(source)) stop('the helper source is missing; reinstall the package.');
if (existsSync(output) && statSync(output).mtimeMs >= statSync(source).mtimeMs) process.exit(0);

// xcrun finds the compiler and sets up the macOS SDK for it; calling the compiler binary directly fails to find the standard library
const xcrun = '/usr/bin/xcrun';
const available = spawnSync(xcrun, ['--find', 'swiftc'], { encoding: 'utf8' });
if (available.status !== 0) {
	stop('the Swift compiler was not found, so sending and window actions are unavailable. Install the Xcode Command Line Tools with `xcode-select --install`, then run `npm rebuild kakaotalk-mcp-korea`. Reading chats works without it.');
}

mkdirSync(dirname(output), { recursive: true });
const result = spawnSync(xcrun, ['swiftc', '-O', '-swift-version', '5', source, '-o', output], { encoding: 'utf8' });
if (result.status !== 0) stop(`building the native helper failed:\n${result.stderr}`);
console.log('kakaotalk-mcp-korea: native helper built.');
