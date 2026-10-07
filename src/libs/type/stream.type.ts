import type { ChatMessage } from './message.type.js';

export type NewMessagesResult = {
	cursor: string;
	messages: ChatMessage[];
	// true when the call only set the starting point and returned nothing on purpose
	baseline: boolean;
};

export type LinkHit = {
	url: string;
	messageId: string;
	senderName: string | null;
	sentAt: string;
};
