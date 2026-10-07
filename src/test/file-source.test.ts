import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Message } from '../libs/enum/message.enum.js';
import { materialize } from '../libs/file/file-source.js';
import { AppError } from '../libs/server/app-error.js';
import type { FileRecord } from '../libs/type/file.type.js';

const record = (url: string | null, overrides: Partial<FileRecord> = {}): FileRecord => ({
	messageId: '1',
	chatId: '1',
	name: 'a.pdf',
	extension: 'pdf',
	size: 10,
	senderName: null,
	sentAt: '2026-01-01T00:00:00.000Z',
	expiresAt: '2999-01-01T00:00:00.000Z',
	availability: 'download',
	url,
	localPath: null,
	...overrides,
});

const rejectsWith = (code: Message) => (error: unknown) => error instanceof AppError && error.code === code;

test('a url on a foreign host is refused before any request is made', async () => {
	await assert.rejects(() => materialize(record('https://evil.example/file.pdf')), rejectsWith(Message.FILE_DOWNLOAD_FAILED));
});

test('a lookalike host that only ends with the Kakao name is refused', async () => {
	await assert.rejects(() => materialize(record('https://notkakaocdn.net/file.pdf')), rejectsWith(Message.FILE_DOWNLOAD_FAILED));
});

test('a plain http url is refused even on the Kakao host', async () => {
	await assert.rejects(() => materialize(record('http://talk.kakaocdn.net/file.pdf')), rejectsWith(Message.FILE_DOWNLOAD_FAILED));
});

test('an expired file without a local copy reports expiry', async () => {
	await assert.rejects(() => materialize(record('https://talk.kakaocdn.net/x', { availability: 'expired' })), rejectsWith(Message.FILE_EXPIRED));
});

test('a file above the size limit is refused before downloading', async () => {
	await assert.rejects(() => materialize(record('https://talk.kakaocdn.net/x', { size: 10 * 1024 * 1024 * 1024 })), rejectsWith(Message.FILE_TOO_LARGE));
});

test('a local copy is used as is, without touching the network', async () => {
	const result = await materialize(record(null, { availability: 'local', localPath: '/tmp/example.pdf' }));
	assert.deepEqual(result, { path: '/tmp/example.pdf', origin: 'local' });
});
