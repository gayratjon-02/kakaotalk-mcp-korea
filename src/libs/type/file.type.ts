// how a file can be read right now: already on this Mac, downloadable from the server, or gone
export type FileAvailability = 'local' | 'download' | 'expired';

export type ChatFile = {
	messageId: string;
	chatId: string;
	name: string;
	extension: string;
	size: number;
	senderName: string | null;
	sentAt: string;
	expiresAt: string | null;
	availability: FileAvailability;
};

// internal record: carries the download url and local path, which are never sent to the client
export type FileRecord = ChatFile & {
	url: string | null;
	localPath: string | null;
};

export type FileText = {
	messageId: string;
	name: string;
	origin: 'local' | 'download';
	method: string;
	text: string;
	totalChars: number;
	truncated: boolean;
};

export type FileMetadataOnly = {
	messageId: string;
	name: string;
	origin: 'local' | 'download';
	size: number;
	note: string;
};
