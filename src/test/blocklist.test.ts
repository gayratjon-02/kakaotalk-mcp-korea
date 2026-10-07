import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBlockedChat } from '../libs/config/blocklist.js';
import { sendToChat } from '../libs/automation/send-message.js';
import { Message } from '../libs/enum/message.enum.js';
import { AppError } from '../libs/server/app-error.js';

process.env.KAKAOTALK_BLOCKED_CHATS = 'Test Person';

test('a blocked name matches ignoring case, spacing and extra words', () => {
	assert.equal(isBlockedChat('Test Person'), true);
	assert.equal(isBlockedChat('  test   PERSON '), true);
	assert.equal(isBlockedChat('Test Person (work)'), true);
});

test('a shorter or different name is not blocked', () => {
	assert.equal(isBlockedChat('Test'), false);
	assert.equal(isBlockedChat('Someone Else'), false);
});

test('sendToChat refuses a blocked chat before touching any window, even in dry run', async () => {
	for (const dryRun of [false, true]) {
		await assert.rejects(
			() => sendToChat('Test Person', 'hello', dryRun),
			(error) => error instanceof AppError && error.code === Message.CHAT_BLOCKED,
		);
	}
});
