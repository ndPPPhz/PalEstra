import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    // tests/e2e is Playwright's; vitest must not pick it up.
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    environment: 'node',
    // Integration tests run against a real Postgres, never the dev database.
    env: { DATABASE_URL: 'postgres://palestra:palestra@127.0.0.1:5432/palestra_test' },
    // Integration tests share one Postgres database, so they must not
    // race each other across worker processes.
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
