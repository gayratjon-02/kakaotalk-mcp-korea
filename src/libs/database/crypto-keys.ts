import { createHash, pbkdf2Sync } from 'node:crypto';

// KakaoTalk derives its SQLCipher file name and key from the Mac's platform UUID and the account userId
const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 128;

function base64Digest(input: string): string {
	return Buffer.concat([
		createHash('sha1').update(input).digest(),
		createHash('sha256').update(input).digest(),
	]).toString('base64');
}

function reverse(input: string): string {
	return [...input].reverse().join('');
}

function derive(password: string, salt: string): Buffer {
	return pbkdf2Sync(Buffer.from(password), Buffer.from(salt), PBKDF2_ITERATIONS, KEY_BYTES, 'sha256');
}

export function databaseFileName(userId: number, uuid: string): string {
	const password = ['.', 'F', String(userId), 'A', 'F', reverse(uuid), '.', '|'].join('.');
	const salt = reverse(base64Digest(uuid));
	const hex = derive(password, salt).toString('hex');
	return hex.slice(28, 106);
}

export function databaseKey(userId: number, uuid: string): string {
	const parts = ['A', base64Digest(uuid), '|', 'F', uuid.slice(0, 5), 'H', String(userId), '|', uuid.slice(7)];
	const password = reverse(parts.join('F'));
	const salt = uuid.slice(Math.floor(uuid.length * 0.3));
	return derive(password, salt).toString('hex');
}
