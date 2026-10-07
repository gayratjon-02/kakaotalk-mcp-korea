import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findContact, readAccountInfo, readOwnProfile } from '../database/account-repository.js';
import { fetchProfileImage } from '../file/profile-image.js';
import { Message } from '../enum/message.enum.js';
import { AppError } from '../server/app-error.js';
import { fail, run } from './tool-result.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export function registerAccountTools(server: McpServer): void {
	server.registerTool(
		'kakao_account_info',
		{
			title: 'Show the connected KakaoTalk account',
			description:
				'Full overview of the connected account: own profile (name, status, picture link, login id, phone number, open chat profiles), app version, ' +
				'chat counts by kind (direct, group, open) with unread totals and folders, contact counts, message and file totals, calendar. ' +
				'The phone number comes from the local database or from the login id when the account logs in with a phone number.',
			inputSchema: {},
			annotations: READ_ONLY,
		},
		async () => run(() => readAccountInfo()),
	);

	server.registerTool(
		'kakao_contact_profile',
		{
			title: 'Look up a contact profile',
			description: 'Find a contact by name or user id and return name, status message, picture link and flags. Phone numbers are never returned.',
			inputSchema: { query: z.string().min(1) },
			annotations: READ_ONLY,
		},
		async ({ query }) => run(() => findContact(query)),
	);

	server.registerTool(
		'kakao_profile_image',
		{
			title: 'Get a profile picture',
			description:
				'Return a profile picture as an image. Without userId it is the connected account. Downloads from the Kakao CDN only (https, size limited).',
			inputSchema: { userId: z.string().regex(/^\d{1,19}$/).optional() },
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async ({ userId }) => {
			try {
				const own = readOwnProfile();
				const target = userId && userId !== own.userId ? findContact(userId)[0] : undefined;
				const url = userId && userId !== own.userId ? target?.profileImageUrl : own.profileImageUrl;
				if (!url) throw new AppError(Message.FILE_NOT_FOUND);
				const image = await fetchProfileImage(url);
				const name = target?.name ?? own.name ?? 'profile';
				return {
					content: [
						{ type: 'text' as const, text: `Profile picture of ${name}` },
						{ type: 'image' as const, data: image.base64, mimeType: image.mimeType },
					],
				};
			} catch (error) {
				return fail(error);
			}
		},
	);
}
