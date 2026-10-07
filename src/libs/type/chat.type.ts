export type Chat = {
	id: string;
	name: string;
	type: number;
	memberCount: number;
	unreadCount: number;
	lastMessageAt: string | null;
};
