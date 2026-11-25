# ♟ Chessup

[한국어](README.md) · **English**

A web game for climbing the ratings in standard chess and mini chess (Los Alamos 6×6).

▶ **Play: not deployed yet** — see "Run" below.

## About

- Sign up with a username and password (no email or other personal data).
- Play live ranked games against people and check your place on the leaderboard.
- Practice against 10 bot levels (your best level beaten is recorded).

## Rules

- Standard chess rules. Mini chess is Los Alamos chess on a 6×6 board (no bishops; no pawn double step, castling or en passant; no promotion to bishop).
- Only live games against people count for rating (Glicko-2), rated separately for standard and mini. The server keeps the clock.
- Guests can play right away without signing up. Members and guests share one queue; only members keep a rating (guests count as 1500).
- Rooms: share a four-digit room number (or link) with a friend and the game starts as soon as they join.
- Rankings: "This week" (from Monday 00:00 KST, points: win 1, draw 0.5, guests included) and "All time" (rating, members). Guests pick a name before their first game and keep this week's results if they sign up.
- In bot games you get 3 hints and 3 take-backs per game. Levels won with help are marked 🤝; win again without help to clear the mark.

## Code map

| Path | What's there |
|---|---|
| `src/engine` | TypeScript chess engine (move generation, rules, notation, search), shared by client and server |
| `src/web` | Client (Vite) |
| `src/worker` | Cloudflare server (Hono · D1 · Durable Objects) |
| `src/shared` | Message types shared by client and server |
| `docs/api.yaml` · `docs/schema.md` | Server contract (OpenAPI) and DB schema; every server implementation follows the same contract |
| `test` · `test-api` | Engine unit tests (perft etc.) · server contract tests (real requests against a running server) |

## Run

```sh
npm install
npx wrangler d1 migrations apply chessup --local
npm run worker:dev          # http://localhost:8787
npm test                    # engine and rating tests
API_BASE=http://localhost:8787 npm run test:api   # server contract tests
```

## Third-party

- Chess piece images (`public/piece`): [Cburnett](https://commons.wikimedia.org/wiki/User:Cburnett) (Wikimedia Commons) — 3-clause BSD License, full text in [`public/piece/LICENSE`](public/piece/LICENSE)
