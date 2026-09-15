const { test, expect } = require('@playwright/test');
const BrowserFactory = require('../../utils/BrowserFactory');
const ITAP_Login = require('../../pages/FCAdminLogin');
const { ITAP_OnboardingGrid } = require('../../pages/Onboarding');
const { addResult, saveFile } = require('../../excelReporter');
const config = require('../../config');

// Gen Apprentice Letter validation. Split out of the consolidated
// tests/Onboarding.spec.js (2026-09-02) into its own file, matching the
// same one-file-per-cluster treatment already applied to Interview.
//
// This file only imports ITAP_OnboardingGrid (from the base
// pages/Onboarding.js) - both real tests below are negative gates that block
// before the actual Generate Apprentice Letter page ever opens, so neither
// needs field-level access yet. pages/Onboarding/GenApprenticeLetter.js
// already exists (a re-export of ITAP_GenerateOfferLetter, created ahead of
// need) and is ready to import from once ONB-PL-03's positive path is
// unblocked and needs real field access on that page.
//
// Batch 6 of the FC Admin Onboarding automation build-out (see
// "Onboarding Test Cases.xlsx", "Gen Apprentice Letter" module).
//
// Gen Apprentice Letter has TWO independent, real validation gates
// (confirmed live this project, both are genuine business rules, not
// bugs):
//   1. Blocked for "experienced" candidates - tested here against ITAP
//      250347 (experienced, Verified documents).
//   2. Blocked for any candidate whose Division isn't exactly "MCPPL" -
//      tested here against ITAP 250349 (fresher/non-experienced, Verified
//      documents, Division = Mankind).
//
// The POSITIVE path (a fresher, Verified, MCPPL-division candidate,
// generating and sending a real Apprentice Letter) is NOT automated in
// this file - it requires an MCPPL-division ManagerRefID to create the
// right candidate with, which is not yet known (none of the 6 previously-
// supplied division/ManagerRefID pairs - Mankind, Discovery, Nobelis,
// Curis, Agri, Alpha - is MCPPL). Documented as skipped with a clear
// reason rather than silently omitted, same pattern as
// InterviewLoginValidation.spec.js's idle-timeout skip.
const EXPERIENCED_VERIFIED_ITAP = '250347';
const FRESHER_VERIFIED_NON_MCPPL_ITAP = '250349';

test.describe.serial('FC Admin - Onboarding: Gen Apprentice Letter', () => {
  let bf;
  let loginPage;
  let grid;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    loginPage = new ITAP_Login(bf.page);
    grid = new ITAP_OnboardingGrid(bf.page);

    await loginPage.performLogin(config.username, config.password);
    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();
    await grid.clickOnboardingTab();
    await grid.waitForGridDataLoaded();
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  test('ONB-PL-01 [Negative]: Blocked for an experienced candidate, even with Verified documents', async () => {
    await grid.filterByRegId(EXPERIENCED_VERIFIED_ITAP);
    await grid.waitForGridDataLoaded();
    await grid.checkFirstRowCheckbox();

    const result = await grid.clickGenApprenticeLetterAndWaitForPage();
    expect(result.opened).toBe(false);
    expect(result.dialogText).toMatch(/experienced candidates/i);

    // Row selection persists across filter changes on this grid (confirmed
    // live) - uncheck THIS candidate now, while still filtered-in, so the
    // next test's different candidate isn't evaluated alongside this one.
    await grid.uncheckAllVisibleRows();
    await grid.clearAllFilters();
  });

  test('ONB-PL-02 [Negative]: Blocked for a non-MCPPL-division candidate, even fresher + Verified', async () => {
    await grid.filterByRegId(FRESHER_VERIFIED_NON_MCPPL_ITAP);
    await grid.waitForGridDataLoaded();
    await grid.checkFirstRowCheckbox();

    const result = await grid.clickGenApprenticeLetterAndWaitForPage();
    expect(result.opened).toBe(false);
    expect(result.dialogText).toMatch(/MCPPL/i);

    await grid.uncheckAllVisibleRows();
    await grid.clearAllFilters();
  });

  test.skip('ONB-PL-04 [Negative]: (blocked) Blocked for a candidate whose documents are not yet Verified', async () => {
    // Would close ONB-068 ("Onboarding Test Cases.xlsx") - documented as
    // Live-Verified since the module's original 2026-09-01 investigation
    // (against ITAP 250347 itself, before it was ever verified - notably,
    // that candidate is "experienced", so that real result already showed
    // the "not verified" gate winning over ONB-PL-01's own
    // experienced-candidate gate when both conditions are true at once),
    // but its own Notes admitted "Automated regression test: none yet" -
    // still true.
    //
    // Blocked 2026-09-07 on the exact same structural gap as
    // ONB-AL-18 in GenAppointmentLetter.spec.js (see that test's own
    // comment for the full explanation): this file's other two tests both
    // need a candidate ALREADY in the FC Admin Onboarding grid, which per
    // ONB-097 requires Interview Final Status = "Cleared" - a separate,
    // later gate than Document Verification's own "Verification Pending"
    // queue. createClearedOnboardingCandidate() only reaches the latter
    // (confirmed live: filtering the grid by such a candidate times out -
    // it's genuinely not there), and reaching Final Status requires the
    // Feedback Form step, which this project already found (and the user
    // already accepted as an out-of-scope limitation) deterministically
    // routes to "Feedback - Training" instead of "Feedback - Interview"
    // for any candidate built through this automation's pipeline.
    //
    // Same category as ONB-PL-03 directly below: a real, documented gap,
    // left as an explicit skip with its exact blocker recorded rather than
    // a false-negative failing test or a silently-dropped test case.
  });

  test.skip('ONB-PL-03 [Positive]: (blocked) full Apprentice Letter flow for a fresher, Verified, MCPPL-division candidate', async () => {
    // Intentionally skipped, not deleted - documents exactly what's needed
    // to unblock this: an MCPPL ManagerRefID to create the right candidate
    // with (createClearedOnboardingCandidate + ITAP_ExperienceDetailPage.
    // fill_NotExperienced(), then HR Document Verification, then this
    // flow). Both real validation gates above are confirmed live; only
    // this final positive completion remains open pending that ManagerRefID.
  });
});
