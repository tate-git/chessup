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
- 가입 없이 게스트로 친선 대국(레이팅·기록 없음)을 둘 수 있고, 회원도 친선으로 게스트와 만날 수 있습니다.
- 힌트는 봇 대국에서만 씁니다: 사람 대국 20판 미만이면 한 판에 1번, 그 뒤로는 하루 1번.

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
