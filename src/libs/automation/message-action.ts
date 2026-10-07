import { isBlockedChat } from '../config/blocklist.js';
import { assertAppInstalled } from '../device/device-info.js';
import { Message } from '../enum/message.enum.js';
import { newerIdenticalCopies, type RawMessage } from '../database/message-verify.js';
import { AppError } from '../server/app-error.js';
import { assertHelperOk, runHelper, type HelperReply } from './helper-client.js';

export type MessageActionKind = 'delete-auto' | 'delete-everyone' | 'delete-me' | 'reply' | 'react' | 'edit';

export type MessageActionRequest = {
	chatName: string;
	target: RawMessage;
	action: MessageActionKind;
	// the reply text, or the new text of an edit
	replyText?: string;
	reactionIndex?: number;
	dryRun?: boolean;
};

// Runs one context menu action on an exact message. The message is located by its exact text, counted from the newest
// copy, so an identical older message is never touched. The text goes to the helper through stdin.
export async function runMessageAction(request: MessageActionRequest): Promise<HelperReply> {
	// checked here, below every caller, so no code path can reach the window of a blocked chat
	if (isBlockedChat(request.chatName)) throw new AppError(Message.CHAT_BLOCKED);
	assertAppInstalled();
	const args = [
		'message-action',
		'--chat',
		request.chatName,
		'--do',
		request.action,
		'--nth',
		String(newerIdenticalCopies(request.target)),
		'--reaction-index',
		String(request.reactionIndex ?? 0),
		...(request.dryRun ? ['--dry-run'] : []),
	];
	const payload = JSON.stringify({ match: request.target.text, text: request.replyText ?? '' });
	return assertHelperOk(await runHelper(args, payload));
}
