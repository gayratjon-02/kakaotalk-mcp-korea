import { env } from '../config/env.js';
import { LogLevel } from '../enum/log-level.enum.js';

const ORDER: Record<LogLevel, number> = {
	[LogLevel.DEBUG]: 10,
	[LogLevel.INFO]: 20,
	[LogLevel.WARN]: 30,
	[LogLevel.ERROR]: 40,
};

// stdout is reserved for the MCP protocol, so every log line goes to stderr
function write(level: LogLevel, message: string, meta?: unknown): void {
	if (ORDER[level] < ORDER[env.logLevel]) return;
	const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
	process.stderr.write(meta === undefined ? `${line}\n` : `${line} ${JSON.stringify(meta)}\n`);
}

export const logger = {
	debug: (message: string, meta?: unknown) => write(LogLevel.DEBUG, message, meta),
	info: (message: string, meta?: unknown) => write(LogLevel.INFO, message, meta),
	warn: (message: string, meta?: unknown) => write(LogLevel.WARN, message, meta),
	error: (message: string, meta?: unknown) => write(LogLevel.ERROR, message, meta),
};
