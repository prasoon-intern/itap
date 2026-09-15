// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,           // 2 min per test (for slow UI interactions)
  expect: { timeout: 10000 },
  fullyParallel: false,      // Run tests sequentially (they share browser state)
  retries: 0,
  workers: 1,
  // Closes BrowserFactory's opt-in shared browser window (see
  // utils/globalTeardown.js) once the whole run finishes. A no-op for any
  // run that never opts in via launchBrowser's `{ shared: true }` option -
  // only ManagerReferral's specs do today.
  globalTeardown: require.resolve('./utils/globalTeardown'),

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // Set HEADLESS=true in the environment to run without a visible browser window.
    headless: process.env.HEADLESS === 'true',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    // Playwright's own default when this is unset is 0 - i.e. NO timeout at
    // all on individual actions (click/fill/check/etc). Confirmed live this
    // session as the root cause behind a long string of "hangs for exactly
    // the outer test's timeout" bugs across several page objects (a single
    // unbounded click on a momentarily-absent/stale element would wait
    // indefinitely, bounded only by whatever --timeout happened to be
    // passed, rather than failing fast on its own). 30s is comfortably
    // under the 120s per-test timeout below, generous for any legitimately
    // slow action, and makes every action across the whole suite fail fast
    // by default instead of requiring an explicit {timeout} on every call.
    actionTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to run on Firefox or WebKit:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
  ],
});
