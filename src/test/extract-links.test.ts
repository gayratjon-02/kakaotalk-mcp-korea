import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectLinks, linksIn } from '../libs/link/extract-links.js';
import type { ChatMessage } from '../libs/type/message.type.js';

function message(overrides: Partial<ChatMessage>): ChatMessage {
	return {
		id: '1',
		chatId: '1',
		senderId: '10',
		senderName: 'Friend',
		fromMe: false,
		kind: 'text',
		deleted: false,
		text: null,
		sentAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

test('linksIn finds a plain https url', () => {
	assert.deepEqual(linksIn('check this https://example.com/path out'), ['https://example.com/path']);
});

test('collectLinks skips a deleted message even though it has a kind that normally carries links', () => {
	const hits = collectLinks([
		message({ id: '1', deleted: true, text: null }),
		message({ id: '2', deleted: false, text: 'see https://real-link.example.com' }),
	]);
	assert.deepEqual(
		hits.map((h) => h.url),
		['https://real-link.example.com'],
	);
});
