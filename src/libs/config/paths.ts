import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();
const CONTAINER = join(HOME, 'Library/Containers/com.kakao.KakaoTalkMac/Data/Library');

export const paths = {
	app: '/Applications/KakaoTalk.app',
	dataDir: join(CONTAINER, 'Application Support/com.kakao.KakaoTalkMac'),
	containerPrefsDir: join(CONTAINER, 'Preferences'),
	globalPrefs: join(HOME, 'Library/Preferences/com.kakao.KakaoTalkMac.plist'),
	configDir: join(HOME, '.config/kakaotalk-mcp-korea'),
	accountFile: join(HOME, '.config/kakaotalk-mcp-korea/account.json'),
	blockedFile: join(HOME, '.config/kakaotalk-mcp-korea/blocked-chats.json'),
} as const;
