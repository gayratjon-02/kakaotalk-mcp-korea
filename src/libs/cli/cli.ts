import { readCachedAccount, setupAccount } from '../account/account-store.js';
import { paths } from '../config/paths.js';
import { closeDb } from '../database/connection.js';
import { listChats, listMessages, maxLogId, messagesAfter, resolveChat, searchMessages } from '../database/chat-repository.js';
import { env } from '../config/env.js';
import { Message, t } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { existsSync } from 'node:fs';

const HELP = `kakaotalk-mcp-korea

Usage:
  kakaotalk-mcp-korea                      start the MCP server (stdio)
  kakaotalk-mcp-korea setup                detect the account once (can take a few minutes)
  kakaotalk-mcp-korea status               show installation and account state
  kakaotalk-mcp-korea chats [limit]        list chats as JSON
  kakaotalk-mcp-korea messages <chat> [n]  recent messages of a chat
  kakaotalk-mcp-korea search <text> [n]    search message text
  kakaotalk-mcp-korea sync [seconds]       stream new messages as NDJSON`;

const print = (data: unknown) => console.log(JSON.stringify(data, null, 2));
const numberOr = (value: string | undefined, fallback: number) => (Number(value) > 0 ? Number(value) : fallback);

async function follow(intervalSeconds: number): Promise<void> {
	let last = maxLogId();
	for (;;) {
		for (const message of messagesAfter(last)) {
			console.log(JSON.stringify(message));
			last = message.id;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
	}
}

export async function runCli(args: string[]): Promise<void> {
	const [command, first, second] = args;
	try {
		switch (command) {
			case 'setup':
				await setupAccount();
				console.log(t(Message.SETUP_DONE, env.lang));
				break;
			case 'status': {
				const account = readCachedAccount();
				print({ appInstalled: existsSync(paths.app), accountCached: account !== null, databaseFile: account?.databaseFile });
				break;
			}
			case 'chats':
				print(listChats(numberOr(first, 30)));
				break;
			case 'messages':
				if (!first) throw new Error(HELP);
				print(listMessages({ chatId: resolveChat(first).id, limit: numberOr(second, 50) }));
				break;
			case 'search':
				if (!first) throw new Error(HELP);
				print(searchMessages(first, numberOr(second, 20)));
				break;
			case 'sync':
				await follow(numberOr(first, 2));
				break;
			default:
				console.log(HELP);
		}
	} catch (error) {
		console.error(error instanceof AppError ? error.message : error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	} finally {
		closeDb();
	}
}
