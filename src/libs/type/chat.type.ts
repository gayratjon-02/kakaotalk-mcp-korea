export type ChatKind = 'direct' | 'group' | 'open';
export type ChatScope = ChatKind | 'all';

export type Chat = {
	id: string;
	name: string;
	type: number;
	kind: ChatKind;
	memberCount: number;
	unreadCount: number;
	lastMessageAt: string | null;
};
