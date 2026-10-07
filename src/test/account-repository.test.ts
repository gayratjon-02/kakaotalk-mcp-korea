import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { findContact, readAccountInfo } from '../libs/database/account-repository.js';
import { useDb } from '../libs/database/connection.js';
import type { KakaoDb } from '../libs/database/kakao-db.js';
import {
	createMemoryDb,
	seedCalendar,
	seedChat,
	seedEvent,
	seedFolder,
	seedMe,
	seedMessage,
	seedUser,
} from './support/memory-db.js';

const ME = 1;

let db: KakaoDb;

beforeEach(() => {
	db = createMemoryDb();
	useDb(db);
});

afterEach(() => {
	useDb(null);
	db.close();
});

// readOwnProfile()/readAccountInfo() also read the real KakaoTalk login id from this machine's
// preferences (see account/app-info.ts) — that part is environment-dependent and covered
// separately by account-info.test.ts's phoneFromLoginId tests, not asserted on here.
test('readAccountInfo counts chats by kind, unread totals and folders', () => {
	seedMe(db, ME);
	seedUser(db, { userId: ME, phoneNumber: '+821000000000' });
	seedUser(db, { userId: 10, friendNickName: 'Friend' });
	seedChat(db, { chatId: 1, type: 2, directChatMemberUserId: 10, unreadCount: 2, lastUpdatedAt: 300 });
	seedChat(db, { chatId: 2, type: 1, chatName: 'Team', unreadCount: 0, lastUpdatedAt: 200 });
	seedChat(db, { chatId: 3, type: 4, linkId: 777, chatName: 'Open', unreadCount: 5, lastUpdatedAt: 100 });
	seedFolder(db, 'Work', false, 1);
	seedFolder(db, 'Hidden folder', true, 2);

	const info = readAccountInfo();
	assert.equal(info.profile.phoneNumber, '+821000000000');
	assert.deepEqual(
		{ total: info.chats.total, direct: info.chats.direct, group: info.chats.group, open: info.chats.open },
		{ total: 3, direct: 1, group: 1, open: 1 },
	);
	assert.equal(info.chats.chatsWithUnread, 2);
	assert.equal(info.chats.unreadMessages, 7);
	assert.deepEqual(info.chats.folders, ['Work']);
});

test('readAccountInfo counts contacts, excluding myself and purged rows, by friend type', () => {
	seedMe(db, ME);
	seedUser(db, { userId: ME });
	seedUser(db, { userId: 10, nickName: 'A', friendType: 1, favorite: true });
	seedUser(db, { userId: 11, nickName: 'B', friendType: 1 });
	seedUser(db, { userId: 12, nickName: 'C', friendType: 2, hidden: true });
	seedUser(db, { userId: 13, nickName: 'Gone', friendType: 1, purged: true });

	const info = readAccountInfo();
	assert.equal(info.contacts.total, 3);
	assert.equal(info.contacts.favorites, 1);
	assert.equal(info.contacts.hidden, 1);
	assert.deepEqual(info.contacts.byFriendType, { '1': 2, '2': 1 });
});

test('readAccountInfo counts messages, files and calendar entries', () => {
	seedMe(db, ME);
	seedUser(db, { userId: ME });
	seedMessage(db, { logId: 1, chatId: 1, authorId: ME, type: 1, sentAt: 10 });
	seedMessage(db, { logId: 2, chatId: 1, authorId: ME, type: 1, sentAt: 20 });
	seedMessage(db, { logId: 3, chatId: 1, authorId: ME, type: 18, sentAt: 30 });
	seedCalendar(db, 1);
	seedEvent(db, 1, 1);
	seedEvent(db, 2, 1);

	const info = readAccountInfo();
	assert.equal(info.messages.total, 3);
	assert.equal(info.files.total, 1);
	assert.equal(info.calendar.calendars, 1);
	assert.equal(info.calendar.events, 2);
});

test('findContact matches by exact user id', () => {
	seedUser(db, { userId: 10, nickName: 'Alice' });
	seedUser(db, { userId: 11, nickName: 'Carol' });
	const results = findContact('10');
	assert.equal(results.length, 1);
	assert.equal(results[0].userId, '10');
});

test('findContact matches a partial, case-insensitive name and ranks favorites first', () => {
	seedUser(db, { userId: 10, friendNickName: 'alice smith' });
	seedUser(db, { userId: 11, friendNickName: 'Alice Lee', favorite: true });
	const results = findContact('alice');
	assert.deepEqual(
		results.map((r) => r.userId),
		['11', '10'],
	);
});

test('findContact never returns a phone number field', () => {
	seedUser(db, { userId: 10, nickName: 'Alice', phoneNumber: '+821000000001' });
	const [contact] = findContact('Alice');
	assert.deepEqual(Object.keys(contact).sort(), [
		'displayName',
		'favorite',
		'friendNickName',
		'hidden',
		'name',
		'profileImageUrl',
		'statusMessage',
		'userId',
	]);
});

test('findContact excludes purged contacts', () => {
	seedUser(db, { userId: 10, nickName: 'Gone', purged: true });
	assert.deepEqual(findContact('Gone'), []);
});
