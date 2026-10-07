import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toMarkdown } from '../libs/export/format-transcript.js';
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
		text: 'hello',
		sentAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

test('a deleted message is rendered as [deleted], regardless of its kind', () => {
	const md = toMarkdown('Chat', [message({ deleted: true, text: null })]);
	assert.match(md, /\*\*Friend\*\*: \[deleted\]/);
});

test('a deleted photo message also renders as [deleted], not [photo]', () => {
	const md = toMarkdown('Chat', [message({ deleted: true, text: null, kind: 'photo' })]);
	assert.match(md, /\*\*Friend\*\*: \[deleted\]/);
	assert.doesNotMatch(md, /\[photo\]/);
});

test('a live, non-deleted message still renders its text normally', () => {
	const md = toMarkdown('Chat', [message({ text: 'still here' })]);
	assert.match(md, /\*\*Friend\*\*: still here/);
});
