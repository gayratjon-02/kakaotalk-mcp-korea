import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isBlockedChat } from '../config/blocklist.js';
import { env } from '../config/env.js';
import { assertAppInstalled } from '../device/device-info.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';

// dist/libs/automation -> dist/bin, where the Swift helper is built
const HELPER = fileURLToPath(new URL('../../bin/kakao-ax', import.meta.url));

const HELPER_ERRORS: Record<string, Message> = {
	ACCESSIBILITY_DENIED: Message.ACCESSIBILITY_DENIED,
	APP_NOT_RUNNING: Message.APP_NOT_RUNNING,
	MAIN_WINDOW_MISSING: Message.MAIN_WINDOW_MISSING,
	CHAT_LIST_NOT_FOUND: Message.CHAT_LIST_NOT_FOUND,
	CHAT_NOT_FOUND: Message.CHAT_NOT_FOUND,
	CHAT_AMBIGUOUS: Message.CHAT_AMBIGUOUS,
	CHAT_WINDOW_NOT_OPENED: Message.CHAT_WINDOW_NOT_OPENED,
	WINDOW_MISMATCH: Message.WINDOW_MISMATCH,
	INPUT_NOT_FOUND: Message.INPUT_NOT_FOUND,
	SEND_UNVERIFIED: Message.SEND_UNVERIFIED,
};

type HelperReply = { ok: boolean; code?: string; detail?: string };

function runHelper(args: string[], stdin: string): Promise<HelperReply> {
	return new Promise((resolve, reject) => {
		const child = spawn(HELPER, args, { stdio: ['pipe', 'pipe', 'pipe'] });
		let out = '';
		const timer = setTimeout(() => child.kill('SIGKILL'), env.scriptTimeoutMs);
		child.stdout.on('data', (chunk) => (out += chunk));
		child.on('error', reject);
		child.on('close', () => {
			clearTimeout(timer);
			try {
				resolve(JSON.parse(out.trim().split('\n').pop() ?? '') as HelperReply);
			} catch {
				reject(new AppError(Message.INPUT_NOT_FOUND, 'the helper returned no result'));
			}
		});
		// the text goes through stdin so it never shows up in the process list
		child.stdin.end(stdin);
	});
}

export async function sendToChat(chatName: string, text: string, dryRun = false): Promise<void> {
	// checked here, below every caller, so no code path can reach the window of a blocked chat
	if (isBlockedChat(chatName)) throw new AppError(Message.CHAT_BLOCKED);
	assertAppInstalled();
	if (!existsSync(HELPER)) throw new AppError(Message.HELPER_MISSING);

	const reply = await runHelper(['send', '--chat', chatName, ...(dryRun ? ['--dry-run'] : [])], text);
	if (reply.ok) return;
	const code = HELPER_ERRORS[reply.code ?? ''];
	throw code ? new AppError(code) : new AppError(Message.INPUT_NOT_FOUND, reply.code);
}
