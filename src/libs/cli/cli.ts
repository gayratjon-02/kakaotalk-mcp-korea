import { readCachedAccount, setupAccount } from '../account/account-store.js';
import { closeDb, getDb } from '../database/connection.js';
import { ensureDesktopAssignment } from './desktop-step.js';
import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';

const HELP = `kakaotalk-mcp-korea

Usage:
  kakaotalk-mcp-korea          start the MCP server (stdio)
  kakaotalk-mcp-korea setup    detect the account once (can take a few minutes) and check that KakaoTalk is
                               assigned to All Desktops, which background mode needs
                               (--skip-desktop-check opts out; --redetect searches the account again)`;

// a cached account only counts when its database really opens with the derived key
function cachedAccountWorks(): boolean {
	if (!readCachedAccount()) return false;
	try {
		getDb();
		closeDb();
		return true;
	} catch {
		return false;
	}
}

export async function runCli(args: string[]): Promise<void> {
	if (args[0] !== 'setup') {
		console.log(HELP);
		return;
	}
	try {
		// the userId search can take minutes, so a working cached account is kept; --redetect forces a new search
		if (!cachedAccountWorks() || args.includes('--redetect')) await setupAccount();
		// the message below says the database opened, so it is opened here for real; a failure is reported as the error it is
		getDb();
		closeDb();
		console.log(t(Message.SETUP_DONE, env.lang));
		// required: without it window actions are refused, so an unfinished step is not reported as a finished setup
		if (!(await ensureDesktopAssignment(args))) process.exitCode = 2;
	} catch (error) {
		console.error(error instanceof AppError || error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
