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

// Deleting for everyone leaves a companion feed row (type 0, feedType 14) naming the message; deleting only for me sets status 2.
// The 16384 bit on the stored kind is NOT a deletion marker by itself: long messages carry it too.
export const DELETE_FEED = `f.type = 0 AND f.message LIKE '%"feedType":14%'`;

export function deletedForEveryone(id: string): boolean {
	const row = getDb()
		.prepare(`SELECT COUNT(*) AS c FROM NTChatMessage f WHERE ${DELETE_FEED} AND f.message LIKE ?`)
		.get(`%"logId":${id}%`) as { c: number };
	return row.c > 0;
}

// gone from the database, or hidden for this account only
export function deletedForMe(id: string): boolean {
	const row = rawMessage(id);
	return !row || (getDb().prepare('SELECT status FROM NTChatMessage WHERE logId = ?').get(id) as { status: number }).status === 2;
}

// only live text messages and replies carry text that the window shows verbatim
export function hasShownText(message: RawMessage): boolean {
	return (
		[TEXT_KIND, REPLY_KIND].includes(baseType(message.type)) &&
		Boolean(message.text) &&
		!deletedForEveryone(message.id) &&
		!deletedForMe(message.id)
	);
}

// how many newer, live messages in the chat have exactly the same text; the window search counts from the newest
export function newerIdenticalCopies(target: RawMessage): number {
	const row = getDb()
		.prepare(
			`SELECT COUNT(*) AS c FROM NTChatMessage
			WHERE chatId = ? AND message = ? AND status <> 2 AND (sentAt > ? OR (sentAt = ? AND logId > ?))
			AND NOT EXISTS (SELECT 1 FROM NTChatMessage f WHERE ${DELETE_FEED} AND f.message LIKE '%"logId":' || NTChatMessage.logId || '%')`,
		)
		.get(target.chatId, target.text, target.sentAt, target.sentAt, target.id) as { c: number };
	return row.c;
}

// the reply I just sent to `targetId`: a reply kind message of mine, same text, pointing at the target
export function findMyReply(chatId: string, targetId: string, text: string, sinceSeconds: number): RawMessage | null {
	const rows = getDb()
		.prepare(`${SELECT} WHERE chatId = ? AND authorId = ? AND type IN (?, ?) AND message = ? AND sentAt >= ? ORDER BY logId DESC LIMIT 5`)
		.all(chatId, ownUserId(), REPLY_KIND, REPLY_KIND + DELETED_FLAG, text, sinceSeconds) as RawMessage[];
	return rows.find((row) => sourceLogId(row.attachment) === targetId) ?? null;
}

// Message ids are 19 digits, beyond what a JSON number holds exactly, so JSON.parse rounds them (...537 becomes ...500).
// The id is therefore read from the raw attachment text as a string.
export function sourceLogId(attachment: string | null): string | null {
	return attachment?.match(/"src_logId"\s*:\s*(\d+)/)?.[1] ?? null;
}

export type Reaction = { id: string; label: string | null };

// Reactions live in NTChatLogMeta (type 2): `content` holds everyone's reactions, `extra.myRx` the connected account's.
export function myReactions(messageId: string): Reaction[] {
	const row = getDb().prepare('SELECT content, extra FROM NTChatLogMeta WHERE logId = ? AND type = 2').get(messageId) as
		| { content: string | null; extra: string | null }
		| undefined;
	if (!row) return [];
	try {
		const mine = (JSON.parse(row.extra ?? '{}') as { myRx?: Array<{ o?: string }> }).myRx ?? [];
		const shown = (JSON.parse(row.content ?? '{}') as { rx?: Array<{ o?: string; a?: Record<string, string> }> }).rx ?? [];
		return mine.flatMap((item) => {
			if (!item.o) return [];
			const label = shown.find((entry) => entry.o === item.o)?.a;
			return [{ id: item.o, label: label ? (Object.values(label)[0] ?? null) : null }];
		});
	} catch {
		return [];
	}
}
