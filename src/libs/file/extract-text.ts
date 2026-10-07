import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'tsv', 'json', 'log', 'xml', 'html', 'htm', 'yml', 'yaml', 'ini', 'srt']);
const TEXTUTIL_EXTENSIONS = new Set(['docx', 'doc', 'rtf', 'odt', 'rtfd']);
const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const TOOL_TIMEOUT_MS = 30_000;
const TOOL_BUFFER = 32 * 1024 * 1024;

export type Extracted = { text: string; method: string };

function run(command: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(command, args, { timeout: TOOL_TIMEOUT_MS, maxBuffer: TOOL_BUFFER, encoding: 'utf8' }, (error, stdout) => {
			if (error) {
				const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
				return reject(missing ? new AppError(Message.FILE_TOOL_MISSING) : error);
			}
			resolve(stdout);
		});
	});
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// Office XML to plain text: paragraph ends become line breaks, tags are dropped, entities decoded
export function stripXml(xml: string): string {
	return xml
		.replace(/<\/(a:p|w:p|text:p)>/g, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&(amp|lt|gt|quot|apos);/g, (_m, name: string) => ENTITIES[name])
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function slideNumber(name: string): number {
	return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

async function pptxText(path: string): Promise<string> {
	const names = (await run('/usr/bin/unzip', ['-Z1', path]))
		.split('\n')
		.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
		.sort((a, b) => slideNumber(a) - slideNumber(b));
	const parts: string[] = [];
	for (const [index, name] of names.entries()) {
		parts.push(`--- slide ${index + 1} ---\n${stripXml(await run('/usr/bin/unzip', ['-p', path, name]))}`);
	}
	return parts.join('\n\n');
}

// returns null for types that cannot be turned into text, so the caller can report metadata only
export async function extractText(path: string, extension: string): Promise<Extracted | null> {
	if (TEXT_EXTENSIONS.has(extension)) {
		const buffer = (await readFile(path)).subarray(0, MAX_TEXT_BYTES);
		return { text: buffer.toString('utf8'), method: 'utf8' };
	}
	if (extension === 'pdf') return { text: await run('pdftotext', ['-layout', path, '-']), method: 'pdftotext' };
	if (TEXTUTIL_EXTENSIONS.has(extension)) {
		return { text: await run('/usr/bin/textutil', ['-convert', 'txt', '-stdout', path]), method: 'textutil' };
	}
	if (extension === 'pptx') return { text: await pptxText(path), method: 'pptx-xml' };
	if (extension === 'xlsx') {
		const shared = await run('/usr/bin/unzip', ['-p', path, 'xl/sharedStrings.xml']);
		return { text: stripXml(shared.replace(/<\/si>/g, '</a:p>')), method: 'xlsx-shared-strings' };
	}
	if (extension === 'zip') {
		const names = (await run('/usr/bin/unzip', ['-Z1', path])).split('\n').filter(Boolean);
		return { text: names.slice(0, 500).join('\n'), method: 'zip-listing' };
	}
	return null;
}
