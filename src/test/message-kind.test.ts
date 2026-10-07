import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kindLabel } from '../libs/enum/message-kind.enum.js';

const FLAG_OFFSET = 16384;

test('kindLabel maps a plain text message', () => {
	assert.equal(kindLabel(1), 'text');
});

test('kindLabel maps a flagged text message (16384 + 1)', () => {
	assert.equal(kindLabel(FLAG_OFFSET + 1), 'text');
});

test('kindLabel maps a flagged photo message (16384 + 2)', () => {
	assert.equal(kindLabel(FLAG_OFFSET + 2), 'photo');
});

test('kindLabel maps a known file message', () => {
	assert.equal(kindLabel(18), 'file');
});

test('kindLabel falls back to "other" for an unknown kind', () => {
	assert.equal(kindLabel(1999), 'other');
});
