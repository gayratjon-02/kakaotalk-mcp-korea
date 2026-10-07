export type ReplySource = {
	messageId: string;
	preview: string | null;
};

export type ChatMessage = {
	id: string;
	chatId: string;
	chatName?: string;
	senderId: string;
	senderName: string | null;
	fromMe: boolean;
	kind: string;
	// the sender unsent (deleted) this message; text is withheld rather than kept around after a recall
	deleted: boolean;
	text: string | null;
	// present only for a reply (kind "reply"); the quoted message's id and a short preview of its text
	replyTo?: ReplySource;
	sentAt: string;
};
