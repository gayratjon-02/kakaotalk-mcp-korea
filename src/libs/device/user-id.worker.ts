import { hash } from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import type { HashSearchJob } from '../type/hash-search.type.js';

const job = workerData as HashSearchJob;
const REPORT_EVERY = 5_000_000;

let found: number | null = null;
for (let i = job.start, n = 0; i < job.max; i += job.step, n++) {
	if (hash('sha512', String(i)) === job.target) {
		found = i;
		break;
	}
	if (n % REPORT_EVERY === 0 && n > 0) parentPort?.postMessage({ type: 'progress', value: i });
}

parentPort?.postMessage({ type: 'done', value: found });
