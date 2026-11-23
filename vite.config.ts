import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'src/web',
  publicDir: '../../public',
  build: { outDir: '../../dist', emptyOutDir: true, target: 'es2023' },
  worker: { format: 'es' },
  test: { root: '.', include: ['test/**/*.test.ts'] },
});
