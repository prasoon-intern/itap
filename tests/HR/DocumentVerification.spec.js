const { test, expect } = require('@playwright/test');
const BrowserFactory = require('../../utils/BrowserFactory');
const { ITAP_DocumentVerification } = require('../../pages/HR/DocumentVerification');
const { createClearedOnboardingCandidate } = require('../../utils/createClearedOnboardingCandidate');
const { addResult, saveFile } = require('../../excelReporter');
const config = require('../../config');

// Document Verification (HR portal) validation (see
// pages/HR/DocumentVerification.js). Originally split out of the consolidated
// tests/Onboarding.spec.js (2026-09-02) into its own file, matching the same
// one-file-per-cluster treatment already applied to Interview; moved again
// (2026-09-08) out of the Onboarding module entirely into its own HR module,
// since this is a distinct HR-only portal, not an FC Admin page.
//
// Batch 4 of the FC Admin Onboarding automation build-out (see
// "Onboarding Test Cases.xlsx", "Document Verification" module): the HR
// (nimisha) portal that Gen Appointment Letter/Gen Apprentice Letter both
// gate on. This is a SEPARATE login/role from every other Onboarding spec
// file (akshay.gupta) - its own sidebar, its own page.
//
// Document Verification is a ONE-WAY status transition (Pending ->
// Verified, no "unverify" control found), unlike letter generation which
// can be regenerated indefinitely against a recurring dummy candidate - so
// this file creates its OWN fresh, disposable candidate in beforeAll rather
// than reusing "Demo User Alpha", and every test in this file runs serially
// against that same single candidate, ending in a real (one-time, safe -
// our own throwaway candidate) verification.
test.describe.serial('HR - Document Verification', () => {
  let bf;
  let dv;
  let itapNumber;

  test.beforeAll(async () => {
    // Default hook timeout (120s) isn't enough here - createClearedOnboardingCandidate()
    // does createFreshInterviewCandidate() (~3 min) PLUS a full schedule ->
    // both emails -> feedback form -> final status save on top, heavier than
    // every other candidate-creating beforeAll in this project. Confirmed
    // live (2026-09-02) as a "beforeAll hook timeout of 120000ms exceeded"
    // failure with no test.setTimeout() call present - this gap predates the
    // Onboarding module split, carried over verbatim from the original
    // consolidated tests/Onboarding.spec.js.
    test.setTimeout(600000);
    const created = await createClearedOnboardingCandidate({ middleName: 'DocVerif', lastName: 'Batch' });
    itapNumber = created.itapNumber;

    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    dv = new ITAP_DocumentVerification(bf.page);

    await bf.page.fill("xpath=//*[@placeholder='User name']", config.hrUsername);
    await bf.page.fill("xpath=//*[@placeholder='Password']", config.hrPassword);
    await bf.page.click("xpath=//*[@class='btn btn-success btn-lg']");
    await bf.page.waitForURL((url) => !url.toString().includes('login.html'), { timeout: 15000 }).catch(() => {});
    await bf.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await bf.hardWait(1.5);

    await dv.navigateToDocumentVerification();
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  test('ONB-DV-01 [Positive]: HR account has a dedicated Document Verification sidebar item', async () => {
    expect(await bf.page.title()).toBe('Mendix - Document Verification');
  });

  test('ONB-DV-02 [Positive]: Verification Pending / Verification Completed tabs are both present', async () => {
    const tabLinks = await bf.page.locator("a", { hasText: /Verification (Pending|Completed)/ }).allTextContents();
    expect(tabLinks.map(t => t.trim())).toEqual(expect.arrayContaining(['Verification Pending', 'Verification Completed']));
  });

  test('ONB-DV-15 [Positive]: Verification Pending grid shows the expected 5 columns plus a checkbox column', async () => {
    await dv.switchToTab('Verification Pending');
    const headers = await dv.getColumnHeaders();
    expect(headers).toEqual(['Division', 'ITAP Number', 'Candidate Name', 'Candidate Status', 'Training Date']);
  });

  test('ONB-DV-16 [Positive]: Verification Completed grid has an extra "Document Verification Date" column not on Pending', async () => {
    await dv.switchToTab('Verification Completed');
    const headers = await dv.getColumnHeaders();
    expect(headers).toEqual(['Division', 'ITAP Number', 'Document Verification Date', 'Candidate Name', 'Candidate Status', 'Training Date']);
  });

  test('ONB-DV-17 [Positive]: Division column filter is a free-text partial-match filter, not a dropdown', async () => {
    // Confirmed live: unlike the FC Admin Onboarding grid's own Division
    // filter (a dropdown, see ONB-020), this grid's Division filter is a
    // plain "filter-container" text input - a genuine difference between
    // the two grids, not an inconsistency to fix.
    await dv.switchToTab('Verification Pending');
    const before = await dv.getGridTotalCount();
    expect(before).toBeGreaterThan(0);
    await dv.filterColumnText('Division', 'Mankind');
    const after = await dv.getGridTotalCount();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(before);
    // Confirmed live: dv.gridRows can include a header-echoing phantom row
    // once a filter has just been applied (its innerText is literally the
    // concatenated column labels) - .first() isn't safe here. Filtering by
    // the expected text itself sidesteps that instead of assuming index 0
    // is real data, same principle findRowByItapNumber() already relies on.
    const matchingRows = dv.gridRows.filter({ hasText: 'Mankind' });
    expect(await matchingRows.count()).toBeGreaterThan(0);
    await dv.clearColumnTextFilter('Division');
  });

  test('ONB-DV-18 [Positive]: Candidate Name column filter supports partial matching', async () => {
    await dv.switchToTab('Verification Pending');
    const before = await dv.getGridTotalCount();
    await dv.filterColumnText('Candidate Name', 'Test');
    const after = await dv.getGridTotalCount();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    await dv.clearColumnTextFilter('Candidate Name');
  });

  test('ONB-DV-19 [Positive]: Candidate Status dropdown filter on Verification Pending offers exactly 2 options', async () => {
    await dv.switchToTab('Verification Pending');
    const options = await dv.getDropdownFilterOptions('Candidate Status');
    expect(options).toEqual(['Pending For Verification', 'Sent Back']);
  });

  test('ONB-DV-20 [Positive]: Training Date / Document Verification Date filters are real date-picker widgets on both tabs', async () => {
    await dv.switchToTab('Verification Pending');
    expect(await dv.isDateFilter('Training Date')).toBe(true);
    await dv.switchToTab('Verification Completed');
    expect(await dv.isDateFilter('Training Date')).toBe(true);
    expect(await dv.isDateFilter('Document Verification Date')).toBe(true);
  });

  test('ONB-DV-21 [Positive]: Clearing a text filter (empty + Enter) restores the full unfiltered grid count', async () => {
    await dv.switchToTab('Verification Pending');
    const fullCount = await dv.getGridTotalCount();
    await dv.filterColumnText('Candidate Name', 'zzz-no-such-candidate-zzz');
    expect(await dv.getGridTotalCount()).toBe(0);
    await dv.clearColumnTextFilter('Candidate Name');
    expect(await dv.getGridTotalCount()).toBe(fullCount);
  });

  test('ONB-DV-22 [Edge]: ITAP Number filter narrows the grid to a single exact-match row for our own candidate', async () => {
    await dv.switchToTab('Verification Pending');
    await dv.filterColumnText('ITAP Number', itapNumber);
    expect(await dv.getGridTotalCount()).toBe(1);
    // See ONB-DV-17's own comment - .first() isn't safe against a
    // header-echoing phantom row here, filter by the expected text instead.
    const matchingRows = dv.gridRows.filter({ hasText: itapNumber });
    expect(await matchingRows.count()).toBeGreaterThan(0);
    await dv.clearColumnTextFilter('ITAP Number');
  });

  test('ONB-DV-26 [Positive]: Pagination controls page through results and update boundary button states', async () => {
    // Confirmed live (2026-09-07): dv.gridRows.first() is not reliable
    // right after a page-navigation click either (same header-echoing
    // phantom row already documented for filters, see ONB-DV-17) - uses
    // getRealRowTexts() instead, which filters that out.
    await dv.switchToTab('Verification Pending');
    const totalBefore = await dv.getGridTotalCount();
    expect(totalBefore).toBeGreaterThan(20); // must span at least 2 pages for this test to mean anything

    expect(await dv.firstPageBtn().isEnabled()).toBe(false);
    expect(await dv.prevPageBtn().isEnabled()).toBe(false);
    expect(await dv.nextPageBtn().isEnabled()).toBe(true);
    expect(await dv.lastPageBtn().isEnabled()).toBe(true);

    const rowsBefore = await dv.getRealRowTexts();
    await dv.nextPageBtn().click({ timeout: 5000 });
    await bf.hardWait(1.2);
    const rowsAfter = await dv.getRealRowTexts();

    expect(rowsAfter.length).toBeGreaterThan(0);
    expect(rowsAfter).not.toEqual(rowsBefore);
    expect(await dv.prevPageBtn().isEnabled()).toBe(true);
    expect(await dv.firstPageBtn().isEnabled()).toBe(true);

    // Return to page 1 so later tests (findRowByItapNumber etc.) aren't
    // affected by a leftover page position.
    await dv.firstPageBtn().click({ timeout: 5000 });
    await bf.hardWait(1.2);
  });

  test('ONB-DV-12 [Positive]: "Export All" on the landing grid produces a real bulk candidate list download', async () => {
    // A previously-undocumented button, found live during a 2026-09-02
    // full-flow re-inspection - not in "Onboarding Test Cases.xlsx" at all
    // before now (added as ONB-100). Works directly on the landing grid,
    // no row selection needed - unlike "Download All Docs" below, which
    // only exists inside View Docs (see ONB-DV-13's own comment).
    const [download] = await Promise.all([
      bf.page.waitForEvent('download', { timeout: 10000 }),
      bf.page.locator("button:has-text('Export All')").first().click(),
    ]);
    expect(download.suggestedFilename().length).toBeGreaterThan(0);
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
  });

  test('ONB-DV-03 [Positive]: A freshly-Cleared candidate appears in Verification Pending', async () => {
    await dv.switchToTab('Verification Pending');
    const found = await dv.findRowByItapNumber(itapNumber);
    expect(found.index).not.toBe(-1);
    expect(found.text).toContain('Pending Verification');
  });

  test('ONB-DV-04 [Positive]: View Docs is disabled until a row is selected, then enabled', async () => {
    const before = await dv.isViewDocsEnabled();
    expect(before).toBe(false);

    const found = await dv.findRowByItapNumber(itapNumber);
    await dv.selectRow(found.index);

    const after = await dv.isViewDocsEnabled();
    expect(after).toBe(true);
  });

  test('ONB-DV-05 [Positive]: View Docs opens with all sections starting unverified', async () => {
    await dv.clickViewDocs();
    const counts = await dv.getVerifiedCounts();
    expect(counts.length).toBeGreaterThanOrEqual(3);
    for (const c of counts) {
      const [, verifiedStr] = c.match(/\((\d+)\/(\d+)\)/);
      expect(verifiedStr).toBe('0');
    }
  });

  test('ONB-DV-23 [Negative]: Verify is genuinely blocked server-side when Field Coordinator is left blank, even though it reports enabled', async () => {
    // Closes the gap this project's own xlsx flagged as "Inferred - recommend
    // confirming" (ONB-075) - confirmed live (2026-09-07) via a dedicated
    // throwaway-candidate investigation. isVerifyEnabled() reports true with
    // Field Coordinator still blank (same "enabled state lies" pattern
    // already documented for Send Back's button), and the confirmation
    // dialog itself ("Please ensure all documents are verified. Are you
    // sure you want to proceed?") appears unconditionally too - neither is
    // a real gate. The real gate is server-side: a blank Field Coordinator
    // is rejected with "Field Coordinator is manadatory" [sic, same typo as
    // Send Back's own message] and an empty commits array.
    //
    // Deliberately runs right here, immediately after ONB-DV-05 first opens
    // View Docs, BEFORE any other test ever selects a Field Coordinator.
    // Confirmed live (2026-09-07): simply SELECTING Field Coordinator in
    // its combobox persists across later View Docs re-opens for the same
    // candidate even when nothing was ever successfully committed - a
    // genuinely blank Field Coordinator can only be tested here, first.
    await dv.checkAllDocumentCheckboxes();
    expect(await dv.getFieldCoordinatorValue()).toBe('');
    expect(await dv.isVerifyEnabled()).toBe(true);

    const result = await dv.clickVerifyAndGetResult();
    test.info().annotations.push({ type: 'result', description: `Blank-Field-Coordinator Verify result: ${JSON.stringify(result)}` });
    expect(result.hasValidationErrors).toBe(true);
    expect(result.validationMessages.join(' ')).toMatch(/field coordinator/i);
    expect(result.committedAnything).toBe(false);

    // Confirm it genuinely didn't move - still Pending, not silently Completed.
    await dv.clickBack().catch(() => {});
    await dv.switchToTab('Verification Pending');
    const stillPending = await dv.findRowByItapNumber(itapNumber);
    expect(stillPending.index).not.toBe(-1);
    expect(stillPending.text).toContain('Pending Verification');

    // Reset to a clean, fully-unchecked state via Cancel (see ONB-DV-25
    // below) so ONB-DV-06's own "check only the first document" assertion
    // starts from zero, not from this test's own all-checked leftover state.
    await dv.selectRow(stillPending.index);
    await dv.clickViewDocs();
    await dv.clickCancelAndConfirm();
    await dv.switchToTab('Verification Pending');
    const reFound = await dv.findRowByItapNumber(itapNumber);
    expect(reFound.index).not.toBe(-1);
    await dv.selectRow(reFound.index);
    await dv.clickViewDocs();
  });

  test('ONB-DV-13 [Positive]: "Download All Docs" inside View Docs produces a real bulk document download', async () => {
    // Corrects xlsx ONB-079's original (untested, "never clicked") guess
    // that this button lives on the landing grid "independent of View
    // Docs" - live inspection 2026-09-02 found it does NOT: the landing
    // grid only has View Docs/Export All/a status toggle. "Download All
    // Docs" only exists INSIDE the View Docs detail page (alongside
    // "Back") - this test runs here, right after ONB-DV-05 opens that
    // page, since the action is read-only and independent of whatever
    // checkbox/Field-Coordinator state the later tests build up.
    const btn = bf.page.locator("button:has-text('Download All Docs')").first();
    expect(await btn.isEnabled()).toBe(true);
    const [download] = await Promise.all([
      bf.page.waitForEvent('download', { timeout: 10000 }),
      btn.click(),
    ]);
    expect(download.suggestedFilename().length).toBeGreaterThan(0);
  });

  test('ONB-DV-06 [Edge]: Per-section counters update independently as checkboxes are checked', async () => {
    const totalDocs = await dv.getDocumentCheckboxCount();
    const debugInfo = await dv.getDocumentCheckboxDebugInfo();
    test.info().annotations.push({ type: 'debug', description: `Checkbox count=${totalDocs}, nearby text per index: ${JSON.stringify(debugInfo)}` });
    expect(totalDocs).toBeGreaterThan(0);

    // Check only the FIRST document's checkbox and confirm exactly one
    // section's counter incremented while the others stayed at 0.
    const firstCheckbox = dv.docCheckboxes.first();
    await firstCheckbox.check({ force: true });
    await bf.hardWait(1);

    const isFirstNowChecked = await firstCheckbox.isChecked().catch(() => false);
    const counts = await dv.getVerifiedCounts();
    const verifiedTotals = counts.map(c => parseInt(c.match(/\((\d+)\//)[1], 10));
    const sumVerified = verifiedTotals.reduce((a, b) => a + b, 0);
    test.info().annotations.push({ type: 'result', description: `firstCheckbox.isChecked()=${isFirstNowChecked}, counts=${JSON.stringify(counts)}` });
    expect(sumVerified).toBe(1);
  });

  test('ONB-DV-25 [Edge]: Cancel discards unsaved checkbox progress, unlike Save As Draft', async () => {
    // Confirmed live (2026-09-07) via a dedicated throwaway-candidate
    // investigation: Cancel shows its OWN "Are you sure you want to
    // cancel?" (Yes/No) confirmation, distinct from Verify/Save As Draft's
    // "Information" dialogs - confirming it discards ALL unsaved
    // per-document progress (including ONB-DV-06's already-checked first
    // document, not just whatever this test itself checks), returning to
    // the grid. Deliberately runs right after ONB-DV-06 and before
    // ONB-DV-07's own Save As Draft, so the same kind of partial state is
    // shown to behave oppositely depending on which button ends it.
    await dv.docCheckboxes.nth(1).check({ force: true });
    await bf.hardWait(0.5);
    const countsBeforeCancel = await dv.getVerifiedCounts();
    const checkedBefore = countsBeforeCancel.reduce((sum, c) => sum + parseInt(c.match(/\((\d+)\//)[1], 10), 0);
    expect(checkedBefore).toBeGreaterThan(0);

    const cancelDialogShown = await dv.clickCancelAndConfirm();
    expect(cancelDialogShown).toBe(true);

    // Confirmed live (2026-09-07, headed-mode run): confirming "Yes" does
    // NOT always navigate back to the grid immediately - it can take a
    // moment longer, or in one observed case left the browser sitting on a
    // freshly-reset (all-unchecked, blank Field Coordinator) View Docs page
    // instead. Poll for the grid's own tab links, falling back to an
    // explicit clickBack() if Cancel's own navigation didn't take -  same
    // "don't assume a specific starting point" discipline as ONB-DV-08's
    // own comment, and the same class of real-app inconsistency already
    // documented for Designation-cascade/Vacant-Position-reselect elsewhere
    // in this project.
    let tabLinksVisible = 0;
    for (let attempt = 0; attempt < 4 && tabLinksVisible === 0; attempt++) {
      if (attempt > 0) await bf.hardWait(1);
      tabLinksVisible = await bf.page.locator("a", { hasText: /Verification (Pending|Completed)/ }).count();
    }
    if (tabLinksVisible === 0) {
      await dv.clickBack().catch(() => {});
      tabLinksVisible = await bf.page.locator("a", { hasText: /Verification (Pending|Completed)/ }).count();
    }
    expect(tabLinksVisible).toBeGreaterThan(0);

    await dv.switchToTab('Verification Pending');
    const found = await dv.findRowByItapNumber(itapNumber);
    expect(found.index).not.toBe(-1);
    await dv.selectRow(found.index);
    await dv.clickViewDocs();
    const countsAfter = await dv.getVerifiedCounts();
    const checkedAfter = countsAfter.reduce((sum, c) => sum + parseInt(c.match(/\((\d+)\//)[1], 10), 0);
    expect(checkedAfter).toBe(0);
  });

  test('ONB-DV-07 [Edge]: "Save As Draft" preserves partial progress without moving off Verification Pending', async () => {
    // Un-blocked 2026-09-04 with a dedicated, isolated live investigation
    // (its own disposable candidate, per the original blocking note's own
    // recommendation). Root cause of the original 600s hang: clicking Save
    // As Draft shows an "Information: Candidate verification status saved"
    // dialog with an OK button - same pattern as Verify's own success
    // dialog - that was never dismissed, leaving its modal overlay blocking
    // every subsequent click for the rest of the test timeout. Also
    // confirmed live: unlike Verify, this does NOT require a Field
    // Coordinator to be selected first.
    //
    // ONB-DV-06 already checked the first document's checkbox - check one
    // more (still leaving the rest unchecked) for a genuine partial state.
    // Confirmed live (2026-09-04): this candidate's document set isn't
    // fixed (varies by dependent/family records), so index 1 isn't always
    // where a previous investigation found it - verify the check actually
    // took rather than assuming a single .check() call landed.
    const second = dv.docCheckboxes.nth(1);
    for (let attempt = 0; attempt < 3 && !(await second.isChecked().catch(() => false)); attempt++) {
      await second.check({ force: true });
      await bf.hardWait(0.5);
    }
    expect(await second.isChecked().catch(() => false)).toBe(true);
    const countsBefore = await dv.getVerifiedCounts();

    // Save As Draft can take a moment to enable after a checkbox change -
    // poll rather than assuming it's immediately ready.
    let draftEnabled = false;
    for (let attempt = 0; attempt < 6 && !draftEnabled; attempt++) {
      draftEnabled = await dv.saveAsDraftBtn.isEnabled().catch(() => false);
      if (!draftEnabled) await bf.hardWait(0.5);
    }
    expect(draftEnabled).toBe(true);

    // Confirmed live: the dialog is "Information: Candidate verification
    // status saved" - matched generically here (any dialog, like
    // clickVerifyAndConfirm() does) rather than filtered by text, which
    // proved less reliable against this dialog's exact render timing.
    await dv.saveAsDraftBtn.click({ timeout: 10000 });
    await bf.hardWait(2);
    const dialogVisible = await dv.confirmDialog.first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(dialogVisible).toBe(true);
    const okBtn = dv.confirmDialog.first().locator("button:has-text('OK'), button:has-text('Ok')");
    await okBtn.first().click({ timeout: 5000 }).catch(() => {});
    await bf.hardWait(1);

    // Confirm it's still in Verification Pending, not Completed.
    await dv.clickBack().catch(() => {});
    await dv.switchToTab('Verification Completed');
    const notCompleted = await dv.findRowByItapNumber(itapNumber);
    expect(notCompleted.index).toBe(-1);

    await dv.switchToTab('Verification Pending');
    const stillPending = await dv.findRowByItapNumber(itapNumber);
    expect(stillPending.index).not.toBe(-1);

    // Reopen and confirm the partial progress genuinely persisted, not just
    // held in the page's own in-memory state.
    await dv.selectRow(stillPending.index);
    await dv.clickViewDocs();
    await bf.hardWait(1.5);
    const countsAfter = await dv.getVerifiedCounts();
    expect(countsAfter).toEqual(countsBefore);
  });

  test('ONB-DV-24 [Negative]: Verify silently does nothing when only some documents are checked, even with Field Coordinator selected', async () => {
    // Confirmed live (2026-09-07) via a dedicated throwaway-candidate
    // investigation: unlike a blank Field Coordinator (actively rejected
    // server-side with a real validation message - see ONB-DV-23 above),
    // submitting Verify with only SOME document checkboxes checked returns
    // HTTP 200 with an EMPTY validation array AND an empty commits array -
    // a silent no-op with zero visible feedback (no error dialog, no
    // success dialog), the same undetectable-without-network-inspection
    // trap as Send Back's own original investigation (see
    // feedback_dont_trust_http_status_alone). ONB-DV-07 just left this
    // candidate with exactly one document checked (via Save As Draft) - a
    // genuine partial state, not artificially constructed here.
    const countsBefore = await dv.getVerifiedCounts();
    const checkedBefore = countsBefore.reduce((sum, c) => sum + parseInt(c.match(/\((\d+)\//)[1], 10), 0);
    const totalDocs = countsBefore.reduce((sum, c) => sum + parseInt(c.match(/\/(\d+)\)/)[1], 10), 0);
    expect(checkedBefore).toBeGreaterThan(0);
    expect(checkedBefore).toBeLessThan(totalDocs);

    await dv.selectFieldCoordinator(config.fieldCoordinatorName);
    const result = await dv.clickVerifyAndGetResult();
    test.info().annotations.push({ type: 'result', description: `Partial-docs Verify result: ${JSON.stringify(result)}` });
    expect(result.hasValidationErrors).toBe(false);
    expect(result.committedAnything).toBe(false);

    // Confirm it genuinely didn't move - still Pending, not silently Completed.
    await dv.clickBack().catch(() => {});
    await dv.switchToTab('Verification Pending');
    const stillPending = await dv.findRowByItapNumber(itapNumber);
    expect(stillPending.index).not.toBe(-1);

    // Re-enter View Docs for ONB-DV-14, which follows.
    await dv.selectRow(stillPending.index);
    await dv.clickViewDocs();
  });

  test('ONB-DV-14 [Edge]: "Send Back To Candidate" - preconditions confirmed correct, but deliberately NOT completed to a real send (no recipient override exists)', async () => {
    // REVERTED 2026-09-07 from a full real-send completion (added
    // 2026-09-04) after the user reported real emails reaching
    // discovery.candidate18@gmail.com against standing project policy -
    // ALL automated emails must go only to config.EmailId, see
    // feedback_interview_email_destination. Live DOM investigation
    // (2026-09-07) confirmed why this one can't just be fixed the way the
    // Interview "Preview Candidate/Interviewer Email" flows were (see
    // ITAP_PreviewCandidateEmail.updateCandidateToEmail(), added the same
    // day for exactly that gap): unlike those tabs, which have real,
    // editable To/CC input fields this suite can override, View Docs'
    // "Send Back To Candidate" exposes NO recipient field anywhere in its
    // DOM at all - a full input/textarea dump of the page found only the
    // per-document Remarks inputs, Verify checkboxes, Field Coordinator
    // combo, and Comments/long-string test leftovers; the candidate's own
    // registered email appeared only as read-only page text, never an
    // editable field. There is no UI mechanism to redirect where this
    // action's email goes. Since config.PersonalEmailId (the fixed,
    // reused signup email every test candidate in this project gets) is
    // not config.EmailId, actually completing this action for real - as
    // the 2026-09-04 change started doing - meant a real, unredirectable
    // email went out every single time this test ran.
    //
    // This restores this project's own ORIGINAL, more cautious stated
    // intent for this specific action (see "Onboarding Test Cases.xlsx"
    // ONB-077's original note: "never executed... per
    // feedback_no_real_candidate_impact and standing email-safety
    // policy... plausibly notifies/emails the candidate directly") - the
    // 2026-09-04 unblocking work correctly proved the VALIDATION logic
    // (still verified for real, live, in ONB-DV-28/ONB-DV-29 above - blank
    // remarks+FC and remarks-only are both genuinely rejected server-side),
    // but should never have gone on to complete a real send with no way to
    // control its destination.
    //
    // What's still verified here, live: Remarks and Field Coordinator are
    // filled in exactly as ONB-DV-28/29 proved is required, confirming the
    // form reaches a genuinely "ready to send" state - this deliberately
    // stops short of the actual click that would fire the real,
    // unredirectable email. The candidate stays in Verification Pending,
    // unaffected, for ONB-DV-08 onward to continue using normally.
    const remarksFilled = await dv.fillAllDocumentRemarks('Please resubmit - document unclear (automated test)');
    expect(remarksFilled).toBeGreaterThan(0);
    const selected = await dv.selectFieldCoordinator(config.fieldCoordinatorName);
    expect(selected).toBe(true);
    expect(await dv.isFieldCoordinatorShowing(config.fieldCoordinatorName)).toBe(true);
  });

  test('ONB-DV-08 [Positive]: Field Coordinator selects "Akshay Gupta" (standing project convention)', async () => {
    // Navigates back explicitly rather than assuming a specific starting
    // point, since ONB-DV-07/ONB-DV-14 both leave the browser on the View
    // Docs page for their own reasons, not the grid.
    await dv.clickBack().catch(() => {});
    await dv.switchToTab('Verification Pending');
    const found = await dv.findRowByItapNumber(itapNumber);
    expect(found.index).not.toBe(-1);
    await dv.selectRow(found.index);
    await dv.clickViewDocs();

    // ONB-DV-23 already checked every document (to reach its own negative
    // check) - re-confirming here is a harmless no-op if so.
    await dv.checkAllDocumentCheckboxes();

    const selected = await dv.selectFieldCoordinator(config.fieldCoordinatorName);
    expect(selected).toBe(true);
    expect(await dv.isFieldCoordinatorShowing(config.fieldCoordinatorName)).toBe(true);
  });

  test('ONB-DV-09 [Edge]: Comments is optional - Verify works with it left blank', async () => {
    // Deliberately does NOT fill Comments, to actually exercise the
    // "Comments has no required-field asterisk" inference live instead of
    // just assuming it.
    const counts = await dv.getVerifiedCounts();
    for (const c of counts) {
      const [, verifiedStr, totalStr] = c.match(/\((\d+)\/(\d+)\)/);
      expect(verifiedStr).toBe(totalStr);
    }
    expect(await dv.isVerifyEnabled()).toBe(true);
  });

  test('ONB-DV-10 [Positive]: Verify shows a confirmation dialog and completes verification', async () => {
    const dialogText = await dv.clickVerifyAndConfirm();
    expect(dialogText).toMatch(/are you sure you want to proceed/i);
  });

  test('ONB-DV-11 [Positive]: Candidate moves to Verification Completed with status "Verified"', async () => {
    await dv.clickBack().catch(() => {});
    await dv.switchToTab('Verification Pending');
    const stillPending = await dv.findRowByItapNumber(itapNumber);
    expect(stillPending.index).toBe(-1);

    // Confirmed live (2026-09-04): the old brute-force page-scan
    // (findRowByItapNumber) stopped being reliable once Verification
    // Completed grew past ~85 rows from this project's own accumulated test
    // runs - see findRowByItapNumberFiltered()'s own comment for why. Uses
    // the grid's own ITAP Number filter instead, which stays fast and
    // reliable regardless of how large this list grows. Also confirmed
    // live: this specific check failed 5 times running as part of the full
    // file, immediately after Verify, yet succeeded every time in an
    // isolated standalone repro of the exact same click sequence - the
    // difference was never fully isolated (not a sort-order or scale issue;
    // the filtered lookup ruled that out too). Retries a few times with a
    // short wait as pragmatic insurance against whatever that is, on top of
    // the more reliable filtered lookup.
    await dv.switchToTab('Verification Completed');
    let nowCompleted = { index: -1, text: null };
    for (let attempt = 0; attempt < 4 && nowCompleted.index === -1; attempt++) {
      if (attempt > 0) await bf.hardWait(3);
      nowCompleted = await dv.findRowByItapNumberFiltered(itapNumber);
    }
    expect(nowCompleted.index).not.toBe(-1);
    expect(nowCompleted.text).toContain('Verified');
  });
});

// Robustness/security/edge-case coverage (2026-09-07 QA audit pass), split
// into its OWN describe.serial block rather than woven into the main
// 25-test chain above: several of these are deliberately exploratory or
// destructive in ways the core regression chain isn't (a simulated backend
// failure, a cleared-cookie session, a mid-flow page reload) - keeping them
// isolated means a failure here can't cascade into skipping the core
// Verify/Send Back/Save As Draft regression tests above, the exact class of
// risk a prior attempt this same session hit firsthand when a new test was
// woven into the main chain and its failure cascaded via describe.serial's
// default "skip everything after a failure" behavior (see
// project_onboarding_module_automation memory). Uses its own fresh,
// disposable candidate - never reaches Verify/Completed, which isn't
// needed for anything checked here.
test.describe.serial('HR - Document Verification - Robustness & Security', () => {
  let bf2;
  let dv2;
  let itapNumber2;

  test.beforeAll(async () => {
    test.setTimeout(600000);
    const created = await createClearedOnboardingCandidate({ middleName: 'Robustness', lastName: 'Batch' });
    itapNumber2 = created.itapNumber;

    bf2 = new BrowserFactory();
    await bf2.launchBrowser(config.FC_URL);
    dv2 = new ITAP_DocumentVerification(bf2.page);

    await bf2.page.fill("xpath=//*[@placeholder='User name']", config.hrUsername);
    await bf2.page.fill("xpath=//*[@placeholder='Password']", config.hrPassword);
    await bf2.page.click("xpath=//*[@class='btn btn-success btn-lg']");
    await bf2.page.waitForURL((url) => !url.toString().includes('login.html'), { timeout: 15000 }).catch(() => {});
    await bf2.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await bf2.hardWait(1.5);

    await dv2.navigateToDocumentVerification();
    await dv2.switchToTab('Verification Pending');
    const found = await dv2.findRowByItapNumber(itapNumber2);
    await dv2.selectRow(found.index);
    await dv2.clickViewDocs();
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf2?.closeBrowser();
  });

  test('ONB-DV-27 [Edge]: Save As Draft succeeds even with zero changes made - no validation gate exists', async () => {
    // Confirmed live (2026-09-07): unlike Verify/Send Back (both genuinely
    // gated), Save As Draft has NO validation at all - it always succeeds,
    // even against a completely untouched candidate.
    expect(await dv2.saveAsDraftBtn.isEnabled()).toBe(true);
    await dv2.saveAsDraftBtn.click({ timeout: 8000 });
    await bf2.hardWait(1.5);
    const dialogVisible = await dv2.confirmDialog.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(dialogVisible).toBe(true);
    const dialogText = await dv2.confirmDialog.first().innerText().catch(() => '');
    expect(dialogText).toMatch(/verification status saved/i);
    const okBtn = dv2.confirmDialog.first().locator("button:has-text('OK'), button:has-text('Ok')");
    await okBtn.first().click({ timeout: 5000 }).catch(() => {});
    await bf2.hardWait(1);
  });

  test('ONB-DV-28 [Negative]: Send Back with nothing filled returns every missing-field validation at once, without committing', async () => {
    // Confirmed live (2026-09-07): a single attempt with BOTH Remarks and
    // Field Coordinator blank returns ALL missing-field errors together in
    // one response - one "Remarks is mandatory" per document PLUS one
    // "Field Coordinator is manadatory" [sic] - not staged/sequential
    // discovery, correcting the "first Remarks, then separately Field
    // Coordinator" framing in this file's own earlier comment history
    // (which described two SEPARATE manual attempts, not one).
    const result = await dv2.clickSendBackAndGetResult();
    test.info().annotations.push({ type: 'result', description: `Send Back (nothing filled) result: ${JSON.stringify(result)}` });
    expect(result.hasValidationErrors).toBe(true);
    expect(result.committedAnything).toBe(false);
    const joined = result.validationMessages.join(' ');
    expect(joined).toMatch(/remarks is mandatory/i);
    expect(joined).toMatch(/field coordinator/i);
  });

  test('ONB-DV-29 [Negative]: Send Back with Remarks filled but Field Coordinator still blank is blocked on that alone', async () => {
    const remarksFilled = await dv2.fillAllDocumentRemarks('robustness-test-remarks');
    expect(remarksFilled).toBeGreaterThan(0);

    const result = await dv2.clickSendBackAndGetResult();
    test.info().annotations.push({ type: 'result', description: `Send Back (remarks only) result: ${JSON.stringify(result)}` });
    expect(result.hasValidationErrors).toBe(true);
    expect(result.committedAnything).toBe(false);
    const joined = result.validationMessages.join(' ');
    expect(joined).toMatch(/field coordinator/i);
    expect(joined).not.toMatch(/remarks is mandatory/i);
  });

  test('ONB-DV-30 [Edge]: Rapid double-click on Save As Draft does not produce a duplicate backend commit', async () => {
    await dv2.docCheckboxes.first().check({ force: true }).catch(() => {});
    await bf2.hardWait(0.5);
    let xasCallCount = 0;
    const onResponse = (res) => { if (res.url().includes('/xas/')) xasCallCount += 1; };
    bf2.page.on('response', onResponse);
    await Promise.all([
      dv2.saveAsDraftBtn.click({ timeout: 8000 }).catch(() => {}),
      dv2.saveAsDraftBtn.click({ timeout: 8000 }).catch(() => {}),
    ]);
    await bf2.hardWait(2.5);
    bf2.page.off('response', onResponse);
    test.info().annotations.push({ type: 'result', description: `/xas/ calls fired during double-click: ${xasCallCount}` });
    expect(xasCallCount).toBeLessThanOrEqual(1);

    for (let i = 0; i < 3; i++) {
      const visible = await dv2.confirmDialog.first().isVisible({ timeout: 2000 }).catch(() => false);
      if (!visible) break;
      await dv2.confirmDialog.first().locator("button:has-text('OK'), button:has-text('Ok')").first().click({ timeout: 5000 }).catch(() => {});
      await bf2.hardWait(1);
    }
  });

  test('ONB-DV-31 [Edge]: Comments enforces a 200-character limit', async () => {
    // Previously undocumented anywhere - confirmed live (2026-09-07)
    // filling 5000 characters resulted in exactly 200 stored.
    await dv2.fillComments('A'.repeat(5000));
    const actual = await dv2.commentsBox.inputValue();
    expect(actual.length).toBe(200);
  });

  test('ONB-DV-32 [Positive]: An XSS-style payload in Comments is stored and rendered as inert literal text, never executed', async () => {
    // Security check: confirms this free-text field isn't reflected as raw
    // HTML anywhere it's later shown, including after a genuine save +
    // reopen round-trip. Confirmed live (2026-09-07): stored verbatim as
    // literal text, script/onerror handlers never fired.
    const marker = `xsscheck_${Date.now() % 100000}`;
    const payload = `<script>window.__xssFired=true;</script><img src=x onerror="window.__xssFired=true">${marker}`;
    await dv2.fillComments(payload.slice(0, 200)); // Comments truncates at 200 (ONB-DV-31) - keep the marker inside that limit.
    await dv2.saveAsDraftBtn.click({ timeout: 8000 });
    await bf2.hardWait(1.5);
    const dialogVisible = await dv2.confirmDialog.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (dialogVisible) {
      await dv2.confirmDialog.first().locator("button:has-text('OK'), button:has-text('Ok')").first().click({ timeout: 5000 }).catch(() => {});
      await bf2.hardWait(1);
    }

    await dv2.clickBack().catch(() => {});
    await dv2.switchToTab('Verification Pending');
    const found = await dv2.findRowByItapNumber(itapNumber2);
    expect(found.index).not.toBe(-1);
    await dv2.selectRow(found.index);
    await dv2.clickViewDocs();

    const commentsAfterReopen = await dv2.commentsBox.inputValue().catch(() => '');
    expect(commentsAfterReopen).toContain(marker);
    const xssFired = await bf2.page.evaluate(() => window.__xssFired === true).catch(() => true);
    expect(xssFired).toBe(false);
  });

  test('ONB-DV-33 [Negative]: A simulated backend failure on Save As Draft shows a real error dialog instead of hanging silently', async () => {
    let routeHit = false;
    await bf2.page.route('**/xas/**', async (route) => {
      routeHit = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'simulated failure (test-injected)' }) });
    });
    await dv2.saveAsDraftBtn.click({ timeout: 8000 }).catch(() => {});
    await bf2.hardWait(2.5);
    await bf2.page.unroute('**/xas/**').catch(() => {});

    expect(routeHit).toBe(true);
    const dialogVisible = await bf2.page.locator("[role='dialog']").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(dialogVisible).toBe(true);
    const dialogText = await bf2.page.locator("[role='dialog']").first().innerText().catch(() => '');
    expect(dialogText).toMatch(/error/i);
    const okBtn = bf2.page.locator("[role='dialog'] button:has-text('OK'), [role='dialog'] button:has-text('Ok')");
    await okBtn.first().click({ timeout: 5000 }).catch(() => {});
    await bf2.hardWait(1);

    // Page must still be usable afterward, not stuck behind the error.
    expect(await bf2.page.title()).toBe('Mendix - Document Verification');
  });

  test('ONB-DV-34 [Edge]: A browser refresh mid-flow returns to a working, logged-in view without crashing', async () => {
    await dv2.docCheckboxes.first().check({ force: true }).catch(() => {});
    await bf2.hardWait(0.5);
    await bf2.page.reload({ timeout: 15000 }).catch(() => {});
    await bf2.hardWait(2);

    expect(await bf2.page.title()).toBe('Mendix - Document Verification');
    const loginFieldsVisible = await bf2.page.locator("xpath=//*[@placeholder='User name']").count();
    expect(loginFieldsVisible).toBe(0);
    const tabLinksVisible = await bf2.page.locator("a", { hasText: /Verification (Pending|Completed)/ }).count();
    expect(tabLinksVisible).toBeGreaterThan(0);
  });

  test('ONB-DV-35 [Edge]: An invalidated session redirects to Login on the next action, rather than failing silently', async () => {
    // Deliberately the LAST test in this block - clearing cookies ends this
    // candidate's usable session for anything after it.
    await dv2.switchToTab('Verification Pending');
    const found = await dv2.findRowByItapNumber(itapNumber2);
    expect(found.index).not.toBe(-1);
    await dv2.selectRow(found.index);
    await dv2.clickViewDocs();

    await bf2.page.context().clearCookies();
    await bf2.hardWait(0.5);
    await dv2.saveAsDraftBtn.click({ timeout: 8000 }).catch(() => {});
    await bf2.hardWait(2.5);

    expect(await bf2.page.title()).toBe('Login');
    const loginFieldsVisible = await bf2.page.locator("xpath=//*[@placeholder='User name']").count();
    expect(loginFieldsVisible).toBeGreaterThan(0);
  });
});
