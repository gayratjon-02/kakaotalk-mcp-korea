import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
	listChats,
	listMessages,
	resolveChat,
	searchMessages,
	unreadSummary,
} from '../libs/database/chat-repository.js';
import { useDb } from '../libs/database/connection.js';
import type { KakaoDb } from '../libs/database/kakao-db.js';
import { createMemoryDb, seedChat, seedMe, seedMessage, seedMetaTitle, seedOpenLink, seedUser } from './support/memory-db.js';

const ME = 1;
const FRIEND = 2;

let db: KakaoDb;

beforeEach(() => {
	db = createMemoryDb();
	useDb(db);
});

afterEach(() => {
	useDb(null);
	db.close();
});

test('listChats names a direct chat after the peer when chatName is empty', () => {
	seedUser(db, { userId: FRIEND, friendNickName: 'Alice' });
	seedChat(db, { chatId: 10, type: 0, chatName: null, directChatMemberUserId: FRIEND, lastUpdatedAt: 100 });

	const [chat] = listChats();
	assert.equal(chat.name, 'Alice');
});

test('listChats falls back to the NTChatMeta group title, then the open chat name', () => {
	seedChat(db, { chatId: 20, type: 1, chatName: null, lastUpdatedAt: 100 });
	seedMetaTitle(db, 20, 'Alice x Bob x Carol');

	seedChat(db, { chatId: 30, type: 2, chatName: null, linkId: 5, lastUpdatedAt: 100 });
	seedOpenLink(db, 5, 'PEARLYjams open chat');

	const chats = listChats();
	assert.equal(chats.find((c) => c.id === '20')?.name, 'Alice x Bob x Carol');
	assert.equal(chats.find((c) => c.id === '30')?.name, 'PEARLYjams open chat');
});

test('listChats uses "(unknown)" when nothing names the chat', () => {
	seedChat(db, { chatId: 40, type: 1, chatName: null, lastUpdatedAt: 100 });
	assert.equal(listChats()[0].name, '(unknown)');
});

test('resolveChat matches by exact id', () => {
	seedChat(db, { chatId: 50, chatName: 'Team', lastUpdatedAt: 1 });
	assert.equal(resolveChat('50').id, '50');
});

test('resolveChat matches by exact name over a looser substring match', () => {
	seedChat(db, { chatId: 60, chatName: 'Alice', lastUpdatedAt: 1 });
	seedChat(db, { chatId: 61, chatName: 'Alice x Bob x Carol', lastUpdatedAt: 1 });
	assert.equal(resolveChat('Alice').id, '60');
});

test('resolveChat matches a single case-insensitive substring', () => {
	seedChat(db, { chatId: 70, chatName: 'PEARLYjams Fall Sale', lastUpdatedAt: 1 });
	assert.equal(resolveChat('fall sale').id, '70');
});

test('resolveChat throws CHAT_NOT_FOUND for no match', () => {
	assert.throws(() => resolveChat('nobody'), /./);
});

test('resolveChat throws CHAT_AMBIGUOUS for more than one substring match', () => {
	seedChat(db, { chatId: 80, chatName: 'Alice x Bob', lastUpdatedAt: 1 });
	seedChat(db, { chatId: 81, chatName: 'Alice x Carol', lastUpdatedAt: 1 });
	assert.throws(() => resolveChat('Alice'), /./);
});

test('searchMessages escapes LIKE wildcards (% and _) in the query', () => {
	seedMe(db, ME);
	seedMessage(db, { logId: 1, chatId: 1, authorId: FRIEND, message: '50% off today', sentAt: 1 });
	seedMessage(db, { logId: 2, chatId: 1, authorId: FRIEND, message: '50X off today', sentAt: 2 });

	const literalPercent = searchMessages('50%');
	assert.equal(literalPercent.length, 1);
	assert.equal(literalPercent[0].text, '50% off today');
});

test('listMessages marks sender identity against NTChatContext', () => {
	seedMe(db, ME);
	seedMessage(db, { logId: 1, chatId: 1, authorId: ME, message: 'hi', sentAt: 1 });
	seedMessage(db, { logId: 2, chatId: 1, authorId: FRIEND, message: 'hey', sentAt: 2 });

	const messages = listMessages({ chatId: '1' });
	assert.equal(messages.find((m) => m.id === '1')?.fromMe, true);
	assert.equal(messages.find((m) => m.id === '2')?.fromMe, false);
});

test('unreadSummary only returns chats with unread messages', () => {
	seedMe(db, ME);
	seedChat(db, { chatId: 1, chatName: 'Busy', unreadCount: 1, lastUpdatedAt: 100 });
	seedChat(db, { chatId: 2, chatName: 'Quiet', unreadCount: 0, lastUpdatedAt: 50 });
	seedMessage(db, { logId: 1, chatId: 1, authorId: FRIEND, message: 'hi', sentAt: 1 });

	const summary = unreadSummary();
	assert.equal(summary.length, 1);
	assert.equal(summary[0].chatId, '1');
});

// Regression test for a bug this suite found: unreadSummary() used to read `limit: unreadCount`
// messages in sentAt DESC order and only afterwards filter out my own messages. An outgoing reply
// landing between two incoming unread messages pushed the older one outside that DESC-limited
// window, silently dropping a genuinely unread message. Fixed by excluding my own messages in SQL.
test('unreadSummary should not drop an unread message that has one of my replies after it', () => {
	seedMe(db, ME);
	seedChat(db, { chatId: 1, chatName: 'Busy', unreadCount: 2, lastUpdatedAt: 100 });
	seedMessage(db, { logId: 1, chatId: 1, authorId: FRIEND, message: 'first', sentAt: 1 });
	seedMessage(db, { logId: 2, chatId: 1, authorId: ME, message: 'reply', sentAt: 2 });
	seedMessage(db, { logId: 3, chatId: 1, authorId: FRIEND, message: 'second', sentAt: 3 });

	const summary = unreadSummary();
	assert.deepEqual(
		summary[0].messages.map((m) => m.text),
		['first', 'second'],
	);
});
