// 회원 표
export interface UserRow {
  readonly id: string;
  readonly username: string;
  readonly password_hash: string;
  readonly created_at: string;
}

export const usernameKey = (username: string) => username.toLowerCase();

export function findUserByName(db: D1Database, username: string): Promise<UserRow | null> {
  return db.prepare('SELECT id, username, password_hash, created_at FROM users WHERE username_key = ?').bind(usernameKey(username)).first<UserRow>();
}

export function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT id, username, password_hash, created_at FROM users WHERE id = ?').bind(id).first<UserRow>();
}

/** 만들었으면 행, 같은 아이디가 있으면 null */
export async function createUser(db: D1Database, username: string, passwordHash: string): Promise<UserRow | null> {
  const row: UserRow = { id: crypto.randomUUID(), username, password_hash: passwordHash, created_at: new Date().toISOString() };
  const inserted = await db
    .prepare('INSERT INTO users (id, username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (username_key) DO NOTHING')
    .bind(row.id, username, usernameKey(username), passwordHash, row.created_at)
    .run();
  return inserted.meta.changes === 1 ? row : null;
}
