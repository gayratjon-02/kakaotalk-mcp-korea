import { requireAccount } from '../account/account-store.js';
import { databaseKey } from './crypto-keys.js';
import { openKakaoDb, type KakaoDb } from './kakao-db.js';

let cached: KakaoDb | null = null;

// one read-only handle per process; the key is derived from the cached account on first use
export function getDb(): KakaoDb {
	if (cached) return cached;
	const account = requireAccount();
	cached = openKakaoDb(account.databaseFile, databaseKey(account.userId, account.deviceUuid));
	return cached;
}

export function closeDb(): void {
	cached?.close();
	cached = null;
}

// lets tests run the queries against an in-memory database instead of the real account
export function useDb(db: KakaoDb | null): void {
	cached = db;
}
