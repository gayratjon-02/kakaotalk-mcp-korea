import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseFileName, databaseKey } from '../libs/database/crypto-keys.js';

const USER_ID = 123456789;
const UUID = '12345678-ABCD-4EF0-9876-FEDCBA012345';

test('databaseFileName is deterministic for the same input', () => {
	assert.equal(databaseFileName(USER_ID, UUID), databaseFileName(USER_ID, UUID));
});

test('databaseFileName is a 78-character lowercase hex string', () => {
	const name = databaseFileName(USER_ID, UUID);
	assert.equal(name.length, 78);
	assert.match(name, /^[0-9a-f]{78}$/);
});

test('databaseKey is deterministic for the same input', () => {
	assert.equal(databaseKey(USER_ID, UUID), databaseKey(USER_ID, UUID));
});

test('databaseKey is a 256-character lowercase hex string (128 bytes)', () => {
	const key = databaseKey(USER_ID, UUID);
	assert.equal(key.length, 256);
	assert.match(key, /^[0-9a-f]{256}$/);
});

test('a different userId changes both outputs', () => {
	assert.notEqual(databaseFileName(USER_ID, UUID), databaseFileName(USER_ID + 1, UUID));
	assert.notEqual(databaseKey(USER_ID, UUID), databaseKey(USER_ID + 1, UUID));
});
