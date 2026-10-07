import { Lang } from './lang.enum.js';

export enum Message {
	APP_NOT_INSTALLED = 'APP_NOT_INSTALLED',
	PREFERENCES_NOT_FOUND = 'PREFERENCES_NOT_FOUND',
	ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
	ACCOUNT_NOT_CACHED = 'ACCOUNT_NOT_CACHED',
	DATABASE_NOT_FOUND = 'DATABASE_NOT_FOUND',
	DATABASE_LOCKED = 'DATABASE_LOCKED',
	CHAT_NOT_FOUND = 'CHAT_NOT_FOUND',
	CHAT_BLOCKED = 'CHAT_BLOCKED',
	APP_NOT_RUNNING = 'APP_NOT_RUNNING',
	MAIN_WINDOW_MISSING = 'MAIN_WINDOW_MISSING',
	SEND_UNVERIFIED = 'SEND_UNVERIFIED',
	HELPER_MISSING = 'HELPER_MISSING',
	CHAT_WINDOW_NOT_OPENED = 'CHAT_WINDOW_NOT_OPENED',
	CHAT_LIST_NOT_FOUND = 'CHAT_LIST_NOT_FOUND',
	CHAT_AMBIGUOUS = 'CHAT_AMBIGUOUS',
	CURSOR_INVALID = 'CURSOR_INVALID',
	WINDOW_MISMATCH = 'WINDOW_MISMATCH',
	INPUT_NOT_FOUND = 'INPUT_NOT_FOUND',
	ACCESSIBILITY_DENIED = 'ACCESSIBILITY_DENIED',
	SEND_NOT_CONFIRMED = 'SEND_NOT_CONFIRMED',
	MESSAGE_SENT = 'MESSAGE_SENT',
	SETUP_DONE = 'SETUP_DONE',
}

const TEXT: Record<Message, Record<Lang, string>> = {
	[Message.APP_NOT_INSTALLED]: {
		[Lang.EN]: 'KakaoTalk for Mac is not installed.',
		[Lang.KO]: '카카오톡 Mac 앱이 설치되어 있지 않습니다.',
		[Lang.RU]: 'KakaoTalk для Mac не установлен.',
		[Lang.UZ]: "KakaoTalk Mac ilovasi o'rnatilmagan.",
	},
	[Message.PREFERENCES_NOT_FOUND]: {
		[Lang.EN]: 'KakaoTalk preferences were not found. Log in to KakaoTalk once and try again.',
		[Lang.KO]: '카카오톡 설정 파일을 찾을 수 없습니다. 카카오톡에 한 번 로그인한 뒤 다시 시도해 주세요.',
		[Lang.RU]: 'Настройки KakaoTalk не найдены. Войдите в KakaoTalk и повторите попытку.',
		[Lang.UZ]: "KakaoTalk sozlamalari topilmadi. KakaoTalk'ga bir marta kirib, qayta urinib ko'ring.",
	},
	[Message.ACCOUNT_NOT_FOUND]: {
		[Lang.EN]: 'Could not detect the logged-in KakaoTalk account.',
		[Lang.KO]: '로그인된 카카오톡 계정을 확인할 수 없습니다.',
		[Lang.RU]: 'Не удалось определить аккаунт KakaoTalk.',
		[Lang.UZ]: 'Kirilgan KakaoTalk akkauntini aniqlab bo‘lmadi.',
	},
	[Message.ACCOUNT_NOT_CACHED]: {
		[Lang.EN]: 'Account is not set up yet. Run `kakaotalk-mcp-korea setup` first.',
		[Lang.KO]: '아직 계정이 설정되지 않았습니다. 먼저 `kakaotalk-mcp-korea setup`을 실행해 주세요.',
		[Lang.RU]: 'Аккаунт не настроен. Сначала выполните `kakaotalk-mcp-korea setup`.',
		[Lang.UZ]: 'Akkaunt hali sozlanmagan. Avval `kakaotalk-mcp-korea setup` buyrug‘ini ishga tushiring.',
	},
	[Message.DATABASE_NOT_FOUND]: {
		[Lang.EN]: 'KakaoTalk database file was not found for this account.',
		[Lang.KO]: '이 계정의 카카오톡 데이터베이스 파일을 찾을 수 없습니다.',
		[Lang.RU]: 'Файл базы данных KakaoTalk для этого аккаунта не найден.',
		[Lang.UZ]: 'Bu akkaunt uchun KakaoTalk bazasi topilmadi.',
	},
	[Message.DATABASE_LOCKED]: {
		[Lang.EN]: 'Could not unlock the KakaoTalk database. Run `kakaotalk-mcp-korea setup` again.',
		[Lang.KO]: '카카오톡 데이터베이스를 열 수 없습니다. `kakaotalk-mcp-korea setup`을 다시 실행해 주세요.',
		[Lang.RU]: 'Не удалось открыть базу KakaoTalk. Снова выполните `kakaotalk-mcp-korea setup`.',
		[Lang.UZ]: 'KakaoTalk bazasini ochib bo‘lmadi. `kakaotalk-mcp-korea setup` ni qayta ishga tushiring.',
	},
	[Message.CHAT_NOT_FOUND]: {
		[Lang.EN]: 'No chat matches that name.',
		[Lang.KO]: '해당 이름의 채팅방이 없습니다.',
		[Lang.RU]: 'Чат с таким названием не найден.',
		[Lang.UZ]: 'Bu nomdagi chat topilmadi.',
	},
	[Message.CHAT_LIST_NOT_FOUND]: {
		[Lang.EN]: 'Could not find the chat list in the KakaoTalk window.',
		[Lang.KO]: '카카오톡 창에서 채팅 목록을 찾을 수 없습니다.',
		[Lang.RU]: 'Список чатов в окне KakaoTalk не найден.',
		[Lang.UZ]: "KakaoTalk oynasida chatlar ro'yxati topilmadi.",
	},
	[Message.CHAT_BLOCKED]: {
		[Lang.EN]: 'This chat is on the local block list. Nothing was opened or sent.',
		[Lang.KO]: '이 채팅방은 차단 목록에 있습니다. 열거나 보내지 않았습니다.',
		[Lang.RU]: 'Этот чат в списке блокировки. Ничего не открыто и не отправлено.',
		[Lang.UZ]: "Bu chat bloklash ro'yxatida. Hech narsa ochilmadi va yuborilmadi.",
	},
	[Message.CHAT_WINDOW_NOT_OPENED]: {
		[Lang.EN]: 'The chat window did not open. Nothing was sent.',
		[Lang.KO]: '채팅창이 열리지 않았습니다. 메시지를 보내지 않았습니다.',
		[Lang.RU]: 'Окно чата не открылось. Ничего не отправлено.',
		[Lang.UZ]: "Chat oynasi ochilmadi. Hech narsa yuborilmadi.",
	},
	[Message.APP_NOT_RUNNING]: {
		[Lang.EN]: 'KakaoTalk is not running and could not be started.',
		[Lang.KO]: '카카오톡이 실행 중이 아니며 시작할 수 없었습니다.',
		[Lang.RU]: 'KakaoTalk не запущен и не удалось его запустить.',
		[Lang.UZ]: "KakaoTalk ishlamayapti va uni ishga tushirib bo'lmadi.",
	},
	[Message.MAIN_WINDOW_MISSING]: {
		[Lang.EN]: 'The KakaoTalk main window is closed. Click the KakaoTalk icon in the Dock to show it, then try again.',
		[Lang.KO]: '카카오톡 메인 창이 닫혀 있습니다. Dock의 카카오톡 아이콘을 눌러 창을 연 뒤 다시 시도해 주세요.',
		[Lang.RU]: 'Главное окно KakaoTalk закрыто. Нажмите на значок KakaoTalk в Dock и повторите попытку.',
		[Lang.UZ]: "KakaoTalk asosiy oynasi yopilgan. Dock'dagi KakaoTalk belgisini bosib oynani oching va qayta urinib ko'ring.",
	},
	[Message.SEND_UNVERIFIED]: {
		[Lang.EN]: 'The text was entered but it could not be confirmed that the message was sent. Check the chat before retrying.',
		[Lang.KO]: '텍스트는 입력했지만 전송 여부를 확인하지 못했습니다. 다시 시도하기 전에 채팅방을 확인해 주세요.',
		[Lang.RU]: 'Текст введён, но отправку подтвердить не удалось. Проверьте чат, прежде чем повторять.',
		[Lang.UZ]: "Matn kiritildi, lekin yuborilgani tasdiqlanmadi. Qayta urinishdan oldin chatni tekshiring.",
	},
	[Message.HELPER_MISSING]: {
		[Lang.EN]: 'The native helper is not built. Run `npm run build` on this Mac (needs Xcode command line tools).',
		[Lang.KO]: '네이티브 도우미가 빌드되지 않았습니다. 이 Mac에서 `npm run build`를 실행해 주세요 (Xcode 명령줄 도구 필요).',
		[Lang.RU]: 'Нативный помощник не собран. Выполните `npm run build` на этом Mac (нужны инструменты командной строки Xcode).',
		[Lang.UZ]: "Native yordamchi build qilinmagan. Shu Mac'da `npm run build` ni ishga tushiring (Xcode command line tools kerak).",
	},
	[Message.CHAT_AMBIGUOUS]: {
		[Lang.EN]: 'More than one chat matches that name. Use the exact name or the chat id.',
		[Lang.KO]: '같은 이름의 채팅방이 여러 개 있습니다. 정확한 이름이나 채팅 ID를 사용해 주세요.',
		[Lang.RU]: 'Найдено несколько чатов. Укажите точное название или id чата.',
		[Lang.UZ]: 'Bu nomga bir nechta chat mos keldi. Aniq nom yoki chat id bering.',
	},
	[Message.CURSOR_INVALID]: {
		[Lang.EN]: 'The cursor is not valid. Call without a cursor to get a fresh one.',
		[Lang.KO]: '커서가 올바르지 않습니다. 커서 없이 호출해 새 커서를 받아 주세요.',
		[Lang.RU]: 'Курсор недействителен. Вызовите без курсора, чтобы получить новый.',
		[Lang.UZ]: "Kursor noto'g'ri. Yangisini olish uchun kursorsiz chaqiring.",
	},
	[Message.WINDOW_MISMATCH]: {
		[Lang.EN]: 'The opened window does not match the target chat. Nothing was sent.',
		[Lang.KO]: '열린 창이 대상 채팅방과 다릅니다. 메시지를 보내지 않았습니다.',
		[Lang.RU]: 'Открытое окно не совпадает с нужным чатом. Ничего не отправлено.',
		[Lang.UZ]: 'Ochilgan oyna kerakli chatga mos emas. Hech narsa yuborilmadi.',
	},
	[Message.INPUT_NOT_FOUND]: {
		[Lang.EN]: 'Could not find the message input in the chat window.',
		[Lang.KO]: '채팅창에서 메시지 입력란을 찾을 수 없습니다.',
		[Lang.RU]: 'Поле ввода сообщения не найдено.',
		[Lang.UZ]: 'Chat oynasida xabar yozish maydoni topilmadi.',
	},
	[Message.ACCESSIBILITY_DENIED]: {
		[Lang.EN]: 'Accessibility permission is required. Allow your terminal in System Settings → Privacy & Security → Accessibility.',
		[Lang.KO]: '손쉬운 사용 권한이 필요합니다. 시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용에서 터미널을 허용해 주세요.',
		[Lang.RU]: 'Нужен доступ к Универсальному доступу: Системные настройки → Конфиденциальность и безопасность → Универсальный доступ.',
		[Lang.UZ]: 'Accessibility ruxsati kerak: System Settings → Privacy & Security → Accessibility da terminalga ruxsat bering.',
	},
	[Message.SEND_NOT_CONFIRMED]: {
		[Lang.EN]: 'Sending requires confirm: true after the user has approved the exact text.',
		[Lang.KO]: '사용자가 내용을 확인한 뒤 confirm: true 로 요청해야 전송됩니다.',
		[Lang.RU]: 'Для отправки нужен confirm: true после подтверждения текста пользователем.',
		[Lang.UZ]: 'Yuborish uchun foydalanuvchi matnni tasdiqlagach confirm: true kerak.',
	},
	[Message.MESSAGE_SENT]: {
		[Lang.EN]: 'Message sent.',
		[Lang.KO]: '메시지를 보냈습니다.',
		[Lang.RU]: 'Сообщение отправлено.',
		[Lang.UZ]: 'Xabar yuborildi.',
	},
	[Message.SETUP_DONE]: {
		[Lang.EN]: 'Setup complete. The database opened successfully.',
		[Lang.KO]: '설정이 완료되었습니다. 데이터베이스가 정상적으로 열렸습니다.',
		[Lang.RU]: 'Настройка завершена. База данных открыта.',
		[Lang.UZ]: 'Sozlash tugadi. Baza muvaffaqiyatli ochildi.',
	},
};

export function t(key: Message, lang: Lang = Lang.EN): string {
	return TEXT[key][lang];
}
