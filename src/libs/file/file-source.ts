import { chmodSync, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { env } from '../config/env.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { logger } from '../server/logger.js';
import type { FileRecord } from '../type/file.type.js';

const HOST_PATTERN = /(^|\.)kakaocdn\.net$/;
const DOWNLOAD_TIMEOUT_MS = 60_000;

export type FileOrigin = { path: string; origin: 'local' | 'download' };

export function assertDownloadable(url: string): URL {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new AppError(Message.FILE_DOWNLOAD_FAILED);
	}
	// the url comes from message data, so only Kakao's own https file host is ever contacted
	if (parsed.protocol !== 'https:' || !HOST_PATTERN.test(parsed.hostname)) throw new AppError(Message.FILE_DOWNLOAD_FAILED);
	return parsed;
}

// a safe cache file name: the message id plus a short alphanumeric extension, never the sender's file name
function cachePath(record: FileRecord): string {
	const ext = /^[a-z0-9]{1,8}$/.test(record.extension) ? `.${record.extension}` : '';
	return join(paths.fileCacheDir, `${record.messageId}${ext}`);
}

export async function materialize(record: FileRecord): Promise<FileOrigin> {
	if (record.localPath) return { path: record.localPath, origin: 'local' };
	if (record.availability === 'expired' || !record.url) throw new AppError(Message.FILE_EXPIRED);

	const limit = env.maxFileMb * 1024 * 1024;
	if (record.size > limit) throw new AppError(Message.FILE_TOO_LARGE, `${env.maxFileMb} MB`);

	const target = cachePath(record);
	if (existsSync(target) && statSync(target).size === record.size) return { path: target, origin: 'download' };

	const url = assertDownloadable(record.url);
	let response: Response;
	try {
		response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
	} catch {
		throw new AppError(Message.FILE_DOWNLOAD_FAILED);
	}
	if (response.status === 410) throw new AppError(Message.FILE_EXPIRED);
	if (!response.ok) throw new AppError(Message.FILE_DOWNLOAD_FAILED, `HTTP ${response.status}`);

	const body = Buffer.from(await response.arrayBuffer());
	if (body.length > limit) throw new AppError(Message.FILE_TOO_LARGE, `${env.maxFileMb} MB`);
	if (record.size > 0 && body.length !== record.size) throw new AppError(Message.FILE_DOWNLOAD_FAILED, 'size mismatch');

	mkdirSync(paths.fileCacheDir, { recursive: true, mode: 0o700 });
	chmodSync(paths.fileCacheDir, 0o700);
	try {
		writeFileSync(target, body, { mode: 0o600 });
	} catch (error) {
		if (existsSync(target)) unlinkSync(target);
		throw error;
	}
	logger.info('file downloaded', { bytes: body.length });
	return { path: target, origin: 'download' };
}
