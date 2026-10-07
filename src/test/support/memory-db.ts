import Database from 'better-sqlite3-multiple-ciphers';
import type { KakaoDb } from '../../libs/database/kakao-db.js';

// a plain, unencrypted in-memory database with the subset of KakaoTalk's schema the queries touch.
// column names and the NTChatMeta "group title" type (3) are matched against a real database.
const SCHEMA = `
	CREATE TABLE NTChatRoom (
		chatId INTEGER PRIMARY KEY,
		type INTEGER,
		chatName TEXT,
		directChatMemberUserId INTEGER,
		linkId INTEGER DEFAULT 0,
		activeMembersCount INTEGER,
		countOfNewMessage INTEGER,
		lastUpdatedAt INTEGER
	);
	CREATE TABLE NTUser (
		userId INTEGER,
		linkId INTEGER DEFAULT 0,
		displayName TEXT,
		friendNickName TEXT,
		nickName TEXT,
		statusMessage TEXT,
		favorite INTEGER DEFAULT 0,
		hidden INTEGER DEFAULT 0,
		purged INTEGER DEFAULT 0
	);
	CREATE TABLE NTChatMessage (
		logId INTEGER PRIMARY KEY,
		chatId INTEGER,
		authorId INTEGER,
		message TEXT,
		type INTEGER,
		sentAt INTEGER
	);
	CREATE TABLE NTChatContext (
		userId INTEGER
	);
	CREATE TABLE NTChatMeta (
		chatId INTEGER,
		type INTEGER,
		revision INTEGER,
		content TEXT
	);
	CREATE TABLE NTOpenLink (
		linkId INTEGER PRIMARY KEY,
		linkName TEXT
	);
`;

export function createMemoryDb(): KakaoDb {
	const db = new Database(':memory:');
	db.exec(SCHEMA);
	return db;
}

export function seedMe(db: KakaoDb, userId: number): void {
	db.prepare('INSERT INTO NTChatContext (userId) VALUES (?)').run(userId);
}

export function seedUser(
	db: KakaoDb,
	row: {
		userId: number;
		displayName?: string | null;
		friendNickName?: string | null;
		nickName?: string | null;
		statusMessage?: string | null;
		favorite?: boolean;
		hidden?: boolean;
		purged?: boolean;
	},
): void {
	db.prepare(
		`INSERT INTO NTUser (userId, linkId, displayName, friendNickName, nickName, statusMessage, favorite, hidden, purged)
			VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		row.userId,
		row.displayName ?? null,
		row.friendNickName ?? null,
		row.nickName ?? null,
		row.statusMessage ?? null,
		row.favorite ? 1 : 0,
		row.hidden ? 1 : 0,
		row.purged ? 1 : 0,
	);
}

export function seedChat(
	db: KakaoDb,
	row: {
		chatId: number;
		type?: number;
		chatName?: string | null;
		directChatMemberUserId?: number | null;
		linkId?: number;
		memberCount?: number;
		unreadCount?: number;
		lastUpdatedAt?: number;
	},
): void {
	db.prepare(
		`INSERT INTO NTChatRoom (chatId, type, chatName, directChatMemberUserId, linkId, activeMembersCount, countOfNewMessage, lastUpdatedAt)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		row.chatId,
		row.type ?? 0,
		row.chatName ?? null,
		row.directChatMemberUserId ?? null,
		row.linkId ?? 0,
		row.memberCount ?? 1,
		row.unreadCount ?? 0,
		row.lastUpdatedAt ?? 0,
	);
}

export function seedMessage(
	db: KakaoDb,
	row: { logId: number; chatId: number; authorId: number; message?: string | null; type?: number; sentAt?: number },
): void {
	db.prepare('INSERT INTO NTChatMessage (logId, chatId, authorId, message, type, sentAt) VALUES (?, ?, ?, ?, ?, ?)').run(
		row.logId,
		row.chatId,
		row.authorId,
		row.message ?? null,
		row.type ?? 1,
		row.sentAt ?? 0,
	);
}

export function seedMetaTitle(db: KakaoDb, chatId: number, content: string, revision = 1): void {
	db.prepare('INSERT INTO NTChatMeta (chatId, type, revision, content) VALUES (?, 3, ?, ?)').run(chatId, revision, content);
}

export function seedOpenLink(db: KakaoDb, linkId: number, linkName: string): void {
	db.prepare('INSERT INTO NTOpenLink (linkId, linkName) VALUES (?, ?)').run(linkId, linkName);
}
