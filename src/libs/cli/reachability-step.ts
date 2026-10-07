import { createInterface } from 'node:readline/promises';
import { runHelper } from '../automation/helper-client.js';
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

// the real thing window actions depend on: can the helper see the KakaoTalk main window right now, without bringing the app forward
async function windowReachable(): Promise<boolean> {
	try {
		return (await runHelper(['inspect'])).ok;
	} catch {
		return false;
	}
}

// Required part of setup. A terminal user is walked through the fix and the check is repeated; without a terminal the unmet
// step is reported and setup is not complete. --skip-window-check opts out explicitly. Returns true when setup may be called complete.
export async function ensureWindowReachable(args: string[]): Promise<boolean> {
	if (await windowReachable()) {
		console.log(t(Message.WINDOW_REACHABLE, env.lang));
		return true;
	}
	console.log(t(Message.MAIN_WINDOW_MISSING, env.lang));
	if (args.includes('--skip-window-check')) return true;
	if (!process.stdin.isTTY) return false;

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
		const answer = await pause('\nPress Enter after you did it to check again, or type "skip" to continue without it: ');
		if (answer === 'skip') return true;
		if (await windowReachable()) {
			console.log(t(Message.WINDOW_REACHABLE, env.lang));
			return true;
		}
		console.log(t(Message.MAIN_WINDOW_MISSING, env.lang));
	}
	return false;
}
