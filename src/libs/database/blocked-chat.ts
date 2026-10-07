import { isBlockedChat } from '../config/blocklist.js';
import type { Chat } from '../type/chat.type.js';
import { getDb } from './connection.js';

// A direct chat is blocked when its other person carries a blocked name under ANY of their
// name fields, so renaming a contact or a chat title cannot slip past the name check.
function peerIsBlocked(chatId: string): boolean {
	const row = getDb()
		.prepare(
			`SELECT u.displayName AS display, u.friendNickName AS friend, u.nickName AS nick
			FROM NTChatRoom r JOIN NTUser u ON r.directChatMemberUserId = u.userId AND u.linkId = 0
			WHERE r.chatId = ?`,
		)
		.get(chatId) as { display: string | null; friend: string | null; nick: string | null } | undefined;
	if (!row) return false;
	return [row.display, row.friend, row.nick].some((name) => Boolean(name) && isBlockedChat(name as string));
}

export function isChatBlocked(chat: Chat): boolean {
	return isBlockedChat(chat.name) || peerIsBlocked(chat.id);
}
