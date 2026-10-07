import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { assertDownloadable } from './file-source.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export type FetchedImage = { mimeType: string; base64: string };

// profile pictures are public Kakao CDN images; the same host, https and size rules as file downloads apply
export async function fetchProfileImage(url: string): Promise<FetchedImage> {
	const parsed = assertDownloadable(url);
	let response: Response;
	try {
		response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		throw new AppError(Message.FILE_DOWNLOAD_FAILED);
	}
	if (!response.ok) throw new AppError(Message.FILE_DOWNLOAD_FAILED, `HTTP ${response.status}`);
	const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!IMAGE_TYPES.has(mimeType)) throw new AppError(Message.FILE_DOWNLOAD_FAILED, 'not an image');
	const body = Buffer.from(await response.arrayBuffer());
	if (body.length > MAX_IMAGE_BYTES) throw new AppError(Message.FILE_TOO_LARGE, '5 MB');
	return { mimeType, base64: body.toString('base64') };
}
