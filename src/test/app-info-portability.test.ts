import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// A Mac without KakaoTalk preferences (a fresh install, a CI runner) must give empty values, not an exception.
// The paths are fixed when the module loads, so this runs in a child process whose HOME is an empty folder.
test('app info and the delete limit work when no KakaoTalk preferences exist', () => {
	const home = mkdtempSync(join(tmpdir(), 'kt-empty-home-'));
	try {
		const script = `
			const m = await import(${JSON.stringify(new URL('../libs/account/app-info.js', import.meta.url).href)});
			console.log(JSON.stringify({ info: m.readAppInfo(), login: m.readLoginId(), limit: m.readDeleteLimitMinutes() }));
		`;
		const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, HOME: home }, encoding: 'utf8' });
		const result = JSON.parse(out.trim().split('\n').pop() ?? '{}');
		assert.equal(result.info.country, null);
		assert.equal(result.info.locale, null);
		assert.equal(result.login, null);
		assert.equal(result.limit, 1440);
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
});
