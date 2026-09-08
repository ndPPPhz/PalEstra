import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const DATABASE_URL = 'postgres://palestra:palestra@127.0.0.1:5432/palestra_e2e';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional escape hatch for machines that already ship a Chromium
        // (CI images, containers) instead of Playwright's own download.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    // Dev mode on purpose: outside production the login endpoint hands the
    // OTP back in the response, so the test needs no mailbox.
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { DATABASE_URL, APP_URL: `http://localhost:${PORT}`, RESEND_API_KEY: '' },
  },
});
