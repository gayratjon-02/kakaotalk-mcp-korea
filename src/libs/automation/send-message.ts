import { isBlockedChat } from '../config/blocklist.js';
import { assertAppInstalled } from '../device/device-info.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { assertHelperOk, runHelper } from './helper-client.js';

export async function sendToChat(chatName: string, text: string, dryRun = false): Promise<void> {
	// checked here, below every caller, so no code path can reach the window of a blocked chat
	if (isBlockedChat(chatName)) throw new AppError(Message.CHAT_BLOCKED);
	assertAppInstalled();
	assertHelperOk(await runHelper(['send', '--chat', chatName, ...(dryRun ? ['--dry-run'] : [])], text));
}
