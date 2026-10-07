import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import type { ChatFile, FileAvailability, FileRecord } from '../type/file.type.js';
import { getDb } from './connection.js';

const MAX_LIMIT = 200;
// stored kind 18 is a file; 16402 is the same kind with the extra flag bit
const FILE_KINDS = '(18, 16402)';

type Row = {
	id: string;
	chatId: string;
	senderName: string | null;
	attachment: string | null;
	localPath: string | null;
	sentAt: number;
};

const SELECT = `
	SELECT CAST(m.logId AS TEXT) AS id, CAST(m.chatId AS TEXT) AS chatId,
		COALESCE(
			(SELECT COALESCE(NULLIF(u.nickName, ''), NULLIF(u.displayName, ''), NULLIF(u.friendNickName, ''))
				FROM NTUser u WHERE u.userId = m.authorId AND u.linkId > 0
					AND u.linkId = (SELECT r.linkId FROM NTChatRoom r WHERE r.chatId = m.chatId) LIMIT 1),
			(SELECT COALESCE(u.displayName, u.friendNickName, u.nickName)
				FROM NTUser u WHERE u.userId = m.authorId AND u.linkId = 0 LIMIT 1)) AS senderName,
		m.attachment AS attachment, m.localFilePath AS localPath, m.sentAt AS sentAt
	FROM NTChatMessage m
	WHERE m.type IN ${FILE_KINDS}`;

// only an existing regular file inside the user's home counts as a local copy
export function usableLocalPath(path: string | null): string | null {
	if (!path || !existsSync(path)) return null;
	try {
		const real = realpathSync(path);
		return real.startsWith(`${homedir()}/`) && statSync(real).isFile() ? real : null;
	} catch {
		return null;
	}
}

function parse(row: Row): FileRecord | null {
	let attachment: { name?: string; url?: string; size?: number; expire?: number };
	try {
		attachment = JSON.parse(row.attachment ?? '');
	} catch {
		return null;
	}
	const name = attachment.name ?? '';
	const expiresMs = typeof attachment.expire === 'number' ? attachment.expire : null;
	const localPath = usableLocalPath(row.localPath);
	const availability: FileAvailability = localPath
		? 'local'
		: expiresMs !== null && expiresMs > Date.now()
			? 'download'
			: 'expired';
	return {
		messageId: row.id,
		chatId: row.chatId,
		name,
		extension: name.includes('.') ? name.split('.').pop()!.toLowerCase() : '',
		size: attachment.size ?? 0,
		senderName: row.senderName,
		sentAt: new Date(row.sentAt * 1000).toISOString(),
		expiresAt: expiresMs !== null ? new Date(expiresMs).toISOString() : null,
		availability,
		url: attachment.url ?? null,
		localPath,
	};
}

export function listChatFiles(chatId: string, limit = 50): ChatFile[] {
	const rows = getDb()
		.prepare(`${SELECT} AND m.chatId = ? ORDER BY m.sentAt DESC LIMIT ?`)
		.all(chatId, Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LIMIT)) as Row[];
	return rows.flatMap((row) => {
		const record = parse(row);
		if (!record) return [];
		const { url: _url, localPath: _path, ...publicFields } = record;
		return [publicFields];
	});
}

export function getFileRecord(messageId: string): FileRecord | null {
	const row = getDb().prepare(`${SELECT} AND m.logId = ?`).get(messageId) as Row | undefined;
	return row ? parse(row) : null;
}
