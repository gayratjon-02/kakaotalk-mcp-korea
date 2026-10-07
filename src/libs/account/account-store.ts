import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { paths } from '../config/paths.js';
import { databaseFileName } from '../database/crypto-keys.js';
import { platformUuid } from '../device/device-info.js';
import { detectUserId } from '../device/user-id.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { logger } from '../server/logger.js';
import type { Account } from '../type/account.type.js';

export function readCachedAccount(): Account | null {
	if (!existsSync(paths.accountFile)) return null;
	try {
		return JSON.parse(readFileSync(paths.accountFile, 'utf8')) as Account;
	} catch {
		return null;
	}
}

// the userId search can take minutes, so it runs once and the result is cached on disk
export async function setupAccount(): Promise<Account> {
	const deviceUuid = platformUuid();
	const userId = await detectUserId();
	const account: Account = {
		userId,
		deviceUuid,
		databaseFile: databaseFileName(userId, deviceUuid),
		createdAt: new Date().toISOString(),
	};
	mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
	writeFileSync(paths.accountFile, JSON.stringify(account, null, 2), { mode: 0o600 });
	logger.info('account cached');
	return account;
}

export function requireAccount(): Account {
	const account = readCachedAccount();
	if (!account) throw new AppError(Message.ACCOUNT_NOT_CACHED);
	return account;
}
