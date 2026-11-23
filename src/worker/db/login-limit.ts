// 로그인 실패 제한(15분 창): 아이디마다 10번 · IP 마다 50번(회사처럼 IP 하나를 여럿이 쓰는 곳을 위해 넉넉히)
const WINDOW_MS = 15 * 60_000;

export interface FailureKey {
  readonly key: string;
  readonly maxFailures: number;
}

export const userKey = (usernameKey: string): FailureKey => ({ key: `user:${usernameKey}`, maxFailures: 10 });
export const ipKey = (ip: string): FailureKey => ({ key: `ip:${ip}`, maxFailures: 50 });

const windowStart = () => new Date(Date.now() - WINDOW_MS).toISOString();

export async function isLocked(db: D1Database, keys: readonly FailureKey[]): Promise<boolean> {
  const since = windowStart();
  for (const { key, maxFailures } of keys) {
    const count = await db.prepare('SELECT count FROM login_failures WHERE key = ? AND window_start > ?').bind(key, since).first<number>('count');
    if ((count ?? 0) >= maxFailures) return true;
  }
  return false;
}

export async function recordFailure(db: D1Database, keys: readonly FailureKey[]): Promise<void> {
  const now = new Date().toISOString();
  const since = windowStart();
  await db.batch(
    keys.map(({ key }) =>
      db
        .prepare(
          `INSERT INTO login_failures (key, window_start, count) VALUES (?, ?, 1)
           ON CONFLICT (key) DO UPDATE SET
             count = CASE WHEN window_start > ? THEN count + 1 ELSE 1 END,
             window_start = CASE WHEN window_start > ? THEN window_start ELSE excluded.window_start END`,
        )
        .bind(key, now, since, since),
    ),
  );
}

export function clearFailures(db: D1Database, keys: readonly FailureKey[]): Promise<D1Result> {
  return db.prepare(`DELETE FROM login_failures WHERE key IN (${keys.map(() => '?').join(', ')})`).bind(...keys.map(({ key }) => key)).run();
}
