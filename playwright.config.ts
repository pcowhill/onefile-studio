import { defineConfig, devices } from '@playwright/test';

/** Preview server port (override with PW_PORT to run several checkouts side by side). */
const PORT = Number(process.env.PW_PORT ?? 4173);
/** The public site (dist-site/: landing page, studio/, showcase/) — needs `npm run build:site`. */
const SITE_PORT = Number(process.env.PW_SITE_PORT ?? PORT + 1);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    trace: 'off',
  },
  projects: [
    { name: 'chromium', testIgnore: 'site/**', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'site',
      testMatch: 'site/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: `http://localhost:${SITE_PORT}/` },
    },
  ],
  webServer: [
    {
      command: `npx vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx vite preview --config vite.site.config.ts --port ${SITE_PORT} --strictPort`,
      url: `http://localhost:${SITE_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
