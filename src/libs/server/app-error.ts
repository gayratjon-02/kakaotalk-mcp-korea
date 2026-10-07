import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';

export class AppError extends Error {
	constructor(
		public readonly code: Message,
		public readonly detail?: string,
	) {
		super(detail ? `${t(code, env.lang)} (${detail})` : t(code, env.lang));
		this.name = 'AppError';
	}
}
