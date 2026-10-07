import { hash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { logger } from '../server/logger.js';
import type { HashSearchMessage } from '../type/hash-search.type.js';
import { readPreferences } from './device-info.js';

type Prefs = Record<string, unknown>[];

const REVISION_PREFIX = 'DESIGNATEDFRIENDSREVISION:';
const FRAME_PREFIX = 'NSWindow Frame FSChatWindowFrame_';
const TRANSPARENCY_PREFIX = 'FSChatWindowTransparency';
const EMPTY_ACCOUNT_HASH = hash('sha512', '0');
const SEARCH_LIMIT = 4_000_000_000;

// the common tail of several keys, e.g. "...FSChatWindowFrame_12345" -> 12345
function commonNumericSuffix(values: string[]): number | null {
	if (values.length < 2) return null;
	let suffix = values[0];
	for (const value of values) {
		while (suffix && !value.endsWith(suffix)) suffix = suffix.slice(1);
	}
	const digits = suffix.match(/\d+$/)?.[0];
	return digits ? Number(digits) : null;
}

function idFromKeys(prefs: Prefs, prefix: string): number | null {
	for (const dict of prefs) {
		const tails = Object.keys(dict)
			.filter((key) => key.startsWith(prefix))
			.map((key) => key.slice(prefix.length));
		const id = commonNumericSuffix(tails);
		if (id) return id;
	}
	return null;
}

// the account revision key stores sha512(userId); the active account is the non-zero, non-empty one
function activeAccountHash(prefs: Prefs): string | null {
	for (const dict of prefs) {
		for (const [key, value] of Object.entries(dict)) {
			if (!key.startsWith(REVISION_PREFIX)) continue;
			const digest = key.slice(REVISION_PREFIX.length);
			if (digest === EMPTY_ACCOUNT_HASH) continue;
			if (Number(value) !== 0) return digest;
		}
	}
	return null;
}

function searchWorker(target: string, start: number, step: number): Promise<number | null> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./user-id.worker.js', import.meta.url), {
			workerData: { target, start, step, max: SEARCH_LIMIT },
		});
		worker.on('message', (msg: HashSearchMessage) => {
			if (msg.type === 'done') {
				worker.terminate();
				resolve(msg.value);
			}
		});
		worker.on('error', reject);
	});
}

// brute-force sha512(n) over small integers, split across all CPU cores
async function recoverFromHash(digest: string): Promise<number | null> {
	const cores = availableParallelism();
	logger.info('searching userId from account hash', { cores });
	const results = await Promise.all(
		Array.from({ length: cores }, (_, i) => searchWorker(digest, i, cores)),
	);
	return results.find((id): id is number => id !== null) ?? null;
}

export async function detectUserId(): Promise<number> {
	const prefs = readPreferences();

	const fromTransparency = idFromKeys(prefs, TRANSPARENCY_PREFIX);
	if (fromTransparency) return fromTransparency;

	for (const key of ['userId', 'user_id', 'userID']) {
		for (const dict of prefs) {
			const raw = dict[key];
			const id = typeof raw === 'number' ? raw : Number(raw);
			if (Number.isInteger(id) && id > 0) return id;
		}
	}

	const digest = activeAccountHash(prefs);
	if (digest) {
		const recovered = await recoverFromHash(digest);
		if (recovered) return recovered;
	}

	const fromFrame = idFromKeys(prefs, FRAME_PREFIX);
	if (fromFrame) return fromFrame;

	throw new AppError(Message.ACCOUNT_NOT_FOUND);
}
