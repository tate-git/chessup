// API 오류: 던지면 app.onError 가 { error: { code, message } } 로 바꿈
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '../shared/protocol';

export class ApiError extends Error {
  constructor(readonly status: ContentfulStatusCode, readonly code: ErrorCode, message: string) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, 'unauthorized', '로그인이 필요해요');
export const notFound = (what = '대상') => new ApiError(404, 'not_found', `${what}을(를) 찾을 수 없어요`);
export const invalidInput = (message: string) => new ApiError(400, 'invalid_input', message);
