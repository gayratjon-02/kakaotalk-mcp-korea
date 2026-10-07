import type { ChatMessage } from '../type/message.type.js';
import type { LinkHit } from '../type/stream.type.js';

const URL_PATTERN = /https?:\/\/[^\s<>"'\]]+/gi;
const TRAILING = /[.,;:!?)。，]+$/;

export function linksIn(text: string | null): string[] {
	if (!text) return [];
	return (text.match(URL_PATTERN) ?? []).map((url) => url.replace(TRAILING, '')).filter((url) => url.length > 8);
}

// newest first in, newest first out; a link shared twice is reported once with its latest message
export function collectLinks(messages: ChatMessage[]): LinkHit[] {
	const seen = new Set<string>();
	const hits: LinkHit[] = [];
	for (const message of messages) {
		for (const url of linksIn(message.text)) {
			if (seen.has(url)) continue;
			seen.add(url);
			hits.push({ url, messageId: message.id, senderName: message.senderName, sentAt: message.sentAt });
		}
	}
	return hits;
}
