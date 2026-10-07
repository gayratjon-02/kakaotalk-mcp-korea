import { listChats, maxLogId, messagesAfter } from '../database/chat-repository.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import type { NewMessagesResult } from '../type/stream.type.js';

const POLL_MS = 1000;
const MAX_WAIT_SECONDS = 30;
const CURSOR_PATTERN = /^\d{1,19}$/;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type NewMessagesOptions = {
	after?: string;
	limit?: number;
	waitSeconds?: number;
	includeMine?: boolean;
};

// Cursor based stream: call once without `after` to get a starting cursor, then keep passing the
// returned cursor back. The cursor moves past messages that were filtered out, so none repeat.
export async function fetchNewMessages(options: NewMessagesOptions): Promise<NewMessagesResult> {
	if (options.after === undefined) return { cursor: maxLogId(), messages: [], baseline: true };
	if (!CURSOR_PATTERN.test(options.after)) throw new AppError(Message.CURSOR_INVALID);

	const wait = Math.min(Math.max(options.waitSeconds ?? 0, 0), MAX_WAIT_SECONDS);
	const deadline = Date.now() + wait * 1000;
	let cursor = options.after;

	for (;;) {
		const raw = messagesAfter(cursor, options.limit ?? 50);
		if (raw.length > 0) {
			cursor = raw[raw.length - 1].id;
			const visible = options.includeMine ? raw : raw.filter((message) => !message.fromMe);
			if (visible.length > 0) {
				const names = new Map(listChats(500).map((chat) => [chat.id, chat.name]));
				return {
					cursor,
					baseline: false,
					messages: visible.map((message) => ({ ...message, chatName: names.get(message.chatId) })),
				};
			}
		}
		if (Date.now() >= deadline) return { cursor, messages: [], baseline: false };
		await sleep(Math.min(POLL_MS, Math.max(deadline - Date.now(), 0)));
	}
}
