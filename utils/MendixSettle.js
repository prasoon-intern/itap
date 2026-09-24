// utils/MendixSettle.js
// Deterministic replacement for the fixed `bf.hardWait(4)`/`hardWait(5)`
// sleeps that the Candidate Application Form (Phase 1) flow used between
// field interactions.
//
// WHY those sleeps existed: Mendix's reactive widgets (HQ reference
// selector, HQ Flexible radio, state/district selectors) re-render after
// each interaction, and acting on the next field mid-re-render made the
// next locator's own auto-wait swallow the whole remaining test timeout
// (see utils/CandidateFlowHelpers.js's header comment). The sleeps were
// never decorative - they were a guess at "how long does Mendix need".
//
// WHY they were expensive: measured live 2026-09-18 on the Phase 1 suite -
// fillValidPersonalDetails() alone carried ~52s of hard-coded sleep, and
// 32 of the 51 Phase 1 test cases call it, i.e. roughly half of the whole
// suite's wall-clock time was page.waitForTimeout().
//
// WHAT THIS DOES INSTEAD: waits for the actual signal - the DOM going
// quiet. A MutationObserver records the timestamp of the last DOM change;
// settle() returns once there have been no changes for `quietMs`, and once
// any Mendix progress/loading overlay is gone. Typical real cost is a few
// hundred ms instead of a flat 4-5s.
//
// Deliberate design choices:
//  - `floorMs` keeps a small unconditional delay first. Without it, a
//    re-render that hasn't STARTED yet reads as "already quiet" and we'd
//    outrun the very race the sleeps existed to avoid.
//  - `timeout` is capped at roughly the old sleep length, so the
//    worst case (a page that genuinely never goes quiet - animations,
//    polling widgets) is no slower than the sleep it replaced.
//  - settle() NEVER throws. Settling is an optimisation, not an assertion;
//    if it can't get a clean signal it gets out of the way and lets the
//    next locator's own auto-wait do its job, exactly as before.
//  - Nothing here touches utils/BrowserFactory.js, playwright.config.js or
//    any other module's files - it is purely additive.
//
// `networkidle` is NOT used on purpose: Mendix keeps long-lived
// connections open, so it can hang indefinitely (already documented at
// pages/BasePage.js:44).

// Mendix's own busy/loading indicators. Absent on most interactions, which
// is fine - the quiescence check is what does the real work.
const BUSY_SELECTOR = '.mx-progress, .mx-dialog-progress';

async function installObserver(page) {
  await page.evaluate(() => {
    if (window.__mxSettleInstalled) return;
    window.__mxSettleInstalled = true;
    window.__mxLastMutation = Date.now();
    const observer = new MutationObserver(() => {
      window.__mxLastMutation = Date.now();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  });
}

/**
 * Waits for the Mendix page to stop changing, then returns.
 *
 * @param {object} bf         BrowserFactory instance (uses bf.page).
 * @param {object} [opts]
 * @param {number} [opts.quietMs=250]  Required run of no DOM mutations.
 * @param {number} [opts.floorMs=300]  Unconditional delay first (see above).
 * @param {number} [opts.timeout=4000] Hard cap; never slower than the old sleep.
 * @returns {Promise<number>} Milliseconds actually spent (for measurement).
 */
async function settle(bf, opts = {}) {
  const { quietMs = 250, floorMs = 300, timeout = 4000 } = opts;
  const page = bf.page;
  const startedAt = Date.now();

  try {
    if (floorMs > 0) await page.waitForTimeout(floorMs);
    await installObserver(page);
    await page.waitForFunction(
      ({ quiet, busySel }) => {
        const busy = document.querySelector(busySel);
        // offsetParent === null means it's not actually being displayed.
        if (busy && busy.offsetParent !== null) return false;
        return Date.now() - (window.__mxLastMutation || 0) >= quiet;
      },
      { quiet: quietMs, busySel: BUSY_SELECTOR },
      { timeout, polling: 100 },
    );
  } catch (err) {
    // Page navigated, context torn down, or the DOM never went quiet within
    // the cap. All non-fatal: fall through and let the caller's next
    // locator auto-wait handle it.
  }

  return Date.now() - startedAt;
}

/**
 * Drop-in stand-in for the `hardWait` callback that
 * pages/Candidate/Phase1.js's select_StateDistrict()/selectCurr_StateDistrict()
 * accept. They call it as `hardWait(3)`; this settles instead, using the
 * requested seconds only as the worst-case cap so behaviour degrades to the
 * old timing rather than to something shorter.
 */
function settleAsHardWait(bf) {
  return async (seconds) => {
    await settle(bf, { timeout: Math.max(1000, Number(seconds) * 1000) });
  };
}

module.exports = { settle, settleAsHardWait };
