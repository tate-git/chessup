// 서버 호출(같은 주소 · 쿠키 자동) — 오류는 ApiError 로
import type { ErrorBody, ErrorCode, GameRecord, HintAllowance, LeaderboardEntry, Me, PracticeState, Profile, VariantId } from '../shared/protocol';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (response.status === 204) return undefined as T;
  const json = await response.json();
  if (!response.ok) {
    const { error } = json as ErrorBody;
    throw new ApiError(response.status, error.code, error.message);
  }
  return json as T;
}

export interface Credentials {
  readonly username: string;
  readonly password: string;
}

export const api = {
  me: () => call<Me>('GET', '/api/me'),
  signup: (credentials: Credentials) => call<Me>('POST', '/api/auth/signup', credentials),
  login: (credentials: Credentials) => call<Me>('POST', '/api/auth/login', credentials),
  logout: () => call<void>('POST', '/api/auth/logout'),
  leaderboard: (variant: VariantId) => call<{ variant: VariantId; entries: LeaderboardEntry[] }>('GET', `/api/leaderboard?variant=${variant}`),
  profile: (username: string) => call<Profile>('GET', `/api/users/${encodeURIComponent(username)}`),
  game: (id: string) => call<GameRecord>('GET', `/api/games/${encodeURIComponent(id)}`),
  practice: () => call<PracticeState>('GET', '/api/practice'),
  recordClear: (variant: VariantId, level: number, assisted: boolean) => call<PracticeState>('POST', '/api/practice/clears', { variant, level, assisted }),
  useHint: (practiceGameId: string) => call<HintAllowance>('POST', '/api/practice/hints', { practiceGameId }),
};
