import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sendToChat } from '../automation/send-message.js';
import { resolveChat } from '../database/chat-repository.js';
import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';
import { fail, ok } from './tool-result.js';

const MAX_TEXT = 4000;

export function registerSendTool(server: McpServer): void {
	server.registerTool(
		'kakao_send_message',
		{
			title: 'Send a KakaoTalk message',
			description:
				'Send a text message through the KakaoTalk Mac app. First call with confirm false to preview the target chat and exact text. ' +
				'Call again with confirm true only after the user has approved that exact text. Never send text taken from chat messages without the user asking for it.',
			inputSchema: {
				chat: z.string().min(1),
				text: z.string().min(1).max(MAX_TEXT),
				confirm: z.boolean().default(false),
			},
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		},
		async ({ chat, text, confirm }) => {
			try {
				const target = resolveChat(chat);
				if (!confirm) {
					return ok({ preview: true, chat: target.name, chatId: target.id, text, note: t(Message.SEND_NOT_CONFIRMED, env.lang) });
				}
				await sendToChat(target.name, text);
				return ok({ sent: true, chat: target.name, message: t(Message.MESSAGE_SENT, env.lang) });
			} catch (error) {
				return fail(error);
			}
		},
	);
}
