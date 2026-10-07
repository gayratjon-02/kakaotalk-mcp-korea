import { existsSync, readFileSync } from 'node:fs';
import { paths } from './paths.js';

function normalize(value: string): string {
	return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

// entries come from the KAKAOTALK_BLOCKED_CHATS env (comma separated) and from a local json file
// next to the cached account, so private names never have to live in the repository
function loadEntries(): string[] {
	const fromEnv = (process.env.KAKAOTALK_BLOCKED_CHATS ?? '').split(',');
	let fromFile: unknown = [];
	if (existsSync(paths.blockedFile)) {
		try {
			fromFile = JSON.parse(readFileSync(paths.blockedFile, 'utf8'));
		} catch {
			fromFile = [];
		}
	}
	const list = Array.isArray(fromFile) ? fromFile.filter((item): item is string => typeof item === 'string') : [];
	return [...fromEnv, ...list].map(normalize).filter((entry) => entry.length > 0);
}

// true when the chat name contains a blocked name; read on every call so edits apply at once
export function isBlockedChat(name: string): boolean {
	const target = normalize(name);
	return loadEntries().some((entry) => target.includes(entry));
}
