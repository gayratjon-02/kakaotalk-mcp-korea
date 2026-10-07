export type ChatMessage = {
	id: string;
	chatId: string;
	chatName?: string;
	senderId: string;
	senderName: string | null;
	fromMe: boolean;
	kind: string;
	text: string | null;
	sentAt: string;
};
