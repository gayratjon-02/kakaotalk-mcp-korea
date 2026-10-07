import type { ChatMessage } from '../type/message.type.js';

function stamp(iso: string): string {
	return iso.slice(0, 16).replace('T', ' ');
}

function body(message: ChatMessage): string {
	if (message.deleted) return '[deleted]';
	if (message.kind === 'text' || message.kind === 'reply') return message.text ?? '';
	return `[${message.kind}]${message.text ? ` ${message.text}` : ''}`;
}

// input is newest first (as the queries return it); the transcript reads oldest first
export function toMarkdown(chatName: string, messages: ChatMessage[]): string {
	const lines = [`# ${chatName}`, ''];
	for (const message of [...messages].reverse()) {
		const who = message.fromMe ? 'me' : (message.senderName ?? message.senderId);
		lines.push(`- ${stamp(message.sentAt)} **${who}**: ${body(message).replace(/\n/g, ' / ')}`);
	}
	return lines.join('\n');
}
