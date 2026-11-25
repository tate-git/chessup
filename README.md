# ♟ 체스업 · Chessup

**한국어** · [English](README.en.md)

정통 체스와 미니 체스(로스앨러모스 6×6)로 레이팅을 올리는 웹 게임.

▶ **플레이: 아직 배포 전** — 아래 「실행」으로 띄워 주세요.

## 소개

- 아이디 + 비밀번호로 가입합니다(이메일 등 개인정보는 받지 않음).
- 사람과 실시간 랭크 대국을 두고, 랭킹에서 순위를 봅니다.
- 봇 10단계와 연습할 수 있습니다(단계별 격파 기록).

## 규칙

- 체스 규칙은 일반 체스와 같습니다. 미니 체스는 6×6 로스앨러모스 체스(비숍 없음 · 폰 두 칸 전진·캐슬링·앙파상 없음 · 비숍으로 승진 없음).
- 레이팅은 사람과 둔 실시간 대국만 반영되고(Glicko-2), 정통·미니 따로 매깁니다. 시계는 서버가 잽니다.
- 가입 없이 게스트로 바로 둘 수 있습니다. 회원과 게스트가 한 줄에서 만나고, 레이팅은 회원만 쌓입니다(게스트는 1500으로 셈).
- 방 만들기: 숫자 네 자리 방 번호(또는 링크)를 친구에게 주면 바로 대국이 시작됩니다.
- 랭킹: 「이번 주」(한국 월요일 0시부터 승점 · 승 1 · 무 0.5, 게스트 포함)와 「전체」(레이팅 · 회원). 게스트는 처음 둘 때 이름을 정하고, 가입하면 이번 주 결과를 이어받습니다.
- 봇 대국에서는 힌트와 무르기를 한 판에 3번씩 쓸 수 있습니다. 쓰고 이긴 단계는 🤝 표시가 붙고, 도움 없이 다시 깨면 사라집니다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/engine` | TypeScript 체스 엔진(수 생성·판정·기보·탐색) — 화면과 서버가 함께 씀 |
| `src/web` | 화면(Vite) |
| `src/worker` | Cloudflare 서버(Hono · D1 · Durable Objects) |
| `src/shared` | 화면·서버가 주고받는 글의 타입 |
| `docs/api.yaml` · `docs/schema.md` | 서버 약속(OpenAPI)과 DB 구조 — 서버 구현이 여럿이어도 같은 약속을 따름 |
| `test` · `test-api` | 엔진 단위 시험(perft 등) · 서버 약속 시험(돌고 있는 서버에 실제 요청) |

## 실행

```sh
npm install
npx wrangler d1 migrations apply chessup --local
npm run worker:dev          # http://localhost:8787
npm test                    # 엔진·레이팅 시험
API_BASE=http://localhost:8787 npm run test:api   # 서버 약속 시험
```

## 빌려 쓴 것

- 체스 말 그림(`public/piece`): [Cburnett](https://commons.wikimedia.org/wiki/User:Cburnett) (Wikimedia Commons) — 3조항 BSD 라이선스, 전문은 [`public/piece/LICENSE`](public/piece/LICENSE)
