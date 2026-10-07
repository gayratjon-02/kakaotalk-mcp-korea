import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { extractText, stripXml } from '../libs/file/extract-text.js';

test('stripXml turns paragraphs into lines, drops tags and decodes entities', () => {
	const xml = '<a:p><a:r><a:t>Tom &amp; Jerry</a:t></a:r></a:p><a:p><a:r><a:t>1 &lt; 2</a:t></a:r></a:p>';
	assert.equal(stripXml(xml), 'Tom & Jerry\n1 < 2');
});

test('a plain text file is read as utf8', async () => {
	const file = join(mkdtempSync(join(tmpdir(), 'kt-')), 'note.txt');
	writeFileSync(file, 'salom 안녕');
	assert.deepEqual(await extractText(file, 'txt'), { text: 'salom 안녕', method: 'utf8' });
});

test('an unsupported type returns null so the caller reports metadata only', async () => {
	assert.equal(await extractText('/nonexistent/photo.png', 'png'), null);
});
