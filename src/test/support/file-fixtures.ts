import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// All fixtures are generated on the fly in a throwaway temp dir — no real user documents.
function tempDir(): string {
	return mkdtempSync(join(tmpdir(), 'kt-fixture-'));
}

// textutil (the same tool extractText uses for reading) can also write, so this round-trips
// through a real, valid .docx instead of a hand-built one.
export function writeDocxFixture(text: string): string {
	const dir = tempDir();
	const source = join(dir, 'source.txt');
	const target = join(dir, 'doc.docx');
	writeFileSync(source, text);
	execFileSync('/usr/bin/textutil', ['-convert', 'docx', '-output', target, source]);
	return target;
}

// a .pptx is a zip of OOXML; extractText only reads ppt/slides/slideN.xml and strips tags,
// so a minimal <a:p>/<a:r>/<a:t> fragment per slide is enough without a full OOXML document.
export function writePptxFixture(slideTexts: string[]): string {
	const dir = tempDir();
	const slidesDir = join(dir, 'src', 'ppt', 'slides');
	mkdirSync(slidesDir, { recursive: true });
	slideTexts.forEach((text, index) => {
		writeFileSync(join(slidesDir, `slide${index + 1}.xml`), `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`);
	});
	const target = join(dir, 'deck.pptx');
	execFileSync('/usr/bin/zip', ['-qr', target, 'ppt'], { cwd: join(dir, 'src') });
	return target;
}

// an .xlsx is a zip too; extractText only reads xl/sharedStrings.xml and splits on </si>.
export function writeXlsxFixture(cellTexts: string[]): string {
	const dir = tempDir();
	const xlDir = join(dir, 'src', 'xl');
	mkdirSync(xlDir, { recursive: true });
	const body = cellTexts.map((text) => `<si><t>${text}</t></si>`).join('');
	writeFileSync(join(xlDir, 'sharedStrings.xml'), body);
	const target = join(dir, 'book.xlsx');
	execFileSync('/usr/bin/zip', ['-qr', target, 'xl'], { cwd: join(dir, 'src') });
	return target;
}

// A hand-built, minimal single-page PDF with one Tj text-showing operator. Valid enough for
// pdftotext to read, with no dependency on a PDF-writing library.
export function writePdfFixture(text: string): string {
	const dir = tempDir();
	const target = join(dir, 'doc.pdf');
	const content = Buffer.from(`BT /F1 24 Tf 72 700 Td (${text}) Tj ET`, 'latin1');
	const objects = [
		Buffer.from('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj'),
		Buffer.from('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj'),
		Buffer.from(
			'3 0 obj<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>endobj',
		),
		Buffer.concat([
			Buffer.from(`4 0 obj<< /Length ${content.length} >>stream\n`),
			content,
			Buffer.from('\nendstream endobj'),
		]),
		Buffer.from('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj'),
	];
	let out = Buffer.from('%PDF-1.4\n');
	const offsets: number[] = [];
	for (const object of objects) {
		offsets.push(out.length);
		out = Buffer.concat([out, object, Buffer.from('\n')]);
	}
	const xrefOffset = out.length;
	let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
	xref += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
	out = Buffer.concat([out, Buffer.from(xref)]);
	writeFileSync(target, out);
	return target;
}
