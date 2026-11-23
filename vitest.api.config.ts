// 서버 약속 시험: 돌고 있는 서버(API_BASE)에 실제로 요청 — Cloudflare·Spring Boot 둘 다 같은 시험을 통과해야 함
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test-api/**/*.test.ts'], testTimeout: 20_000, fileParallelism: false },
});
