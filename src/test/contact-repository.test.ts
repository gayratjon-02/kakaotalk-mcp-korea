import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { searchContacts } from '../libs/database/contact-repository.js';
import { useDb } from '../libs/database/connection.js';
import type { KakaoDb } from '../libs/database/kakao-db.js';
import { createMemoryDb, seedUser } from './support/memory-db.js';

let db: KakaoDb;

beforeEach(() => {
	db = createMemoryDb();
	useDb(db);
});

afterEach(() => {
	useDb(null);
	db.close();
});

test('searchContacts never returns a phone number field', () => {
	seedUser(db, { userId: 1, friendNickName: 'Alice', statusMessage: 'busy' });
	const [contact] = searchContacts('Alice');
	assert.deepEqual(Object.keys(contact).sort(), ['favorite', 'id', 'name', 'statusMessage']);
});

test('searchContacts prefers friendNickName, then displayName, then nickName', () => {
	seedUser(db, { userId: 1, friendNickName: 'Alice (friend)', displayName: 'Alice (display)', nickName: 'Alice (nick)' });
	seedUser(db, { userId: 2, displayName: 'Carol (display)', nickName: 'Carol (nick)' });
	seedUser(db, { userId: 3, nickName: 'Emily (nick)' });

	const names = searchContacts(undefined).map((c) => c.name);
	assert.ok(names.includes('Alice (friend)'));
	assert.ok(names.includes('Carol (display)'));
	assert.ok(names.includes('Emily (nick)'));
});

test('searchContacts excludes hidden and purged rows', () => {
	seedUser(db, { userId: 1, nickName: 'Hidden', hidden: true });
	seedUser(db, { userId: 2, nickName: 'Purged', purged: true });
	seedUser(db, { userId: 3, nickName: 'Visible' });

	const names = searchContacts(undefined).map((c) => c.name);
	assert.deepEqual(names, ['Visible']);
});

test('searchContacts escapes LIKE wildcards in the query', () => {
	seedUser(db, { userId: 1, nickName: '50% off shop' });
	seedUser(db, { userId: 2, nickName: '50X off shop' });

	const names = searchContacts('50%').map((c) => c.name);
	assert.deepEqual(names, ['50% off shop']);
});
