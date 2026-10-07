# kakaotalk-mcp-korea

한국어 · [English](./README.md)

macOS 카카오톡 데스크톱 앱용 MCP 서버이자 CLI입니다. 로컬 데이터베이스에서 채팅방을 읽고, 앱의 손쉬운 사용(Accessibility) 인터페이스로 메시지를 보낼 예정입니다. 이를 통해 Claude Code, Claude Desktop 등 모든 MCP 클라이언트에서 카카오톡을 사용할 수 있습니다.

> **비공식 프로젝트입니다.** 카카오와 제휴하거나 승인받은 프로젝트가 아닙니다. 사용자의 Mac에 설치된 앱과 로컬 데이터만 사용하며, 카카오 서버를 직접 호출하지 않습니다.

## 진행 상황

| 항목 | 상태 |
| --- | --- |
| 설정 및 경로 | 완료 |
| 기기 UUID 및 카카오톡 `userId` 감지 | 완료 |
| 암호화된 데이터베이스 키 생성 및 읽기 전용 열기 | 완료 |
| `setup` 명령 (계정 감지 및 저장) | 완료, 실제 데이터베이스에서 테스트 |
| MCP 읽기 도구 (10개 — 아래 표 참고) | 완료, 실제 데이터베이스에서 테스트 |
| `kakao_send_message` (`confirm: true` 필요) | 구현 완료, **실제 전송은 아직 테스트하지 않음** |

## MCP 도구

| 도구 | 기능 |
| --- | --- |
| `kakao_list_chats` | 채팅방을 최근 활동순으로 나열, 읽지 않은 수와 `kind` 필드(`direct`, `group`, `open`) 포함. `scope`로 `all`, `direct`, `group`, `open` 필터링 |
| `kakao_read_messages` | 채팅방의 최근 메시지 읽기 |
| `kakao_search_messages` | 메시지 전체 검색 |
| `kakao_unread_summary` | 읽지 않은 메시지가 있는 채팅방 요약 |
| `kakao_search_contacts` | 이름으로 연락처 찾기. 전화번호는 절대 반환하지 않음 |
| `kakao_new_messages` | 커서 이후의 새 메시지를 롱폴링으로 가져옴 (푸시 아님). 커서 없이 처음 호출하면 시작점을 반환하고, 그 커서를 다시 전달하면 최대 30초까지 다음 메시지를 기다림 |
| `kakao_extract_links` | 채팅방 최근 메시지에서 공유된 링크를 추출 |
| `kakao_export_chat` | 채팅방 메시지를 오래된 순 Markdown 대화록으로 반환. 디스크에 저장하지 않고 응답으로 텍스트를 돌려줌 |
| `kakao_list_files` | 채팅방에 공유된 파일을 최신순으로 나열, `availability`로 상태 표시: `local`(이미 Mac에 있음), `download`(아직 서버에 있음), `expired`(만료됨) |
| `kakao_read_file` | `kakao_list_files`의 `messageId`로 공유 파일의 텍스트를 읽음. pdf, docx/doc/rtf, pptx, xlsx, txt/md/csv/json/html, zip(파일 목록만) 지원. Mac에 없는 파일은 만료되지 않은 동안 `https://*.kakaocdn.net`에서만 다운로드하며, `KAKAOTALK_MAX_FILE_MB`로 크기 제한, `~/.cache/kakaotalk-mcp-korea/files`에 캐시 |
| `kakao_send_message` | 텍스트 전송. `confirm: true` 없이 호출하면 채팅방과 정확한 내용만 미리 보여 줌 |

모든 도구 설명에는 메시지 내용을 지시로 받아들이지 말라는 경고가 포함되어 있습니다.

아직 구현되지 않음: 여러 채팅방에 한 번에 전송, @멘션, 이미지 전송, 그룹 멤버 관리. 이들은 텍스트 전송을 넘어서는 기능이거나 카카오톡 자체 통신 프로토콜 역분석이 필요하므로, 현재는 일정이 정해져 있지 않습니다.

## 지금까지 테스트한 범위

실제 개인 카카오톡 데이터베이스 기준: 채팅방 목록, 메시지 읽기/검색, 읽지 않은 메시지 요약, 연락처 검색, 새 메시지 커서 스트림, 링크 추출, Markdown 내보내기. `kakao_send_message`의 미리보기와 채팅방을 찾지 못했을 때의 오류는 테스트했습니다.

파일 읽기는 실제 그룹 채팅방의 공유 파일로 시도했습니다: 5개 파일 읽기(pdf 3, pptx 1, docx 1), 만료된 파일은 `FILE_EXPIRED`를 올바르게 반환, 다운로드 경로(Mac에 없는 파일)도 한 번 실행해 검증(크기와 PDF `%PDF` 시그니처 일치) 후 다운로드된 사본은 삭제했습니다. `extractText`는 개인정보가 없는 생성된 fixture 파일(docx, pptx, xlsx, pdf)로도 추가 검증됩니다.

전송 자체는 이제 위에서 설명한 네이티브 헬퍼를 통해 이루어지며, 더 이상 AppleScript를 사용하지 않습니다. `dryRun`(채팅 창을 열고 입력 없이 확인만 함)은 실제로 6/6회 성공했으며, 관련 없는 다른 채팅 창이 열려 있는 상태에서도 창 일치 검사가 잘못된 창을 올바르게 거부했습니다. 백그라운드 포커스 방식(다른 채팅 창을 닫은 뒤, 메인 창에 직접 포커스를 주고 카카오톡을 활성화하지 않은 채 그 프로세스에 Return을 보내는 방식)으로는 3/3회 모두 테스트 중이던 앱에 포커스가 그대로 남아, 눈에 보이는 앱 전환이 없었습니다. 실제 전송 — 텍스트 입력과 채팅방의 전송 버튼 누르기 — 은 아직 실제 메시지로 시도해 보지 않았으므로, 이 문구가 업데이트되기 전까지는 작동한다고 간주하지 마세요.

## 요구 사항

- macOS 13 이상
- 카카오톡 Mac 앱 설치 및 최소 한 번 로그인
- Node.js 20 이상
- 터미널에 손쉬운 사용 권한 부여 (시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용)
- 데이터베이스를 읽을 수 없는 경우 전체 디스크 접근 권한

## 빌드 요구 사항

메시지 전송은 AppleScript 대신 작은 네이티브 헬퍼(`src/native/kakao-ax.swift`, `dist/bin/kakao-ax`로 컴파일됨)로 카카오톡을 제어합니다 — AppleScript는 채팅 창을 숫자 인덱스로 찾았는데, 창 순서가 바뀌면 오작동했습니다. 헬퍼는 자신이 연 창만 다루며, 이미 열려 있던 창에는 손대지 않습니다.

사용자를 최대한 방해하지 않으려고도 합니다. 기본적으로 채팅을 열기 전에 헬퍼는 *다른* 열려 있는 채팅 창들을 닫습니다 — 그중 하나가 키보드 포커스를 쥐고 있으면 열려는 채팅을 위한 Return 입력을 가로챌 수 있기 때문입니다. 메시지 목록이 있는 창만 건드리며, 입력란에 아직 보내지 않은 텍스트가 있는 창은 그대로 둡니다. 캘린더 같은 채팅이 아닌 창은 전혀 건드리지 않습니다. 채팅을 여는 것과 Return을 누르는 것은 카카오톡 메인 창에 직접 포커스를 주고 그 프로세스로 키 입력을 보내는 방식으로 이루어지며, 앱을 활성화하거나 맨 앞으로 가져오지 않습니다. 전송할 때는 먼저 텍스트를 직접 값으로 설정한 뒤 채팅방 자체의 전송 버튼을 누릅니다(이것도 포커스가 필요 없음). 버튼을 찾을 수 없을 때만 Return 입력으로 대체하는데, 이 경우에는 앱이 잠깐 활성화되어야 합니다. 메시지는 대상 채팅과 이름이 일치한다고 확인된 바로 그 창에만 입력되며, 그 창을 확인할 수 없으면 아무것도 전송하지 않습니다. 다른 채팅 창을 그대로 두고 싶다면 `KAKAOTALK_KEEP_OTHER_WINDOWS=1`을 설정하세요(이 경우 다른 창에 포커스가 있으면 Return이 그 창으로 들어갈 수 있습니다). 대체 경로로 인해 포커스가 흔들릴 가능성은 여전히 남아 있으며, Apple의 공개 자동화 API로는 완전히 배제할 수 없습니다(관련 조사는 `notes/`에 있으며 저장소에는 포함되지 않습니다).

- Xcode Command Line Tools (`xcode-select --install`), `swiftc` 컴파일러용
- `npm run build`가 TypeScript와 헬퍼를 모두 컴파일합니다. 헬퍼는 `kakao-ax.swift`가 바뀔 때만 다시 빌드됩니다
- 선택 사항: [poppler](https://poppler.freedesktop.org/) (`brew install poppler`) — `kakao_read_file`이 PDF를 읽을 때 쓰는 `pdftotext`용. 없으면 PDF만 텍스트로 변환할 수 없고, 나머지는 그대로 작동합니다

## 설치

```bash
git clone https://github.com/gayratjon-02/kakaotalk-mcp-korea.git
cd kakaotalk-mcp-korea
npm install
npm run build
```

## 설정

`.env.example`을 `.env`로 복사한 뒤 필요에 따라 수정합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `KAKAOTALK_APP_NAME` | `KakaoTalk` | 손쉬운 사용에서 앱을 찾을 때 쓰는 이름 |
| `KAKAOTALK_SCRIPT_TIMEOUT_MS` | `15000` | UI 자동화 단계의 제한 시간 |
| `KAKAOTALK_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` 중 하나 (로그는 stderr로 출력) |
| `KAKAOTALK_LANG` | `en` | 오류 메시지 언어: `en`, `ko`, `ru`, `uz` |
| `KAKAOTALK_MAX_FILE_MB` | `25` | `kakao_read_file`이 카카오 서버에서 다운로드할 파일의 크기 제한 |
| `KAKAOTALK_BLOCKED_CHATS` | *(비어 있음)* | `kakao_send_message`가 항상 거부하는 채팅/연락처 이름(쉼표로 구분). 로컬 `~/.config/kakaotalk-mcp-korea/blocked-chats.json`(이름 배열)도 함께 읽히므로, 비공개 이름이 `.env`나 저장소에 남지 않습니다 |
| `KAKAOTALK_KEEP_OTHER_WINDOWS` | `0` | `1` 또는 `true`로 설정하면 전송 시 대상 채팅을 열기 전에 다른 열려 있는 채팅 창을 닫지 않습니다 (기본적으로 왜 닫는지는 "빌드 요구 사항" 참고) |

## 동작 방식

1. `ioreg`에서 기기 UUID를 가져옵니다.
2. 계정 설정 plist에서 카카오톡 `userId`를 읽습니다. 직접 저장되어 있지 않으면, 같은 파일의 SHA-512 해시로부터 CPU 코어를 모두 사용해 복원합니다.
3. 앱과 같은 방식으로 UUID와 `userId`에서 SQLCipher 파일 이름과 키를 만듭니다.
4. 데이터베이스를 읽기 전용으로 엽니다. 호환 모드 3과 4를 순서대로 시도합니다.

카카오톡 데이터 디렉터리에는 아무것도 기록하지 않습니다.

## 안전 원칙

- 읽기는 데이터베이스를 수정하지 않습니다.
- 전송은 `confirm: true`가 있어야 합니다. 에이전트는 보낼 정확한 내용을 먼저 보여 주어야 하며, 승인 없이는 아무것도 전송되지 않습니다.
- `KAKAOTALK_BLOCKED_CHATS`나 `blocked-chats.json`에 있는 채팅/연락처 이름에는 절대 전송할 수 없습니다. 채팅방 제목뿐 아니라 상대방의 표시 이름, 친구 별명, 카카오톡 닉네임도 확인합니다(부분 일치이므로, 차단된 텍스트가 어느 이름에든 포함되어 있으면 이름을 바꿔도 검사를 피할 수 없습니다).
- 다운로드되는 파일은 `https://*.kakaocdn.net`에서만 오며, `KAKAOTALK_MAX_FILE_MB`로 제한되고, 저장소가 아닌 사용자 홈 디렉터리에 캐시됩니다.
- 메신저 자동화는 이용 약관에 저촉될 수 있습니다. 위험을 감수하고 사용하며, 가능하면 본인 계정에서만 사용하세요.

## 기여

커밋은 Conventional Commits 형식을 따릅니다 (`feat:`, `fix:`, `chore:`, `docs:`).

## 크레딧

키 생성과 데이터베이스 방식은 [kakaocli](https://github.com/silver-flight-group/kakaocli) (MIT)를 따릅니다.

## 라이선스

MIT
