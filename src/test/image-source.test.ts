import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageTypeOf, loadImage } from '../libs/file/image-source.js';
import { Message } from '../libs/enum/message.enum.js';
import { AppError } from '../libs/server/app-error.js';
import type { ImageRecord } from '../libs/type/image.type.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

test('the image type is read from the first bytes', () => {
	assert.equal(imageTypeOf(PNG), 'image/png');
	assert.equal(imageTypeOf(JPEG), 'image/jpeg');
	assert.equal(imageTypeOf(Buffer.from('GIF89a....')), 'image/gif');
	assert.equal(imageTypeOf(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'image/webp');
});

test('a file that only claims to be an image is not accepted', () => {
	assert.equal(imageTypeOf(Buffer.from('<html>not an image</html>')), null);
	assert.equal(imageTypeOf(Buffer.alloc(0)), null);
});

const record = (overrides: Partial<ImageRecord> = {}): ImageRecord => ({
	messageId: '1',
	chatId: '1',
	kind: 'photo',
	count: 1,
	width: 10,
	height: 10,
	senderName: null,
	sentAt: '2026-01-01T00:00:00.000Z',
	expiresAt: null,
	availability: 'download',
	urls: ['https://evil.example/a.png'],
	thumbnailUrls: [],
	localPath: null,
	...overrides,
});

test('an index outside the album is refused', async () => {
	await assert.rejects(() => loadImage(record({ count: 2, urls: ['a', 'b'] }), 2), (e) => e instanceof AppError && e.code === Message.FILE_NOT_FOUND);
});

test('an expired picture without a local copy reports expiry', async () => {
	await assert.rejects(() => loadImage(record({ availability: 'expired' }), 0), (e) => e instanceof AppError && e.code === Message.FILE_EXPIRED);
});

test('a url on a foreign host is refused before any request', async () => {
	await assert.rejects(() => loadImage(record(), 0), (e) => e instanceof AppError && e.code === Message.FILE_DOWNLOAD_FAILED);
});
