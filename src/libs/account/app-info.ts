import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '../config/paths.js';
import { readPreferences } from '../device/device-info.js';
import type { AppInfo } from '../type/account-info.type.js';

function plistValue(file: string, key: string): string | null {
	try {
		return execFileSync('/usr/bin/plutil', ['-extract', key, 'raw', file], { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return null;
	}
}

function preference(key: string): string | null {
	for (const dict of readPreferences()) {
		const value = dict[key];
		if (typeof value === 'string' && value.length > 0) return value;
	}
	return null;
}

export function readAppInfo(): AppInfo {
	const info = join(paths.app, 'Contents/Info.plist');
	const present = existsSync(info);
	return {
		version: present ? plistValue(info, 'CFBundleShortVersionString') : null,
		build: present ? plistValue(info, 'CFBundleVersion') : null,
		country: preference('Country'),
		locale: preference('AppleLocale'),
	};
}

// the login id is stored with the app preferences, not in the chat database; it is an email or, for phone
// based accounts, the phone number in international form without a plus sign
export function readLoginId(): string | null {
	return preference('Email');
}

// KakaoTalk's own limit, in minutes, for "delete for everyone"; 1440 (one day) when the preference is missing
export function readDeleteLimitMinutes(): number {
	for (const dict of readPreferences()) {
		const value = dict.UserPropertyMessageDeleteLimitTime;
		if (typeof value === 'number' && value > 0) return value;
	}
	return 1440;
}
