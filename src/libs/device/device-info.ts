import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as plist from 'plist';
import { paths } from '../config/paths.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';

type PlistDict = Record<string, unknown>;

export function platformUuid(): string {
	const out = execFileSync('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']).toString();
	const match = out.match(/"IOPlatformUUID" = "([0-9A-F-]{36})"/);
	if (!match) throw new AppError(Message.ACCOUNT_NOT_FOUND, 'IOPlatformUUID');
	return match[1];
}

export function assertAppInstalled(): void {
	if (!existsSync(paths.app)) throw new AppError(Message.APP_NOT_INSTALLED);
}

// the per-account plist carries a hex suffix, e.g. com.kakao.KakaoTalkMac.1A2B3C.plist
function preferenceFiles(): string[] {
	const files: string[] = [];
	if (existsSync(paths.containerPrefsDir)) {
		for (const name of readdirSync(paths.containerPrefsDir)) {
			if (/^com\.kakao\.KakaoTalkMac\.[0-9A-F]+\.plist$/.test(name)) files.push(join(paths.containerPrefsDir, name));
		}
		files.push(join(paths.containerPrefsDir, 'com.kakao.KakaoTalkMac.plist'));
	}
	files.push(paths.globalPrefs);
	return files.filter((file) => existsSync(file));
}

// binary plists may hold <data> values, so convert to xml instead of json
function readPlist(file: string): PlistDict | null {
	try {
		const xml = execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', file]).toString();
		const parsed = plist.parse(xml);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as PlistDict) : null;
	} catch {
		return null;
	}
}

export function readPreferences(): PlistDict[] {
	const dicts = preferenceFiles()
		.map(readPlist)
		.filter((dict): dict is PlistDict => dict !== null);
	if (dicts.length === 0) throw new AppError(Message.PREFERENCES_NOT_FOUND);
	return dicts;
}

export function listDatabaseFiles(): string[] {
	if (!existsSync(paths.dataDir)) return [];
	return readdirSync(paths.dataDir).filter((name) => /^[0-9a-f]{78}$/.test(name));
}
