import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { listChats, listMessages } from '../libs/database/chat-repository.js';
import { useDb } from '../libs/database/connection.js';
import { createMemoryDb, seedChat, seedMe, seedMessage, seedUser } from './support/memory-db.js';

const ME = 1;
const OPEN_LINK = 777;

beforeEach(() => {
	const db = createMemoryDb();
	seedMe(db, ME);
	seedUser(db, { userId: 10, friendNickName: 'Friend' });
	// the same person has a normal profile and a separate profile inside the open chat
	seedUser(db, { userId: 20, linkId: 0, displayName: 'Real Name' });
	seedUser(db, { userId: 20, linkId: OPEN_LINK, nickName: 'Open Alias' });
	seedChat(db, { chatId: 1, type: 2, directChatMemberUserId: 10, memberCount: 2, lastUpdatedAt: 400 });
	seedChat(db, { chatId: 2, type: 1, chatName: 'Team', memberCount: 12, lastUpdatedAt: 300 });
	seedChat(db, { chatId: 3, type: 2, chatName: 'Trio', memberCount: 3, lastUpdatedAt: 200 });
	seedChat(db, { chatId: 4, type: 4, linkId: OPEN_LINK, chatName: 'Community', memberCount: 29, lastUpdatedAt: 100 });
	seedMessage(db, { logId: 1, chatId: 4, authorId: 20, message: 'hi', type: 1, sentAt: 50 });
	useDb(db);
});

afterEach(() => useDb(null));

test('chats are classified as direct, group or open', () => {
	const kinds = Object.fromEntries(listChats(10).map((chat) => [chat.id, chat.kind]));
	assert.deepEqual(kinds, { '1': 'direct', '2': 'group', '3': 'group', '4': 'open' });
});

test('scope filters the chat list', () => {
	assert.deepEqual(listChats(10, 'group').map((chat) => chat.id), ['2', '3']);
	assert.deepEqual(listChats(10, 'open').map((chat) => chat.id), ['4']);
	assert.deepEqual(listChats(10, 'direct').map((chat) => chat.id), ['1']);
});

test('an open chat message shows the open chat alias and is not duplicated', () => {
	const messages = listMessages({ chatId: '4' });
	assert.equal(messages.length, 1);
	assert.equal(messages[0].senderName, 'Open Alias');
});
