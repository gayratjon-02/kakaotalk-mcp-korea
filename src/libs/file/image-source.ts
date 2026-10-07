import { readFileSync, statSync } from 'node:fs';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import type { ImageRecord } from '../type/image.type.js';
import { assertDownloadable } from './file-source.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

export type LoadedImage = { mimeType: string; base64: string; source: 'local' | 'download' | 'thumbnail'; bytes: number };

// the type comes from the file's own first bytes, never from a file name or a header alone
export function imageTypeOf(bytes: Buffer): string | null {
	if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
	if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('latin1'))) return 'image/gif';
	if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
	return null;
}

async function download(url: string): Promise<Buffer> {
	const parsed = assertDownloadable(url);
	let response: Response;
	try {
		response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		throw new AppError(Message.FILE_DOWNLOAD_FAILED);
	}
	if (response.status === 410) throw new AppError(Message.FILE_EXPIRED);
	if (!response.ok) throw new AppError(Message.FILE_DOWNLOAD_FAILED, `HTTP ${response.status}`);
	const declared = Number(response.headers.get('content-length') ?? 0);
	if (declared > MAX_IMAGE_BYTES) throw new AppError(Message.FILE_TOO_LARGE, '8 MB');
	const body = Buffer.from(await response.arrayBuffer());
	if (body.length > MAX_IMAGE_BYTES) throw new AppError(Message.FILE_TOO_LARGE, '8 MB');
	return body;
}

function asLoaded(bytes: Buffer, source: LoadedImage['source']): LoadedImage {
	const mimeType = imageTypeOf(bytes);
	if (!mimeType) throw new AppError(Message.FILE_DOWNLOAD_FAILED, 'not an image');
	return { mimeType, base64: bytes.toString('base64'), source, bytes: bytes.length };
}

// Local copy first (single photos only: an album keeps one path for several pictures), then the full picture from the
// Kakao CDN, then its thumbnail when the full one is too large. An expired picture without a local copy is reported as such.
export async function loadImage(record: ImageRecord, index: number, thumbnailOnly = false): Promise<LoadedImage> {
	if (!Number.isInteger(index) || index < 0 || index >= record.count) throw new AppError(Message.FILE_NOT_FOUND);
	if (!thumbnailOnly && record.kind === 'photo' && record.localPath && statSync(record.localPath).size <= MAX_IMAGE_BYTES) {
		return asLoaded(readFileSync(record.localPath), 'local');
	}
	if (record.availability === 'expired') throw new AppError(Message.FILE_EXPIRED);
	const thumbnail = record.thumbnailUrls[index];
	if (thumbnailOnly && thumbnail) return asLoaded(await download(thumbnail), 'thumbnail');
	try {
		return asLoaded(await download(record.urls[index]), 'download');
	} catch (error) {
		if (error instanceof AppError && error.code === Message.FILE_TOO_LARGE && thumbnail) return asLoaded(await download(thumbnail), 'thumbnail');
		throw error;
	}
}
