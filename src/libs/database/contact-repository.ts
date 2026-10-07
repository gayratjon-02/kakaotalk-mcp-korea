import type { Contact } from '../type/contact.type.js';
import { getDb } from './connection.js';

const MAX_LIMIT = 200;

type ContactRow = {
	id: string;
	name: string | null;
	statusMessage: string | null;
	favorite: number;
};

// phone numbers are deliberately not selected; an agent rarely needs them and they are sensitive
export function searchContacts(query: string | undefined, limit = 30): Contact[] {
	const capped = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LIMIT);
	const escaped = (query ?? '').trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);
	const rows = getDb()
		.prepare(
			`SELECT CAST(userId AS TEXT) AS id,
				COALESCE(NULLIF(friendNickName, ''), NULLIF(displayName, ''), nickName) AS name,
				statusMessage, favorite
			FROM NTUser
			WHERE linkId = 0 AND hidden = 0 AND purged = 0
				AND COALESCE(NULLIF(friendNickName, ''), NULLIF(displayName, ''), nickName) LIKE ? ESCAPE '\\'
			ORDER BY favorite DESC, name COLLATE NOCASE
			LIMIT ?`,
		)
		.all(`%${escaped}%`, capped) as ContactRow[];
	return rows
		.filter((row): row is ContactRow & { name: string } => Boolean(row.name))
		.map((row) => ({
			id: row.id,
			name: row.name,
			statusMessage: row.statusMessage || null,
			favorite: Boolean(row.favorite),
		}));
}
