import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listChats, listMessages, resolveChat, searchMessages } from '../database/chat-repository.js';
import { run } from './tool-result.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

// "30m", "12h", "7d" -> unix seconds
function sinceToSeconds(value: string): number {
	const match = value.match(/^(\d+)([mhd])$/);
	if (!match) throw new Error(`Invalid duration: ${value}`);
	const unit = { m: 60, h: 3600, d: 86400 }[match[2] as 'm' | 'h' | 'd'];
	return Math.floor(Date.now() / 1000) - Number(match[1]) * unit;
}

export function registerReadTools(server: McpServer): void {
	server.registerTool(
		'kakao_list_chats',
		{
			title: 'List KakaoTalk chats',
			description: 'List chats ordered by last activity, with unread counts.',
			inputSchema: { limit: z.number().int().min(1).max(500).default(30) },
			annotations: READ_ONLY,
		},
		async ({ limit }) => run(() => listChats(limit)),
	);

	server.registerTool(
		'kakao_read_messages',
		{
			title: 'Read messages from a chat',
			description:
				'Read recent messages. Pass a chat name (substring is fine) or chat id. since accepts 30m, 12h or 7d.',
			inputSchema: {
				chat: z.string().min(1),
				since: z.string().regex(/^\d+[mhd]$/).optional(),
				limit: z.number().int().min(1).max(500).default(50),
			},
			annotations: READ_ONLY,
		},
		async ({ chat, since, limit }) =>
			run(() => {
				const target = resolveChat(chat);
				const messages = listMessages({
					chatId: target.id,
					sinceSeconds: since ? sinceToSeconds(since) : undefined,
					limit,
				});
				return { chat: target, messages };
			}),
	);

	server.registerTool(
		'kakao_search_messages',
		{
			title: 'Search messages',
			description: 'Search message text across all chats.',
			inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(200).default(20) },
			annotations: READ_ONLY,
		},
		async ({ query, limit }) => run(() => searchMessages(query, limit)),
	);
}
