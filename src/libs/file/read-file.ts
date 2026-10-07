import { statSync } from 'node:fs';
import { getFileRecord } from '../database/file-repository.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import type { FileMetadataOnly, FileText } from '../type/file.type.js';
import { extractText } from './extract-text.js';
import { materialize } from './file-source.js';

const ID_PATTERN = /^\d{1,19}$/;
const DEFAULT_CHARS = 20_000;

// Reads a file shared in a chat: uses the copy KakaoTalk already saved, else downloads it while the server still has it.
export async function readChatFile(messageId: string, maxChars = DEFAULT_CHARS): Promise<FileText | FileMetadataOnly> {
	if (!ID_PATTERN.test(messageId)) throw new AppError(Message.FILE_NOT_FOUND);
	const record = getFileRecord(messageId);
	if (!record) throw new AppError(Message.FILE_NOT_FOUND);

	const { path, origin } = await materialize(record);
	const extracted = await extractText(path, record.extension);
	if (!extracted) {
		return {
			messageId,
			name: record.name,
			origin,
			size: statSync(path).size,
			note: `Text cannot be extracted from .${record.extension || 'unknown'} files.`,
		};
	}
	const text = extracted.text.slice(0, Math.max(1, maxChars));
	return {
		messageId,
		name: record.name,
		origin,
		method: extracted.method,
		text,
		totalChars: extracted.text.length,
		truncated: extracted.text.length > text.length,
	};
}
