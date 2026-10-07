import { createInterface } from 'node:readline/promises';
import { readDesktopBinding } from '../device/desktop-binding.js';
import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';

const MAX_ATTEMPTS = 5;

async function pause(question: string): Promise<string> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return (await rl.question(question)).trim().toLowerCase();
	} finally {
		rl.close();
	}
}

// Required part of setup: window actions only work in the background when KakaoTalk is assigned to All Desktops.
// Returns true when setup may be called complete. A terminal user is walked through it and the setting is re-checked;
// without a terminal the missing step is reported and setup is not complete. --skip-desktop-check opts out explicitly.
export async function ensureDesktopAssignment(args: string[]): Promise<boolean> {
	const binding = readDesktopBinding();
	if (binding === 'all-desktops') {
		console.log(t(Message.DESKTOP_READY, env.lang));
		return true;
	}
	if (binding === 'unknown') {
		console.log(t(Message.DESKTOP_UNVERIFIED, env.lang));
		return true;
	}
	console.log(t(Message.DESKTOP_NOT_ASSIGNED, env.lang));
	if (args.includes('--skip-desktop-check')) return true;
	if (!process.stdin.isTTY) return false;

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
		const answer = await pause('\nPress Enter after you did it to check again, or type "skip" to continue without it: ');
		if (answer === 'skip') return true;
		if (readDesktopBinding() === 'all-desktops') {
			console.log(t(Message.DESKTOP_READY, env.lang));
			return true;
		}
		console.log(t(Message.DESKTOP_NOT_ASSIGNED, env.lang));
	}
	return false;
}
