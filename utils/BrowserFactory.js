// utils/BrowserFactory.js — equivalent to BrowserFactory.java
const { chromium, firefox, webkit } = require('@playwright/test');
const config = require('../config');

// Opt-in, module-level singleton (see launchBrowser's `{ shared: true }`
// option) letting a whole run reuse ONE browser window/context instead of
// each test launching and closing its own. Plain module state rather than a
// class field so it survives across BrowserFactory instances and spec
// files within the same worker process, the same way Node's require()
// caching already works for any other module - correct as long as
// playwright.config.js keeps workers: 1 (already true; see its own comment)
// so every file in a run shares one process. Currently only
// ManagerReferral's Page.spec.js/Report.spec.js opt in - every other
// module's calls omit the option and keep today's fresh-window-per-test
// behavior untouched.
let sharedSession = null;

class BrowserFactory {
  constructor() {
    this.playwright = null;
    this.browser = null;
    this.context = null;
    this.page = null;
    this._usingSharedSession = false;
    // Environment-level signals observed during this session (HTTP 5xx
    // responses / failed requests to the app itself) - see
    // _watchForEnvironmentIssues() and getEnvironmentIssuesSummary().
    this.envIssues = [];
  }

  async _launchBrowserInstance(browserName, headless, slowMo) {
    switch (browserName.toLowerCase()) {
      case 'firefox':
        return firefox.launch({ headless, slowMo });
      case 'webkit':
        return webkit.launch({ headless, slowMo });
      default:
        return chromium.launch({ headless, slowMo });
    }
  }

  // Launch browser and navigate to URL. Pass { shared: true } to reuse one
  // browser window/context across every test in the run (see sharedSession
  // above) instead of opening a new one - each test still gets its own
  // fresh tab/page and, from the second test onward, an explicit
  // cookie/storage clear (see closeBrowser()) so it starts from the same
  // clean slate a brand-new context would have given it.
  async launchBrowser(url = config.url, browserName = config.browser, options = {}) {
    // Set HEADLESS=true in the environment to run without a visible browser
    // window (useful for the "All Scenarios" batch mode, which can chain
    // through dozens of runs and doesn't need to render each one).
    const headless = process.env.HEADLESS === 'true';
    // In headed mode, add a pause before every Playwright action (click,
    // fill, etc.) so someone watching the browser can actually see each
    // field being filled in, instead of it happening too fast to follow.
    // Headless runs skip this entirely, so batch/dashboard-headless mode
    // stays fast. Was 1000ms - confirmed live 2026-08-26 as the single
    // biggest contributor to headed-mode run time (applies to EVERY action
    // across the whole suite, not just Interview - a full "Run All" can
    // involve many hundreds of actions, so this alone was adding 10+
    // minutes). Reduced to 400ms per the user's explicit choice: still
    // clearly visible/followable per action, cuts this overhead by 60%.
    const slowMo = headless ? 0 : 400;

    if (options.shared) {
      this._usingSharedSession = true;
      if (!sharedSession) {
        const browser = await this._launchBrowserInstance(browserName, headless, slowMo);
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        sharedSession = { browser, context };
      }
      this.browser = sharedSession.browser;
      this.context = sharedSession.context;
      this.page = await this.context.newPage();
    } else {
      this.browser = await this._launchBrowserInstance(browserName, headless, slowMo);
      this.context = await this.browser.newContext({ viewport: { width: 1280, height: 720 } });
      this.page = await this.context.newPage();
    }

    this._watchForEnvironmentIssues(url);
    await this.page.goto(url);
    await this.assertAppIsOnline(url);
  }

  // Passively watches this session for the two highest-confidence signals
  // that a later failure is caused by the app/environment itself rather than
  // by whatever the test is actually checking: the app's own server erroring
  // (HTTP 5xx) or a request to the app failing outright at the network level
  // (DNS/connection/reset). Scoped to the app's own host only, so an
  // unrelated third-party resource (ads, fonts, analytics) erroring can't
  // produce a false "environment issue" reading. This only ever collects -
  // it never fails a test by itself; getEnvironmentIssuesSummary() is read
  // by each spec's own test.afterEach only once a test has already failed
  // for its own reason, to explain THAT failure instead of guessing from
  // Playwright's raw error text (which looks identical - a plain locator
  // timeout - whether the page is genuinely broken or the app behind it
  // died). Confirmed live (2026-09-15): this is what TC_02/TC_30-class
  // failures deep in a long batch run turned out to actually be - not a
  // validation gap, but the shared dev Mendix instance erroring/going
  // offline mid-run. assertAppIsOnline() and
  // ManagerReferralPage.throwIfSystemError() remain as fast, precise checks
  // for the two specific shapes of that already confirmed live; this is the
  // general catch-all for whatever shape the next one takes.
  _watchForEnvironmentIssues(url) {
    let host;
    try { host = new URL(url).host; } catch (e) { return; }

    this.page.on('response', (response) => {
      try {
        if (response.status() >= 500 && new URL(response.url()).host === host) {
          this.envIssues.push(`the application's server returned HTTP ${response.status()} for ${response.url()}`);
        }
      } catch (e) { /* malformed/opaque URL - ignore */ }
    });

    this.page.on('requestfailed', (request) => {
      try {
        if (new URL(request.url()).host === host) {
          const failure = request.failure();
          this.envIssues.push(`a request to the application failed (${(failure && failure.errorText) || 'network error'}): ${request.url()}`);
        }
      } catch (e) { /* malformed/opaque URL - ignore */ }
    });
  }

  // Most recent environment-level issue observed this session, or null if
  // none. Read by each spec's test.afterEach only when the test already
  // failed, and attached to the result for server.js/the dashboard to
  // surface in the Reason column instead of (well, alongside) the raw
  // assertion text.
  getEnvironmentIssuesSummary() {
    return this.envIssues.length ? this.envIssues[this.envIssues.length - 1] : null;
  }

  // Confirmed live (2026-09-15): the shared dev Mendix environment went offline
  // mid test-run and rendered Mendix's own generic outage splash ("Offline -
  // This app is not running...") instead of the real app. Every test still tried
  // to interact with its own fields as normal, so this surfaced as a confusing,
  // unrelated "locator.fill: Timeout 30000ms exceeded" deep inside whichever
  // field happened to be filled first - reading as a broken test/page rather
  // than what it actually was: the app being down. Failing fast here with a
  // distinctly-tagged error means the dashboard's Reason column (see
  // automation-dashboard.html's FRIENDLY_REASON_PATTERNS) can tell "the app is
  // down" apart from "this step's own check is broken". The 500ms pause first
  // gives the Mendix client shell a moment to finish deciding online vs
  // offline before this checks - cheap enough to always pay (matches the
  // fixed-wait convention already used elsewhere in this codebase, e.g.
  // ManagerReferralPage.clickOn_Reset's own 500ms).
  async assertAppIsOnline(url) {
    await this.page.waitForTimeout(500);
    const offline = await this.page.getByText('This app is not running', { exact: false }).first().isVisible().catch(() => false);
    if (offline) {
      throw new Error(`[APP_OFFLINE] "${url}" is showing Mendix's own outage page ("This app is not running...") instead of loading normally.`);
    }
  }

  // Read value from config
  getPropertyValue(key) {
    return (config[key] || '').trim();
  }

  // Utilities
  async waitForElementToBeVisible(selector, timeout = 30000) {
    await this.page.waitForSelector(selector, { timeout });
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async doubleClick(selector) {
    await this.page.dblclick(selector);
  }

  async rightClick(selector) {
    await this.page.click(selector, { button: 'right' });
  }

  async mouseHover(selector) {
    await this.page.hover(selector);
  }

  async scrollToElement(selector) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async scrollPageBy(x, y) {
    await this.page.evaluate(`window.scrollBy(${x}, ${y})`);
  }

  async uploadFile(selector, filePath) {
    await this.page.setInputFiles(selector, filePath);
  }

  async takeScreenshot(folderName, fileName) {
    try {
      const path = require('path');
      const fs = require('fs');
      const dir = path.join('screenshot', folderName);
      fs.mkdirSync(dir, { recursive: true });
      await this.page.screenshot({ path: path.join(dir, `${fileName}.png`) });
    } catch (e) {
      console.log('[FAIL] Screenshot failed:', e.message);
    }
  }

  async hardWait(seconds) {
    await this.page.waitForTimeout(seconds * 1000);
  }

  // Cookies are context-wide so clearCookies() handles those; local/session
  // storage is per-origin and only clearable from a page already on that
  // origin, so it's cleared on THIS page (still on its last-visited origin)
  // rather than on whatever comes next. Shared by closeBrowser() (tab is
  // about to close) and resetForNextTest() (tab stays open and just
  // navigates on).
  async _clearPageState() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.evaluate(() => {
          try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* storage may be disabled */ }
        }).catch(() => {});
      }
      if (this.context) await this.context.clearCookies();
    } catch (e) {
      // Best-effort - a still-broken page (e.g. the app crashed mid-test)
      // shouldn't block whatever cleanup can still happen.
    }
  }

  // Resets state for the next test WITHOUT closing the current tab - same
  // clean-slate guarantee closeBrowser() gives a shared session (cookies/
  // storage cleared), plus clearing this session's own environment-issue
  // log so a stale issue from an earlier test in the same group can't get
  // attributed to a later one - then navigates to the given URL and re-runs
  // the online/offline check. Used by a whole group of related tests that
  // share one tab via a beforeAll launch instead of relaunching per test
  // (see e.g. ManagerReferral's Page.spec.js/Report.spec.js describe
  // blocks) - each test still starts from the same clean state a brand-new
  // tab would give, just without the tab-open/close overhead for most of a
  // group's tests.
  //
  // One thing this can't work around: confirmed live (2026-09-15, via
  // node_modules/playwright/lib/runner/dispatcher.js:102) that Playwright's
  // own test runner kills and restarts the whole worker process after ANY
  // failing test, as a deliberate isolation safety feature - not something
  // this project's config can opt out of. Since sharedSession above is
  // process-level state, a worker restart wipes it, so the very next test
  // after a failure gets a genuinely fresh browser/tab regardless of this
  // method. Net effect: one tab per group, plus one extra per failure
  // within that group - still a large cut from one tab per test, just not
  // literally one tab for an entire group that contains a known failure
  // (e.g. TC_02).
  async resetForNextTest(url) {
    await this._clearPageState();
    this.envIssues = [];
    await this.page.goto(url);
    await this.assertAppIsOnline(url);
  }

  // In shared mode, only this test's own tab is closed - the window/browser
  // stays open for the next test (or, when a whole group shares one tab via
  // resetForNextTest(), for the next group's beforeAll).
  async closeBrowser() {
    if (this._usingSharedSession) {
      await this._clearPageState();
      try {
        if (this.page && !this.page.isClosed()) await this.page.close();
      } catch (e) {
        // Page may already be gone if the app crashed mid-test - the shared
        // browser itself is left alone either way for the next group.
      }
      return;
    }
    if (this.browser) await this.browser.close();
  }

  // Closes the shared browser opened via launchBrowser(url, name, { shared:
  // true }), if one was ever opened this run - called once from
  // utils/globalTeardown.js after every test in the run has finished. A
  // no-op for any run that never used shared mode (every module except
  // ManagerReferral today), since sharedSession stays null.
  static async closeSharedSession() {
    if (sharedSession) {
      await sharedSession.browser.close().catch(() => {});
      sharedSession = null;
    }
  }
}

module.exports = BrowserFactory;
