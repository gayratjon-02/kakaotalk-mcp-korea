// KakaoTalk stores the message kind as an integer in NTChatMessage.type.
// Values below were checked against a real database; unseen kinds report as "other".
export enum MessageKind {
	SYSTEM = 0,
	TEXT = 1,
	PHOTO = 2,
	VIDEO = 3,
	STICKER = 12,
	FILE = 18,
	EMOTICON = 20,
	REPLY = 26,
	PHOTO_ALBUM = 27,
	CALL = 51,
	CARD = 71,
	LINK_CARD = 72,
	SHARE_CARD = 73,
	APP_NOTICE = 98,
}

// stored kinds at or above this value are the base kind with an extra flag, e.g. 16385 is text
const FLAG_OFFSET = 16384;

export const MESSAGE_KIND_LABEL: Record<number, string> = {
	[MessageKind.SYSTEM]: 'system',
	[MessageKind.TEXT]: 'text',
	[MessageKind.PHOTO]: 'photo',
	[MessageKind.VIDEO]: 'video',
	[MessageKind.STICKER]: 'sticker',
	[MessageKind.FILE]: 'file',
	[MessageKind.EMOTICON]: 'sticker',
	[MessageKind.REPLY]: 'reply',
	[MessageKind.PHOTO_ALBUM]: 'photo_album',
	[MessageKind.CALL]: 'call',
	[MessageKind.CARD]: 'card',
	[MessageKind.LINK_CARD]: 'card',
	[MessageKind.SHARE_CARD]: 'card',
	[MessageKind.APP_NOTICE]: 'system',
};

export function kindLabel(type: number): string {
	const base = type >= FLAG_OFFSET ? type - FLAG_OFFSET : type;
	return MESSAGE_KIND_LABEL[base] ?? 'other';
}
