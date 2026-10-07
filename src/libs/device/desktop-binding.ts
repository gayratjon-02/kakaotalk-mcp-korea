import { execFileSync } from 'node:child_process';
import * as plist from 'plist';
import { BUNDLE_ID } from '../config/paths.js';

// 'all-desktops': KakaoTalk windows exist on every desktop, so the Accessibility API can always see them.
// 'not-assigned': they live on one desktop only and vanish for the API whenever the user is on another one.
// 'unknown': the setting could not be read, so nothing is assumed.
export type DesktopBinding = 'all-desktops' | 'not-assigned' | 'unknown';

// Pure part, kept apart for testing: reads the app-bindings dictionary of com.apple.spaces.
// A missing dictionary means no app has been assigned anywhere.
export function bindingFromSpaces(spaces: Record<string, unknown>, bundleId: string = BUNDLE_ID): DesktopBinding {
	const bindings = spaces['app-bindings'];
	if (bindings === undefined) return 'not-assigned';
	if (typeof bindings !== 'object' || bindings === null) return 'unknown';
	const value = (bindings as Record<string, unknown>)[bundleId];
	return typeof value === 'string' && /all/i.test(value) ? 'all-desktops' : 'not-assigned';
}

export function readDesktopBinding(): DesktopBinding {
	try {
		const xml = execFileSync('/usr/bin/defaults', ['export', 'com.apple.spaces', '-'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
		const parsed = plist.parse(xml);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? bindingFromSpaces(parsed as Record<string, unknown>)
			: 'unknown';
	} catch {
		return 'unknown';
	}
}
