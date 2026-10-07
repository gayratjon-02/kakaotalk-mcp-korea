import { MESSAGE_KIND_LABEL } from '../enum/message-kind.enum.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import type { Chat } from '../type/chat.type.js';
import type { ChatMessage } from '../type/message.type.js';
import { getDb } from './connection.js';

const MAX_LIMIT = 500;

const SENDER_NAME = 'COALESCE(u.displayName, u.friendNickName, u.nickName)';

const MESSAGE_SELECT = `
	SELECT CAST(m.logId AS TEXT) AS id, CAST(m.chatId AS TEXT) AS chatId,
		CAST(m.authorId AS TEXT) AS senderId, ${SENDER_NAME} AS senderName,
		m.message AS text, m.type AS kind, m.sentAt AS sentAt
	FROM NTChatMessage m
	LEFT JOIN NTUser u ON m.authorId = u.userId AND u.linkId = 0`;

type MessageRow = {
	id: string;
	chatId: string;
	senderId: string;
	senderName: string | null;
	text: string | null;
	kind: number;
	sentAt: number;
};

function clamp(limit: number): number {
	return Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LIMIT);
}

// timestamps are stored as seconds since epoch
function iso(seconds: number): string {
	return new Date(seconds * 1000).toISOString();
}

function myUserId(): string {
	const row = getDb().prepare('SELECT CAST(userId AS TEXT) AS id FROM NTChatContext LIMIT 1').get() as
		| { id: string }
		| undefined;
	return row?.id ?? '0';
}

function toMessage(row: MessageRow, me: string): ChatMessage {
	return {
		id: row.id,
		chatId: row.chatId,
		senderId: row.senderId,
		senderName: row.senderName,
		fromMe: row.senderId === me,
		kind: MESSAGE_KIND_LABEL[row.kind] ?? 'unknown',
		text: row.text,
		sentAt: iso(row.sentAt),
	};
}

export function listChats(limit = 50): Chat[] {
	const rows = getDb()
		.prepare(
			`SELECT CAST(r.chatId AS TEXT) AS id, r.type AS type, r.chatName AS chatName,
				COALESCE(u.displayName, u.friendNickName, u.nickName) AS peerName,
				r.activeMembersCount AS memberCount, r.countOfNewMessage AS unreadCount,
				r.lastUpdatedAt AS lastAt
			FROM NTChatRoom r
			LEFT JOIN NTUser u ON r.directChatMemberUserId = u.userId AND u.linkId = 0
			ORDER BY r.lastUpdatedAt DESC LIMIT ?`,
		)
		.all(clamp(limit)) as Array<{
		id: string;
		type: number;
		chatName: string | null;
		peerName: string | null;
		memberCount: number;
		unreadCount: number;
		lastAt: number;
	}>;
	return rows.map((row) => ({
		id: row.id,
		name: row.chatName || row.peerName || '(unknown)',
		type: row.type,
		memberCount: row.memberCount,
		unreadCount: row.unreadCount,
		lastMessageAt: row.lastAt ? iso(row.lastAt) : null,
	}));
}

// exact id, then exact name, then a single substring match; anything else is ambiguous
export function resolveChat(query: string): Chat {
	const chats = listChats(MAX_LIMIT);
	const needle = query.trim().toLowerCase();
	const exact = chats.filter((chat) => chat.id === query.trim() || chat.name.toLowerCase() === needle);
	const pool = exact.length > 0 ? exact : chats.filter((chat) => chat.name.toLowerCase().includes(needle));
	if (pool.length === 0) throw new AppError(Message.CHAT_NOT_FOUND);
	if (pool.length > 1) throw new AppError(Message.CHAT_AMBIGUOUS, pool.slice(0, 5).map((c) => c.name).join(', '));
	return pool[0];
}

export function listMessages(options: { chatId?: string; sinceSeconds?: number; limit?: number }): ChatMessage[] {
	const where: string[] = [];
	const params: Array<string | number> = [];
	if (options.chatId) {
		where.push('m.chatId = ?');
		params.push(options.chatId);
	}
	if (options.sinceSeconds !== undefined) {
		where.push('m.sentAt >= ?');
		params.push(options.sinceSeconds);
	}
	const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const rows = getDb()
		.prepare(`${MESSAGE_SELECT} ${clause} ORDER BY m.sentAt DESC LIMIT ?`)
		.all(...params, clamp(options.limit ?? 50)) as MessageRow[];
	const me = myUserId();
	return rows.map((row) => toMessage(row, me));
}

export function searchMessages(text: string, limit = 20): ChatMessage[] {
	const escaped = text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
	const rows = getDb()
		.prepare(`${MESSAGE_SELECT} WHERE m.message LIKE ? ESCAPE '\\' ORDER BY m.sentAt DESC LIMIT ?`)
		.all(`%${escaped}%`, clamp(limit)) as MessageRow[];
	const me = myUserId();
	return rows.map((row) => toMessage(row, me));
}

export function maxLogId(): string {
	const row = getDb().prepare('SELECT CAST(MAX(logId) AS TEXT) AS id FROM NTChatMessage').get() as {
		id: string | null;
	};
	return row.id ?? '0';
}

// oldest first, so a stream can resume from the last id it delivered
export function messagesAfter(logId: string, limit = 100): ChatMessage[] {
	const rows = getDb()
		.prepare(`${MESSAGE_SELECT} WHERE m.logId > ? ORDER BY m.logId ASC LIMIT ?`)
		.all(logId, clamp(limit)) as MessageRow[];
	const me = myUserId();
	return rows.map((row) => toMessage(row, me));
}
