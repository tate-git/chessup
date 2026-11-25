# DB 구조 (두 서버 공통)

Cloudflare 는 D1(SQLite) — `migrations/*.sql`, Spring Boot 는 PostgreSQL — `server-java/src/main/resources/db/migration` (Flyway).
표·칸 이름과 뜻은 같게 둔다. 시각은 SQLite 에선 ISO-8601 글자(UTC), PostgreSQL 에선 `timestamptz`.

| 표 | 칸 | 뜻 |
|---|---|---|
| users | id(uuid) · username · username_key(소문자, 고유) · password_hash · created_at | 회원 |
| sessions | token_hash(PK, SHA-256) · user_id · created_at · expires_at | 로그인 세션(쿠키엔 원래 토큰, DB엔 해시만) |
| ratings | user_id · variant · rating · deviation · volatility · games · wins · losses · draws · updated_at | 종목별 Glicko-2 |
| games | id · variant · time_control · white_id · black_id · result · reason · moves(UCI 공백 구분) · white_rating · black_rating · white_change · black_change · started_at · ended_at | 끝난 사람 대국 |
| practice_clears | user_id · variant · level · unassisted_level | 봇 격파 최고 단계 · 힌트·뒤로가기 없이 깬 최고 단계 |
| match_results | game_id · player_id(회원 id 또는 guest-…) · name · guest · variant · week_start(한국 월요일) · score(1·0.5·0) · ended_at | 판마다 양쪽 결과(회원·게스트 · 취소된 판 없음) — 이번 주 랭킹 승점 · 게스트가 가입하면 player_id 를 회원으로 바꿈 |
| hint_uses | user_id · day(한국 날짜) · practice_game_id · used_at | 힌트 쓴 기록(한 판 3번 세기 · day 는 통계용) |
| login_failures | key(아이디 또는 IP) · window_start · count | 로그인 실패 제한(15분 창: 아이디 10번 · IP 50번) |

## 비밀번호

`pbkdf2_sha256$<반복>$<salt base64url>$<hash base64url>` — PBKDF2-HMAC-SHA256 · 반복 100,000 · salt 16바이트 · 결과 32바이트.
두 서버가 같은 형식이라 DB 를 옮겨도 그대로 로그인된다(Workers 의 PBKDF2 최대 반복이 100,000).

## 세션

토큰 32바이트(base64url)를 `sid` 쿠키로 주고, DB 에는 SHA-256 해시만 둔다. 30일 · 로그아웃하면 행 삭제.
