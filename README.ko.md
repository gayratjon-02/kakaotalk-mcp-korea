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
| MCP 읽기 도구 (`kakao_list_chats`, `kakao_read_messages`, `kakao_search_messages`, `kakao_unread_summary`, `kakao_search_contacts`) | 완료, 실제 데이터베이스에서 테스트 |
| `kakao_send_message` (`confirm: true` 필요) | 구현 완료, **실제 전송은 아직 테스트하지 않음** |

## MCP 도구

| 도구 | 기능 |
| --- | --- |
| `kakao_list_chats` | 채팅방 목록 (1:1, 그룹, 오픈채팅) |
| `kakao_read_messages` | 채팅방의 최근 메시지 읽기 |
| `kakao_search_messages` | 메시지 전체 검색 |
| `kakao_unread_summary` | 읽지 않은 메시지가 있는 채팅방 요약 |
| `kakao_search_contacts` | 이름으로 연락처 찾기. 전화번호는 절대 반환하지 않음 |
| `kakao_send_message` | 텍스트 전송. `confirm: true` 없이 호출하면 채팅방과 정확한 내용만 미리 보여 줌 |

## 요구 사항

- macOS 13 이상
- 카카오톡 Mac 앱 설치 및 최소 한 번 로그인
- Node.js 20 이상
- 터미널에 손쉬운 사용 권한 부여 (시스템 설정 → 개인정보 보호 및 보안 → 손쉬운 사용)
- 데이터베이스를 읽을 수 없는 경우 전체 디스크 접근 권한

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

## 동작 방식

1. `ioreg`에서 기기 UUID를 가져옵니다.
2. 계정 설정 plist에서 카카오톡 `userId`를 읽습니다. 직접 저장되어 있지 않으면, 같은 파일의 SHA-512 해시로부터 CPU 코어를 모두 사용해 복원합니다.
3. 앱과 같은 방식으로 UUID와 `userId`에서 SQLCipher 파일 이름과 키를 만듭니다.
4. 데이터베이스를 읽기 전용으로 엽니다. 호환 모드 3과 4를 순서대로 시도합니다.

카카오톡 데이터 디렉터리에는 아무것도 기록하지 않습니다.

## 안전 원칙

- 읽기는 데이터베이스를 수정하지 않습니다.
- 전송은 `confirm: true`가 있어야 합니다. 에이전트는 보낼 정확한 내용을 먼저 보여 주어야 하며, 승인 없이는 아무것도 전송되지 않습니다.
- 메신저 자동화는 이용 약관에 저촉될 수 있습니다. 위험을 감수하고 사용하며, 가능하면 본인 계정에서만 사용하세요.

## 기여

커밋은 Conventional Commits 형식을 따릅니다 (`feat:`, `fix:`, `chore:`, `docs:`).

## 크레딧

키 생성과 데이터베이스 방식은 [kakaocli](https://github.com/silver-flight-group/kakaocli) (MIT)를 따릅니다.

## 라이선스

MIT
