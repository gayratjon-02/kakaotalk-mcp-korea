import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readDeleteLimitMinutes } from '../account/app-info.js';
import { runMessageAction, type MessageActionKind } from '../automation/message-action.js';
import { isBlockedChat } from '../config/blocklist.js';
import { isChatBlocked } from '../database/blocked-chat.js';
import { resolveChat } from '../database/chat-repository.js';
import {
	findMyReply,
	hasShownText,
	isDeletedType,
	ownUserId,
	rawMessage,
	type RawMessage,
} from '../database/message-verify.js';
import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { fail, ok } from './tool-result.js';

const MESSAGE_ID = z.string().regex(/^\d{1,19}$/);
const WAIT_MS = 6000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(read: () => T | null | false, timeoutMs = WAIT_MS): Promise<T | null> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const value = read();
		if (value) return value;
		if (Date.now() >= deadline) return null;
		await sleep(400);
	}
}

// the chat and the message must belong together, the chat must not be blocked, and the message must show its text
function resolveTarget(chat: string, messageId: string): { chatName: string; message: RawMessage } {
	if (isBlockedChat(chat)) throw new AppError(Message.CHAT_BLOCKED);
	const target = resolveChat(chat);
	if (isChatBlocked(target)) throw new AppError(Message.CHAT_BLOCKED);
	const message = rawMessage(messageId);
	if (!message || message.chatId !== target.id || !hasShownText(message)) throw new AppError(Message.MESSAGE_NOT_ELIGIBLE);
	return { chatName: target.name, message };
}

const ageMinutes = (message: RawMessage) => Math.floor((Date.now() / 1000 - message.sentAt) / 60);

export function registerMessageActionTools(server: McpServer): void {
	server.registerTool(
		'kakao_delete_message',
		{
			title: 'Delete a message',
			description:
				'Delete one text message by its messageId. scope auto (default) deletes for everyone when KakaoTalk allows it, which is only for your own recent messages, ' +
				'and otherwise only for you. everyone fails when that is not offered; me deletes only for you. Deleting cannot be undone, and the other people keep their copy when only you delete. ' +
				'Call with confirm false first to see the exact message and what will happen; call with confirm true only after the user approved that.',
			inputSchema: {
				chat: z.string().min(1),
				messageId: MESSAGE_ID,
				scope: z.enum(['auto', 'everyone', 'me']).default('auto'),
				confirm: z.boolean().default(false),
			},
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
		},
		async ({ chat, messageId, scope, confirm }) => {
			try {
				const { chatName, message } = resolveTarget(chat, messageId);
				const mine = message.authorId === ownUserId();
				const limit = readDeleteLimitMinutes();
				const everyonePossible = mine && ageMinutes(message) < limit;
				if (!confirm) {
					return ok({
						preview: true,
						chat: chatName,
						messageId,
						text: message.text,
						own: mine,
						ageMinutes: ageMinutes(message),
						deleteForEveryoneLikely: everyonePossible,
						deleteForEveryoneLimitMinutes: limit,
						scope,
						note: t(Message.SEND_NOT_CONFIRMED, env.lang),
					});
				}
				const action: MessageActionKind = scope === 'everyone' ? 'delete-everyone' : scope === 'me' ? 'delete-me' : 'delete-auto';
				const reply = await runMessageAction({ chatName, target: message, action });
				const done = await waitFor(() => {
					const now = rawMessage(messageId);
					return !now || isDeletedType(now.type);
				});
				if (!done) throw new AppError(Message.ACTION_NOT_CONFIRMED);
				return ok({ deleted: true, applied: reply.applied, chat: chatName, messageId });
			} catch (error) {
				return fail(error);
			}
		},
	);

	server.registerTool(
		'kakao_reply_message',
		{
			title: 'Reply to a specific message',
			description:
				'Send a reply that quotes one specific text message, by its messageId. Call with confirm false first to see the quoted message and your text; ' +
				'call with confirm true only after the user approved that exact text.',
			inputSchema: {
				chat: z.string().min(1),
				messageId: MESSAGE_ID,
				text: z.string().min(1).max(4000),
				confirm: z.boolean().default(false),
			},
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		},
		async ({ chat, messageId, text, confirm }) => {
			try {
				const { chatName, message } = resolveTarget(chat, messageId);
				if (!confirm) {
					return ok({ preview: true, chat: chatName, quoting: message.text, yourReply: text, note: t(Message.SEND_NOT_CONFIRMED, env.lang) });
				}
				const since = Math.floor(Date.now() / 1000) - 2;
				await runMessageAction({ chatName, target: message, action: 'reply', replyText: text });
				const sent = await waitFor(() => findMyReply(message.chatId, messageId, text, since));
				if (!sent) throw new AppError(Message.ACTION_NOT_CONFIRMED);
				return ok({ replied: true, chat: chatName, quotedMessageId: messageId, replyMessageId: sent.id });
			} catch (error) {
				return fail(error);
			}
		},
	);

	server.registerTool(
		'kakao_react_message',
		{
			title: 'React to a message',
			description:
				'Add a reaction to one text message by its messageId. reactionIndex is the position in KakaoTalk\'s reaction picker, counted from 0 (the picker offers about 44). ' +
				'Call with confirm false first, then with confirm true after the user approved.',
			inputSchema: {
				chat: z.string().min(1),
				messageId: MESSAGE_ID,
				reactionIndex: z.number().int().min(0).max(100).default(0),
				confirm: z.boolean().default(false),
			},
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		},
		async ({ chat, messageId, reactionIndex, confirm }) => {
			try {
				const { chatName, message } = resolveTarget(chat, messageId);
				if (!confirm) {
					return ok({ preview: true, chat: chatName, message: message.text, reactionIndex, note: t(Message.SEND_NOT_CONFIRMED, env.lang) });
				}
				const before = message.supplement;
				const reply = await runMessageAction({ chatName, target: message, action: 'react', reactionIndex });
				const changed = await waitFor(() => rawMessage(messageId)?.supplement !== before, 4000);
				return ok({ reacted: true, chat: chatName, messageId, reactionIndex, offered: reply.offered, confirmedByDatabase: Boolean(changed) });
			} catch (error) {
				return fail(error);
			}
		},
	);
}
