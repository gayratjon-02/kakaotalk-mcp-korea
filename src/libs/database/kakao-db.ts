import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';
import { paths } from '../config/paths.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';

export type KakaoDb = Database.Database;

// Opens the encrypted database read-only. Tries SQLCipher v3 then v4 compatibility.
export function openKakaoDb(fileName: string, key: string): KakaoDb {
	const file = join(paths.dataDir, fileName);
	if (!existsSync(file)) throw new AppError(Message.DATABASE_NOT_FOUND);

	for (const legacy of [3, 4]) {
		try {
			const db = new Database(file, { readonly: true, fileMustExist: true });
			db.pragma("cipher='sqlcipher'");
			db.pragma(`legacy=${legacy}`);
			db.pragma(`key='${key}'`);
			db.prepare('SELECT count(*) FROM sqlite_master').get();
			return db;
		} catch {
			// wrong compatibility mode, try the next one
		}
	}
	throw new AppError(Message.DATABASE_LOCKED);
}
