import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Message } from '../libs/enum/message.enum.js';
import { AppError } from '../libs/server/app-error.js';
import { fail, ok, run } from '../libs/tool/tool-result.js';

test('ok() wraps data as JSON text with no error flag', () => {
	const result = ok({ hello: 'world' });
	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].text, JSON.stringify({ hello: 'world' }, null, 2));
});

test('fail() shows the localized message for an AppError', () => {
	const result = fail(new AppError(Message.CHAT_NOT_FOUND));
	assert.equal(result.isError, true);
	assert.equal(result.content[0].text, new AppError(Message.CHAT_NOT_FOUND).message);
});

test('fail() masks a non-AppError instead of leaking its message', () => {
	const result = fail(new Error('internal stack trace detail'));
	assert.equal(result.isError, true);
	assert.doesNotMatch(result.content[0].text, /internal stack trace detail/);
});

test('run() returns ok() when the task succeeds', () => {
	const result = run(() => 42);
	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].text, '42');
});

test('run() returns fail() when the task throws', () => {
	const result = run(() => {
		throw new AppError(Message.CHAT_AMBIGUOUS);
	});
	assert.equal(result.isError, true);
});
