// how an image can be read right now: already on this Mac, downloadable from the server, or gone
export type ImageAvailability = 'local' | 'download' | 'expired';

export type ChatImage = {
	messageId: string;
	chatId: string;
	// an album holds several pictures that are fetched one by one with an index
	kind: 'photo' | 'album';
	count: number;
	width: number | null;
	height: number | null;
	senderName: string | null;
	sentAt: string;
	expiresAt: string | null;
	availability: ImageAvailability;
};

// internal record: the urls and the local path are never sent to the client
export type ImageRecord = ChatImage & {
	urls: string[];
	thumbnailUrls: string[];
	localPath: string | null;
};
