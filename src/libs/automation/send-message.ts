import { execFile } from 'node:child_process';
import { isBlockedChat } from '../config/blocklist.js';
import { env } from '../config/env.js';
import { assertAppInstalled } from '../device/device-info.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { SEND_SCRIPT } from './send-script.js';

const KNOWN_ERRORS: Record<string, Message> = {
	CHAT_LIST_NOT_FOUND: Message.CHAT_LIST_NOT_FOUND,
	CHAT_NOT_FOUND: Message.CHAT_NOT_FOUND,
	CHAT_AMBIGUOUS: Message.CHAT_AMBIGUOUS,
	WINDOW_MISMATCH: Message.WINDOW_MISMATCH,
	INPUT_NOT_FOUND: Message.INPUT_NOT_FOUND,
};

function toAppError(stderr: string): AppError {
	// -1719 only means an invalid index, so it must not be reported as a permission problem
	if (/-25211|-1743|not allowed assistive access|not authorized/i.test(stderr)) return new AppError(Message.ACCESSIBILITY_DENIED);
	for (const [marker, code] of Object.entries(KNOWN_ERRORS)) {
		if (stderr.includes(marker)) return new AppError(code);
	}
	return new AppError(Message.INPUT_NOT_FOUND, stderr.trim().slice(0, 200));
}

export function sendToChat(chatName: string, text: string, dryRun = false): Promise<void> {
	// checked here, below every caller, so no code path can reach the window of a blocked chat
	if (isBlockedChat(chatName)) return Promise.reject(new AppError(Message.CHAT_BLOCKED));
	assertAppInstalled();
	return new Promise((resolve, reject) => {
		execFile(
			'/usr/bin/osascript',
			['-e', SEND_SCRIPT, chatName, text, dryRun ? '1' : '0'],
			{ timeout: env.scriptTimeoutMs },
			(error, _stdout, stderr) => {
				if (error) return reject(toAppError(stderr || error.message));
				resolve();
			},
		);
	});
}
