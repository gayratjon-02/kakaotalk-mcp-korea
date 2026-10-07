import { DELETE_FEED } from './message-verify.js';
import { usableLocalPath } from './file-repository.js';
import type { ChatImage, ImageAvailability, ImageRecord } from '../type/image.type.js';
import { getDb } from './connection.js';

const MAX_LIMIT = 200;
// stored kind 2 is one photo and 27 an album; the flagged variants are the same kinds with the extra bit
const IMAGE_KINDS = '(2, 27, 16386, 16411)';
const ALBUM = new Set([27, 16411]);

type Row = {
	id: string;
	chatId: string;
	type: number;
	senderName: string | null;
	attachment: string | null;
	localPath: string | null;
	sentAt: number;
};

const SELECT = `
	SELECT CAST(m.logId AS TEXT) AS id, CAST(m.chatId AS TEXT) AS chatId, m.type AS type,
		COALESCE(
			(SELECT COALESCE(NULLIF(u.nickName, ''), NULLIF(u.displayName, ''), NULLIF(u.friendNickName, ''))
				FROM NTUser u WHERE u.userId = m.authorId AND u.linkId > 0
					AND u.linkId = (SELECT r.linkId FROM NTChatRoom r WHERE r.chatId = m.chatId) LIMIT 1),
			(SELECT COALESCE(u.displayName, u.friendNickName, u.nickName)
				FROM NTUser u WHERE u.userId = m.authorId AND u.linkId = 0 LIMIT 1)) AS senderName,
		m.attachment AS attachment, m.localFilePath AS localPath, m.sentAt AS sentAt
	FROM NTChatMessage m
	WHERE m.type IN ${IMAGE_KINDS}
		AND NOT EXISTS (SELECT 1 FROM NTChatMessage f WHERE ${DELETE_FEED} AND f.message LIKE '%"logId":' || m.logId || '%')`;

type Attachment = {
	url?: string;
	thumbnailUrl?: string;
	imageUrls?: string[];
	thumbnailUrls?: string[];
	w?: number;
	h?: number;
	expire?: number;
};

function parse(row: Row): ImageRecord | null {
	let attachment: Attachment;
	try {
		attachment = JSON.parse(row.attachment ?? '');
	} catch {
		return null;
	}
	const album = ALBUM.has(row.type);
	const urls = album ? (attachment.imageUrls ?? []) : attachment.url ? [attachment.url] : [];
	const thumbnailUrls = album ? (attachment.thumbnailUrls ?? []) : attachment.thumbnailUrl ? [attachment.thumbnailUrl] : [];
	if (urls.length === 0) return null;
	const expiresMs = typeof attachment.expire === 'number' ? attachment.expire : null;
	const localPath = usableLocalPath(row.localPath);
	const availability: ImageAvailability = localPath ? 'local' : expiresMs !== null && expiresMs > Date.now() ? 'download' : 'expired';
	return {
		messageId: row.id,
		chatId: row.chatId,
		kind: album ? 'album' : 'photo',
		count: urls.length,
		width: attachment.w ?? null,
		height: attachment.h ?? null,
		senderName: row.senderName,
		sentAt: new Date(row.sentAt * 1000).toISOString(),
		expiresAt: expiresMs !== null ? new Date(expiresMs).toISOString() : null,
		availability,
		urls,
		thumbnailUrls,
		localPath,
	};
}

export function listChatImages(chatId: string, limit = 30): ChatImage[] {
	const rows = getDb()
		.prepare(`${SELECT} AND m.chatId = ? ORDER BY m.sentAt DESC LIMIT ?`)
		.all(chatId, Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LIMIT)) as Row[];
	return rows.flatMap((row) => {
		const record = parse(row);
		if (!record) return [];
		const { urls: _urls, thumbnailUrls: _thumbs, localPath: _path, ...publicFields } = record;
		return [publicFields];
	});
}

export function getImageRecord(messageId: string): ImageRecord | null {
	const row = getDb().prepare(`${SELECT} AND m.logId = ?`).get(messageId) as Row | undefined;
	return row ? parse(row) : null;
}
