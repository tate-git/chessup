// 비밀번호: PBKDF2-HMAC-SHA256 · 100,000번 · salt 16바이트 — 형식은 docs/schema.md(Java 서버와 같음)
import { fromBase64Url, toBase64Url } from './encoding';

const ALGORITHM = 'pbkdf2_sha256';
const ITERATIONS = 100_000;   // Workers 가 허용하는 최대
const SALT_BYTES = 16;
const KEY_BITS = 256;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, salt, ITERATIONS);
  return [ALGORITHM, ITERATIONS, toBase64Url(salt), toBase64Url(key)].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = stored.split('$');
  if (algorithm !== ALGORITHM) return false;
  const actual = await deriveKey(password, fromBase64Url(salt), Number(iterations));
  return timingSafeEqual(actual, fromBase64Url(expected));
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, KEY_BITS);
  return new Uint8Array(bits);
}

/** 길이·내용이 같은지 — 비교 시간이 내용에 따라 달라지지 않게 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}
