import { setupAccount } from '../account/account-store.js';
import { ensureDesktopAssignment } from './desktop-step.js';
import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';

const HELP = `kakaotalk-mcp-korea

Usage:
  kakaotalk-mcp-korea          start the MCP server (stdio)
  kakaotalk-mcp-korea setup    detect the account once (can take a few minutes) and check that KakaoTalk is
                               assigned to All Desktops, which background mode needs
                               (--skip-desktop-check opts out)`;

export async function runCli(args: string[]): Promise<void> {
	if (args[0] !== 'setup') {
		console.log(HELP);
		return;
	}
	try {
		await setupAccount();
		console.log(t(Message.SETUP_DONE, env.lang));
		// required: without it window actions are refused, so an unfinished step is not reported as a finished setup
		if (!(await ensureDesktopAssignment(args))) process.exitCode = 2;
	} catch (error) {
		console.error(error instanceof AppError || error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
