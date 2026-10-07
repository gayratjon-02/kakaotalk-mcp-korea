// KakaoTalk stores the message kind as an integer in NTChatMessage.type
export enum MessageKind {
	SYSTEM = 0,
	TEXT = 1,
	PHOTO = 2,
	VIDEO = 3,
	VOICE = 4,
	STICKER = 5,
	FILE = 6,
	LOCATION = 7,
}

export const MESSAGE_KIND_LABEL: Record<number, string> = {
	[MessageKind.SYSTEM]: 'system',
	[MessageKind.TEXT]: 'text',
	[MessageKind.PHOTO]: 'photo',
	[MessageKind.VIDEO]: 'video',
	[MessageKind.VOICE]: 'voice',
	[MessageKind.STICKER]: 'sticker',
	[MessageKind.FILE]: 'file',
	[MessageKind.LOCATION]: 'location',
};
