import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { isChatBlocked } from '../libs/database/blocked-chat.js';
import { useDb } from '../libs/database/connection.js';
import type { Chat } from '../libs/type/chat.type.js';
import { createMemoryDb, seedChat, seedMe, seedUser } from './support/memory-db.js';

process.env.KAKAOTALK_BLOCKED_CHATS = 'Test Person';

const chat = (id: number, name: string): Chat => ({
	id: String(id),
	name,
	type: 0,
	memberCount: 2,
	unreadCount: 0,
	lastMessageAt: null,
});

beforeEach(() => {
	const db = createMemoryDb();
	seedMe(db, 1);
	// same first name, different people: only the second one is blocked
	seedUser(db, { userId: 10, displayName: 'Test', friendNickName: 'Test', nickName: 'brother' });
	seedUser(db, { userId: 20, displayName: 'Test Person', friendNickName: 'Test Person', nickName: 'x' });
	// a contact whose chat title shows an alias but whose profile name is blocked
	seedUser(db, { userId: 30, displayName: 'Alias', friendNickName: 'Alias', nickName: 'Test Person' });
	seedChat(db, { chatId: 100, directChatMemberUserId: 10 });
	seedChat(db, { chatId: 200, directChatMemberUserId: 20 });
	seedChat(db, { chatId: 300, directChatMemberUserId: 30 });
	useDb(db);
});

afterEach(() => useDb(null));

test('the chat with a similarly named but different person stays allowed', () => {
	assert.equal(isChatBlocked(chat(100, 'Test')), false);
});

test('a chat named after the blocked person is blocked', () => {
	assert.equal(isChatBlocked(chat(200, 'Test Person')), true);
});

test('a direct chat is blocked by the peer profile even when the chat title is an alias', () => {
	assert.equal(isChatBlocked(chat(300, 'Alias')), true);
});
