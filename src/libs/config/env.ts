import { LogLevel } from '../enum/log-level.enum.js';

function toLogLevel(value: string | undefined): LogLevel {
	const levels = Object.values(LogLevel) as string[];
	return value && levels.includes(value) ? (value as LogLevel) : LogLevel.INFO;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
	appName: process.env.KAKAOTALK_APP_NAME ?? 'KakaoTalk',
	scriptTimeoutMs: toPositiveInt(process.env.KAKAOTALK_SCRIPT_TIMEOUT_MS, 15000),
	logLevel: toLogLevel(process.env.KAKAOTALK_LOG_LEVEL),
} as const;
