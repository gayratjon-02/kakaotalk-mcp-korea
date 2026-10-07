export type OpenProfile = {
	linkId: string;
	name: string | null;
	imageUrl: string | null;
};

export type OwnProfile = {
	userId: string;
	accountId: string | null;
	name: string | null;
	statusMessage: string | null;
	profileImageUrl: string | null;
	// from the local database, or taken from the login id when that is a phone number
	phoneNumber: string | null;
	// the id used to log in: an email or a phone number
	loginId: string | null;
	openProfiles: OpenProfile[];
};

export type AppInfo = {
	version: string | null;
	build: string | null;
	country: string | null;
	locale: string | null;
};

export type ChatSummary = {
	total: number;
	direct: number;
	group: number;
	open: number;
	chatsWithUnread: number;
	unreadMessages: number;
	folders: string[];
};

export type ContactSummary = {
	total: number;
	favorites: number;
	hidden: number;
	// raw KakaoTalk friend type codes; their meaning is not documented
	byFriendType: Record<string, number>;
};

export type AccountInfo = {
	profile: OwnProfile;
	app: AppInfo;
	chats: ChatSummary;
	contacts: ContactSummary;
	messages: { total: number; firstAt: string | null; lastAt: string | null };
	files: { total: number };
	calendar: { calendars: number; events: number };
};

export type ContactProfile = {
	userId: string;
	name: string;
	displayName: string | null;
	friendNickName: string | null;
	statusMessage: string | null;
	profileImageUrl: string | null;
	favorite: boolean;
	hidden: boolean;
};
