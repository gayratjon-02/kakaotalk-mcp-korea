import { readAppInfo, readLoginId } from '../account/app-info.js';
import type {
	AccountInfo,
	ChatSummary,
	ContactProfile,
	ContactSummary,
	OpenProfile,
	OwnProfile,
} from '../type/account-info.type.js';
import { readDesktopBinding } from '../device/desktop-binding.js';
import { listChats } from './chat-repository.js';
import { getDb } from './connection.js';

type Count = { c: number };
const iso = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);

function count(sql: string, ...params: Array<string | number>): number {
	return (getDb().prepare(sql).get(...params) as Count).c;
}

// phone based accounts log in with the number in international form, e.g. 821000000002
export function phoneFromLoginId(loginId: string | null): string | null {
	return loginId && /^\d{9,15}$/.test(loginId) ? `+${loginId}` : null;
}

export function readOwnProfile(): OwnProfile {
	const db = getDb();
	const me = (db.prepare('SELECT CAST(userId AS TEXT) AS id FROM NTChatContext LIMIT 1').get() as { id: string }).id;
	const rows = db
		.prepare(
			`SELECT CAST(linkId AS TEXT) AS linkId, CAST(accountId AS TEXT) AS accountId,
				COALESCE(NULLIF(displayName, ''), NULLIF(nickName, '')) AS name,
				statusMessage, profileImageUrl, fullProfileImageUrl, phoneNumber
			FROM NTUser WHERE userId = ?`,
		)
		.all(me) as Array<{
		linkId: string;
		accountId: string | null;
		name: string | null;
		statusMessage: string | null;
		profileImageUrl: string | null;
		fullProfileImageUrl: string | null;
		phoneNumber: string | null;
	}>;
	const main = rows.find((row) => row.linkId === '0');
	const loginId = readLoginId();
	const openProfiles: OpenProfile[] = rows
		.filter((row) => row.linkId !== '0')
		.map((row) => ({ linkId: row.linkId, name: row.name, imageUrl: row.fullProfileImageUrl || row.profileImageUrl || null }));
	return {
		userId: me,
		accountId: main?.accountId && main.accountId !== '0' ? main.accountId : null,
		name: main?.name ?? null,
		statusMessage: main?.statusMessage || null,
		profileImageUrl: main?.fullProfileImageUrl || main?.profileImageUrl || null,
		phoneNumber: main?.phoneNumber || phoneFromLoginId(loginId),
		loginId,
		openProfiles,
	};
}

function chatSummary(): ChatSummary {
	const chats = listChats(500);
	const folders = getDb()
		.prepare("SELECT name FROM NTChatFolder WHERE hidden = 0 AND name IS NOT NULL AND name <> '' ORDER BY sortOrder")
		.all() as Array<{ name: string }>;
	return {
		total: chats.length,
		direct: chats.filter((chat) => chat.kind === 'direct').length,
		group: chats.filter((chat) => chat.kind === 'group').length,
		open: chats.filter((chat) => chat.kind === 'open').length,
		chatsWithUnread: chats.filter((chat) => chat.unreadCount > 0).length,
		unreadMessages: chats.reduce((sum, chat) => sum + chat.unreadCount, 0),
		folders: folders.map((folder) => folder.name),
	};
}

function contactSummary(me: string): ContactSummary {
	const rows = getDb()
		.prepare('SELECT friendType AS t, COUNT(*) AS c FROM NTUser WHERE linkId = 0 AND purged = 0 AND userId <> ? GROUP BY friendType')
		.all(me) as Array<{ t: number; c: number }>;
	return {
		total: rows.reduce((sum, row) => sum + row.c, 0),
		favorites: count('SELECT COUNT(*) AS c FROM NTUser WHERE linkId = 0 AND purged = 0 AND favorite = 1 AND userId <> ?', me),
		hidden: count('SELECT COUNT(*) AS c FROM NTUser WHERE linkId = 0 AND purged = 0 AND hidden = 1 AND userId <> ?', me),
		byFriendType: Object.fromEntries(rows.map((row) => [String(row.t), row.c])),
	};
}

export function readAccountInfo(): AccountInfo {
	const profile = readOwnProfile();
	const span = getDb().prepare('SELECT COUNT(*) AS total, MIN(sentAt) AS first, MAX(sentAt) AS last FROM NTChatMessage').get() as {
		total: number;
		first: number | null;
		last: number | null;
	};
	return {
		desktop: readDesktopBinding(),
		profile,
		app: readAppInfo(),
		chats: chatSummary(),
		contacts: contactSummary(profile.userId),
		messages: { total: span.total, firstAt: iso(span.first), lastAt: iso(span.last) },
		files: { total: count('SELECT COUNT(*) AS c FROM NTChatMessage WHERE type IN (18, 16402)') },
		calendar: { calendars: count('SELECT COUNT(*) AS c FROM NTCalendar'), events: count('SELECT COUNT(*) AS c FROM NTEvent') },
	};
}

// one contact by id or by exact/partial name; phone numbers of other people are deliberately not returned
export function findContact(query: string): ContactProfile[] {
	const needle = `%${query.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
	const rows = getDb()
		.prepare(
			`SELECT CAST(userId AS TEXT) AS userId, displayName, friendNickName, nickName, statusMessage,
				COALESCE(NULLIF(fullProfileImageUrl, ''), NULLIF(profileImageUrl, '')) AS image, favorite, hidden
			FROM NTUser
			WHERE linkId = 0 AND purged = 0
				AND (CAST(userId AS TEXT) = ? OR friendNickName LIKE ? ESCAPE '\\' OR displayName LIKE ? ESCAPE '\\' OR nickName LIKE ? ESCAPE '\\')
			ORDER BY favorite DESC LIMIT 10`,
		)
		.all(query.trim(), needle, needle, needle) as Array<{
		userId: string;
		displayName: string | null;
		friendNickName: string | null;
		nickName: string | null;
		statusMessage: string | null;
		image: string | null;
		favorite: number;
		hidden: number;
	}>;
	return rows.map((row) => ({
		userId: row.userId,
		name: row.friendNickName || row.displayName || row.nickName || '(unknown)',
		displayName: row.displayName || null,
		friendNickName: row.friendNickName || null,
		statusMessage: row.statusMessage || null,
		profileImageUrl: row.image,
		favorite: Boolean(row.favorite),
		hidden: Boolean(row.hidden),
	}));
}
