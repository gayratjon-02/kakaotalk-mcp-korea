import { setupAccount } from '../account/account-store.js';
import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';

const HELP = `kakaotalk-mcp-korea

Usage:
  kakaotalk-mcp-korea          start the MCP server (stdio)
  kakaotalk-mcp-korea setup    detect the account once (can take a few minutes)`;

export async function runCli(args: string[]): Promise<void> {
	if (args[0] !== 'setup') {
		console.log(HELP);
		return;
	}
	try {
		await setupAccount();
		console.log(t(Message.SETUP_DONE, env.lang));
	} catch (error) {
		console.error(error instanceof AppError || error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
