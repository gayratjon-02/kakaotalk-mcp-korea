import { AppError } from '../server/app-error.js';
import { logger } from '../server/logger.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

export function ok(data: unknown): ToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// AppError messages are already localized and safe to show; anything else is logged and masked
export function fail(error: unknown): ToolResult {
	if (error instanceof AppError) return { content: [{ type: 'text', text: error.message }], isError: true };
	logger.error('tool failed', { error: error instanceof Error ? error.message : String(error) });
	return { content: [{ type: 'text', text: 'Unexpected error. See server log.' }], isError: true };
}

export function run<T>(task: () => T): ToolResult {
	try {
		return ok(task());
	} catch (error) {
		return fail(error);
	}
}
