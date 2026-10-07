import { getDb } from './connection.js';

// a stored kind at or above this value has the "deleted for everyone" flag set
export const DELETED_FLAG = 16384;
const TEXT_KIND = 1;
const REPLY_KIND = 26;

export type RawMessage = {
	id: string;
	chatId: string;
	authorId: string;
	type: number;
	text: string | null;
	sentAt: number;
	attachment: string | null;
	supplement: string | null;
};

const SELECT = `SELECT CAST(logId AS TEXT) AS id, CAST(chatId AS TEXT) AS chatId, CAST(authorId AS TEXT) AS authorId,
	type, message AS text, sentAt, attachment, supplement FROM NTChatMessage`;

export const isDeletedType = (type: number) => type >= DELETED_FLAG;
export const baseType = (type: number) => (isDeletedType(type) ? type - DELETED_FLAG : type);

export function rawMessage(id: string): RawMessage | null {
	return (getDb().prepare(`${SELECT} WHERE logId = ?`).get(id) as RawMessage | undefined) ?? null;
}

export function ownUserId(): string {
	return (getDb().prepare('SELECT CAST(userId AS TEXT) AS id FROM NTChatContext LIMIT 1').get() as { id: string }).id;
}

// only live text messages and replies carry text that the window shows verbatim
export function hasShownText(message: RawMessage): boolean {
	return !isDeletedType(message.type) && [TEXT_KIND, REPLY_KIND].includes(baseType(message.type)) && Boolean(message.text);
}

// how many newer, live messages in the chat have exactly the same text; the window search counts from the newest
export function newerIdenticalCopies(target: RawMessage): number {
	const row = getDb()
		.prepare(
			`SELECT COUNT(*) AS c FROM NTChatMessage
			WHERE chatId = ? AND message = ? AND type < ${DELETED_FLAG} AND (sentAt > ? OR (sentAt = ? AND logId > ?))`,
		)
		.get(target.chatId, target.text, target.sentAt, target.sentAt, target.id) as { c: number };
	return row.c;
}

// the reply I just sent to `targetId`: a reply kind message of mine, same text, pointing at the target
export function findMyReply(chatId: string, targetId: string, text: string, sinceSeconds: number): RawMessage | null {
	const rows = getDb()
		.prepare(`${SELECT} WHERE chatId = ? AND authorId = ? AND type IN (?, ?) AND message = ? AND sentAt >= ? ORDER BY logId DESC LIMIT 5`)
		.all(chatId, ownUserId(), REPLY_KIND, REPLY_KIND + DELETED_FLAG, text, sinceSeconds) as RawMessage[];
	return (
		rows.find((row) => {
			try {
				return String((JSON.parse(row.attachment ?? '') as { src_logId?: unknown }).src_logId) === targetId;
			} catch {
				return false;
			}
		}) ?? null
	);
}
