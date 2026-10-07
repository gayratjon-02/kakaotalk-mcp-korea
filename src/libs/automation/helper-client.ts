import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
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
	MESSAGE_NOT_VISIBLE: Message.MESSAGE_NOT_VISIBLE,
	MENU_NOT_FOUND: Message.MENU_NOT_FOUND,
	MENU_ITEM_UNAVAILABLE: Message.MENU_ITEM_UNAVAILABLE,
	REACTION_NOT_FOUND: Message.REACTION_NOT_FOUND,
};

export type HelperReply = { ok: boolean; code?: string; detail?: string; [key: string]: unknown };

// flags every helper run gets: other chat windows are closed unless disabled, and the app is never brought forward
// unless the user allowed it, because that would send their typing to the wrong app
function commonFlags(): string[] {
	return [...(env.keepOtherWindows ? ['--keep-other-windows'] : []), ...(env.allowForeground ? [] : ['--no-foreground'])];
}

export function runHelper(args: string[], stdin = ''): Promise<HelperReply> {
	if (!existsSync(HELPER)) return Promise.reject(new AppError(Message.HELPER_MISSING));
	return new Promise((resolve, reject) => {
		const child = spawn(HELPER, [...args, ...commonFlags()], { stdio: ['pipe', 'pipe', 'pipe'] });
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
		// text goes through stdin so it never shows up in the process list
		child.stdin.end(stdin);
	});
}

// a failed helper reply becomes the matching localized error
export function assertHelperOk(reply: HelperReply): HelperReply {
	if (reply.ok) return reply;
	const code = HELPER_ERRORS[reply.code ?? ''];
	throw code ? new AppError(code) : new AppError(Message.INPUT_NOT_FOUND, reply.code);
}
