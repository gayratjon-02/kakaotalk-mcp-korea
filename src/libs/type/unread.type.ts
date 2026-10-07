import type { ChatMessage } from './message.type.js';

export type UnreadChat = {
	chatId: string;
	chatName: string;
	unreadCount: number;
	lastMessageAt: string | null;
	messages: ChatMessage[];
};
