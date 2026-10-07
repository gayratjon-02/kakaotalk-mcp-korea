import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { extractText, stripXml } from '../libs/file/extract-text.js';
import { writeDocxFixture, writePdfFixture, writePptxFixture, writeXlsxFixture } from './support/file-fixtures.js';

// poppler (pdftotext) is an optional system dependency — see README "Build requirements";
// skip rather than fail where it is not installed.
function hasPdftotext(): boolean {
	try {
		execFileSync('pdftotext', ['-v']);
		return true;
	} catch {
		return false;
	}
}

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

test('a .docx fixture (built by textutil) round-trips through extractText', async () => {
	const file = writeDocxFixture('Hello docx fixture');
	const result = await extractText(file, 'docx');
	assert.equal(result?.method, 'textutil');
	assert.match(result?.text ?? '', /Hello docx fixture/);
});

test('a .pptx fixture is read slide by slide, in order, with slide headers', async () => {
	const file = writePptxFixture(['First slide', 'Second slide']);
	const result = await extractText(file, 'pptx');
	assert.equal(result?.method, 'pptx-xml');
	assert.equal(result?.text, '--- slide 1 ---\nFirst slide\n\n--- slide 2 ---\nSecond slide');
});

test('an .xlsx fixture reads the shared strings table as one cell per line', async () => {
	const file = writeXlsxFixture(['Cell one', 'Cell two & three']);
	const result = await extractText(file, 'xlsx');
	assert.equal(result?.method, 'xlsx-shared-strings');
	assert.equal(result?.text, 'Cell one\nCell two & three');
});

test('a .pdf fixture is read through pdftotext', { skip: !hasPdftotext() && 'pdftotext (poppler) is not installed' }, async () => {
	const file = writePdfFixture('Hello PDF fixture');
	const result = await extractText(file, 'pdf');
	assert.equal(result?.method, 'pdftotext');
	assert.match(result?.text ?? '', /Hello PDF fixture/);
});
