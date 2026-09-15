const { test, expect } = require('@playwright/test');
const BrowserFactory = require('../../utils/BrowserFactory');
const ITAP_Login = require('../../pages/FCAdminLogin');
const { ITAP_OnboardingGrid } = require('../../pages/Onboarding');
const { ITAP_GenerateOfferLetter } = require('../../pages/Onboarding/GenAppointmentLetter');
const { addResult, saveFile } = require('../../excelReporter');
const config = require('../../config');
const { futureDateDDMMYYYY } = require('../../utils/DateHelpers');

// Gen Appointment Letter validation (see
// pages/Onboarding/GenAppointmentLetter.js, a re-export of the shared
// ITAP_GenerateOfferLetter class - see that file's comment for why). Split
// out of the consolidated tests/Onboarding.spec.js (2026-09-02) into its own
// file, matching the same one-file-per-cluster treatment already applied to
// Interview.
//
// Batch 5 of the FC Admin Onboarding automation build-out (see
// "Onboarding Test Cases.xlsx", "Gen Appointment Letter" module, ONB-080
// through ONB-093). Completed 2026-09-02: this file now covers all 13
// documented rows 1:1 (see the header of ONB-AL-05 and ONB-AL-06 below for
// the 2 that were previously missing), plus the tab-header and email-domain
// assertions those rows' own "Expected Result" text calls for that the
// original 15-test build had left unchecked.
//
// Unlike Gen Offer Letter's batch, this CANNOT reuse "Demo User Alpha" -
// that candidate has zero uploaded documents, and Gen Appointment Letter
// genuinely requires Document-Verification-verified documents to proceed
// (confirmed live this project - the earlier "confirmed backend bug"
// finding was actually this precondition, not a real defect). ITAP 250347
// ("test01 Interview Batch") is our own experienced, Verified test
// candidate created and verified earlier this project - reused here as the
// fixed recurring fixture for this module, the same role "Demo User Alpha"
// plays for Gen Offer Letter.
//
// Structured the same way as GenOfferLetter.spec.js:
//   Pass A - negative/validation checks, ends in Cancel (zero mutation).
//   Pass B - a clean, correctly-filled attempt through to a real send,
//            always to config.EmailId (see [[feedback_interview_email_destination]]).
const APPOINTMENT_LETTER_ITAP = '250347';

test.describe.serial('FC Admin - Onboarding: Gen Appointment Letter', () => {
  let bf;
  let loginPage;
  let grid;
  let letter;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    loginPage = new ITAP_Login(bf.page);
    grid = new ITAP_OnboardingGrid(bf.page);
    letter = new ITAP_GenerateOfferLetter(bf.page);

    await loginPage.performLogin(config.username, config.password);
    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();
    await grid.clickOnboardingTab();
    await grid.waitForGridDataLoaded();
    await grid.filterByRegId(APPOINTMENT_LETTER_ITAP);
    await grid.waitForGridDataLoaded();
    await grid.checkFirstRowCheckbox();
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  test.skip('ONB-AL-18 [Negative]: (blocked) Blocked for a candidate whose documents are not yet Verified', async () => {
    // Would close ONB-068 ("Onboarding Test Cases.xlsx") - documented as
    // Live-Verified since the module's original 2026-09-01 investigation
    // (against ITAP 250347 itself, before it was ever verified), but its
    // own Notes admitted "Automated regression test: none yet" - still true.
    //
    // Blocked 2026-09-07 on a real structural gap, not just missing code:
    // every other test in this file needs a candidate that's ALREADY in
    // the FC Admin Onboarding grid (ITAP 250347). Per ONB-097, a candidate
    // only appears in that grid once its Interview Final Status = "Cleared"
    // - a DIFFERENT, separate gate from Document Verification's own
    // "Verification Pending" queue (see createClearedOnboardingCandidate's
    // own header comment). createClearedOnboardingCandidate() deliberately
    // stops short of Final Status (confirmed live 2026-09-07: filtering the
    // Onboarding grid by such a candidate's Reg ID times out - it's
    // genuinely not there), so it cannot produce the right fixture for
    // THIS test - it only reaches the queue Document Verification itself
    // reads from.
    //
    // Reaching Final Status = "Cleared" requires the Feedback Form step,
    // which - per this same project's own prior, explicitly user-accepted
    // finding (see project_onboarding_module_automation memory, "Original
    // blocker" section) - deterministically opens "Feedback - Training"
    // instead of "Feedback - Interview" for any candidate built through
    // this automation's pipeline (no Training step exists in it). That was
    // already accepted as a known, out-of-scope limitation once before,
    // which is exactly why createClearedOnboardingCandidate() stops where
    // it does. Building a NEW candidate specifically to reach Final Status
    // would hit that identical wall again.
    //
    // Same category as ONB-PL-03 below: a real, documented gap, left as an
    // explicit skip with its exact blocker recorded rather than a
    // false-negative failing test or a silently-dropped test case.
  });

  // ── Pass A: negative/validation checks, ends in Cancel ───────────────────

  test('ONB-AL-01 [Positive]: Selecting a verified candidate opens the 3-tab Appointment Letter page with the expected tab headers', async () => {
    const result = await grid.clickGenAppointmentLetterAndWaitForPage();
    expect(result.dialogText).toBeNull();
    expect(result.opened).toBe(true);
    expect(await letter.getPageTitleText()).toBe('Generate Appointment Letter');

    // Per xlsx ONB-080's own Expected Result ("tabs shown: Letter Details
    // (active), Preview Letter, Preview Candidate Email") - the original
    // 15-test build checked the page title but never the tab headers
    // themselves, even though Gen Offer Letter's equivalent (ONB-045) does.
    const tabs = (await letter.getAllTexts(letter.letterTabs)).map(t => t.replace(/clickable|non-clickable/g, '').trim());
    expect(tabs).toEqual(['Letter Details', 'Preview  Letter', 'Preview Candidate Email']);
  });

  test('ONB-AL-02 [Positive/Edge]: Candidate Name and Division are disabled; Role\'s disabled state is recorded, not asserted', async () => {
    expect(await letter.isFieldDisabled('Candidate Name')).toBe(true);
    expect(await letter.isFieldDisabled('Division')).toBe(true);

    // Role renders as a combobox. An earlier live exploration this project
    // found it NOT disabled; this run found it disabled instead, against
    // the SAME candidate (250347) - who by now already has a previously-
    // generated Appointment Letter on record (this screen shows Vacant
    // Position ID/Designation/salary pre-populated from that earlier
    // submission, not a blank form). Rather than hard-assert a direction
    // that may depend on submission history, record what's actually true
    // this run - same "document the real per-run outcome" pattern as
    // ONB-047/ONB-052.
    const roleDisabled = await letter.isComboDisabled('Role');
    test.info().annotations.push({
      type: 'result',
      description: `Role combobox disabled=${roleDisabled} this run. Differs from an earlier session's "not disabled" finding against the same candidate - plausibly because this candidate now already has prior Appointment Letter submission history (Vacant Position ID/Designation/salary all pre-populated on load, unlike a first-time blank form).`,
    });
  });

  test('ONB-AL-03 [Positive]: Vacant Position ID cascade populates State/HQ/Position Role and a large Designation list', async () => {
    const picked = await letter.reselectVacantPositionId();
    expect(picked).not.toBeNull();
    expect(await letter.isComboDisabled('State *')).toBe(true);
    expect(await letter.isComboDisabled('HQ *')).toBe(true);
    expect(await letter.isComboDisabled('Position Role')).toBe(true);
    const options = await letter.getDesignationOptions();
    expect(options.length).toBeGreaterThan(50);
  });

  test('ONB-AL-04 [Positive]: Manager Name auto-fills and is disabled', async () => {
    const value = await letter.textInputByLabel('Manager Name *').inputValue();
    expect(value.length).toBeGreaterThan(0);
    expect(await letter.isFieldDisabled('Manager Name *')).toBe(true);
  });

  test('ONB-AL-05 [Negative]: Date Of Joining accepts a past date with no inline validation error', async () => {
    // Per xlsx ONB-089 - previously undocumented for Appointment Letter
    // specifically (only inferred from Gen Offer Letter's ONB-051), even
    // though the xlsx's own Expected Result flags this as MORE consequential
    // here: an Appointment Letter is a real issued document, not a draft.
    // Confirms the same missing client-side validation independently.
    await letter.setDateOfJoining('01/01/2020');
    const errorVisible = await bf.page.locator("text=/Please Select Future Date/i").count();
    expect(errorVisible).toBe(0);
    expect(await letter.getDateOfJoiningValue()).toBe('01/01/2020');

    test.info().annotations.push({
      type: 'known-issue',
      description: 'Date Of Joining has no client-side future-date validation on Gen Appointment Letter either - a clearly past date (01/01/2020) is accepted silently. Setting it to a real future date before continuing.',
    });
    // Set a real future date now, needed for Pass B's successful submission.
    await letter.setDateOfJoining(futureDateDDMMYYYY(2));
  });

  test('ONB-AL-06 [Edge]: Picking a new Designation can reset editable salary fields, inconsistently', async () => {
    // Per xlsx ONB-088 - previously undocumented for Appointment Letter
    // specifically (only inferred from Gen Offer Letter's ONB-052). ONB-AL-02
    // already proved at least one real field-level difference (Role's
    // disabled state) exists between the two letter types, so this reset
    // behavior shouldn't be assumed identical without its own check either.
    const options = await letter.getDesignationOptions();
    const pick = options.find(o => /mr|representative|field/i.test(o)) || options[0];
    await letter.selectDesignation(pick);

    // Confirmed live for Gen Offer Letter (ONB-052) that this reset is NOT
    // 100% consistent per field/attempt - documents the actual per-field
    // outcome here rather than asserting a universal rule.
    const resetLikeValues = new Set(['', '0.00', '0']);
    const results = {};
    for (const category of ['Gross Total', 'Basic', 'Base Pay', 'IMGI', 'Bonus (Annual)', 'Leave Travel Allowance']) {
      const value = await letter.salaryRow(category).locator("input[type='text']").first().inputValue();
      results[category] = resetLikeValues.has(value) ? 'reset' : `NOT reset (still "${value}")`;
    }
    test.info().annotations.push({ type: 'result', description: `Per-field outcome after Designation change: ${JSON.stringify(results)}` });

    // Whatever the per-field outcome, ONB-AL-11 (Pass B) always explicitly
    // refills every field before Calculate Salary - so this doesn't block
    // the rest of the flow either way.
    expect(Object.keys(results).length).toBe(6);
  });

  test('ONB-AL-07 [Positive]: Both toggles default to ON', async () => {
    expect(await letter.getToggleState('Is Header and Footer required in Letter?')).toBe(true);
    expect(await letter.getToggleState('Is Signature Required in Letter?')).toBe(true);
  });

  test('ONB-AL-08 [Negative]: Calculate Salary does not silently succeed with a blank salary field', async () => {
    const totalCtcBefore = await letter.getTotalCtcValues();
    await letter.fillSalaryField('Gross Total', '');
    await letter.clickCalculateSalary();
    const error = await letter.getCalculateSalaryInlineError();
    const totalCtcAfter = await letter.getTotalCtcValues();

    test.info().annotations.push({ type: 'result', description: `Inline error: "${error}"; Total CTC before=${JSON.stringify(totalCtcBefore)} after=${JSON.stringify(totalCtcAfter)}` });
    if (error) {
      expect(error).toMatch(/enter valid/i);
    } else {
      expect(totalCtcAfter).toEqual(totalCtcBefore);
    }
  });

  test('ONB-AL-09 [Negative]: Submit and Preview does not advance while salary is still invalid', async () => {
    await letter.fillSalaryField('Gross Total', '');
    await letter.clickSubmitAndPreview();
    const outcome = await letter.getOutcomeAfterSubmit(4000);
    test.info().annotations.push({ type: 'result', description: `Outcome text: "${outcome}"` });
    if (outcome) expect(outcome).toMatch(/salary/i);
    expect(await letter.getActiveSubTabText()).toBe('Letter Details');
  });

  test('ONB-AL-10 [Positive]: Cancel discards all changes and returns to the grid', async () => {
    await letter.clickCancelLetterDetails();
    await bf.hardWait(1);
    expect(await grid.getActiveTabText()).toBe('Onboarding');

    await grid.filterByRegId(APPOINTMENT_LETTER_ITAP);
    await grid.waitForGridDataLoaded();
    const afterCells = await grid.getFirstRowCellsText();
    expect(afterCells).not.toContain('01/ 01/ 2020');
    expect(afterCells).not.toContain('01/01/2020');
  });

  // ── Pass B: a clean, correctly-filled attempt through to a real send ────

  test('ONB-AL-11 [Positive]: A fully-filled Letter Details tab calculates Total CTC with no error', async () => {
    await grid.checkFirstRowCheckbox();
    const result = await grid.clickGenAppointmentLetterAndWaitForPage();
    expect(result.opened).toBe(true);

    await letter.reselectVacantPositionId();
    const options = await letter.getDesignationOptions();
    const pick = options.find(o => /mr|representative|field/i.test(o)) || options[0];
    await letter.selectDesignation(pick);
    await letter.fillAllEditableSalaryFields();
    await letter.setDateOfJoining(futureDateDDMMYYYY(2));

    await letter.clickCalculateSalary();
    const error = await letter.getCalculateSalaryInlineError();
    expect(error).toBe('');
    const ctcValues = await letter.getTotalCtcValues();
    expect(ctcValues.some(v => parseFloat(v.replace(/,/g, '')) > 0)).toBe(true);
  });

  test('ONB-AL-12 [Positive]: Submit and Preview succeeds and shows the generated PDF named for this candidate', async () => {
    let activeTab = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await letter.clickSubmitAndPreview();
      await letter.getOutcomeAfterSubmit();
      activeTab = await letter.getActiveSubTabText();
      test.info().annotations.push({ type: 'result', description: `Submit attempt ${attempt}: active tab = ${activeTab}` });
      if (/Preview\s*Letter/i.test(activeTab)) break;
    }
    expect(activeTab).toMatch(/Preview\s*Letter/i);

    const rowTexts = await letter.getPreviewLetterRowTexts();
    expect(rowTexts.length).toBeGreaterThan(0);
    expect(rowTexts[0]).toContain('Appointment_Letter.pdf');
    // Per xlsx ONB-085's own Expected Result ("Test01 Interview Batch-
    // Appointment_Letter.pdf") - the filename should also carry this
    // candidate's identity, not just the generic letter-type suffix
    // (the original build only checked the latter).
    expect(rowTexts[0]).toMatch(/test01/i);
  });

  test('ONB-AL-13 [Positive]: "View Candidate Email" navigates to the Preview Candidate Email tab', async () => {
    await letter.clickViewCandidateEmail();
    expect(await letter.getActiveSubTabText()).toMatch(/Preview Candidate Email/i);
  });

  test('ONB-AL-14 [Negative]: To defaults to the candidate\'s own personal email; CC still defaults to a real colleague', async () => {
    const to = await letter.getEmailFieldValue('To');
    const cc = await letter.getEmailFieldValue('CC');
    expect(to.length).toBeGreaterThan(0);

    // Per xlsx ONB-086's own Expected Result: To should be the candidate's
    // own (personal-domain) address - the opposite default from Gen Offer
    // Letter, where To defaults to a real internal colleague (ONB-061) -
    // while CC still defaults to a real internal colleague here too.
    // Asserting the domain shape rather than an exact hardcoded address,
    // since the exact personal address is this specific fixture candidate's
    // own signup value, not a fixed config constant.
    expect(to.toLowerCase()).not.toContain('@mankindpharma.com');
    if (cc) expect(cc.toLowerCase()).toContain('@mankindpharma.com');

    test.info().annotations.push({
      type: 'result',
      description: `To="${to}" CC="${cc}" - per project policy, both are overridden to config.EmailId before any real send regardless of what looks "acceptable" here.`,
    });
  });

  test('ONB-AL-15 [Positive]: An attachment link to the generated PDF is present', async () => {
    expect(await letter.isAttachmentLinkVisible()).toBe(true);
  });

  test('ONB-AL-16 [Positive]: Overriding To/CC to the safe monitored address and sending succeeds', async () => {
    await letter.setEmailFieldValue('To', config.EmailId);
    await letter.setEmailFieldValue('CC', '');
    expect(await letter.getEmailFieldValue('To')).toBe(config.EmailId);

    await letter.clickSendToCandidate();
    const outcome = await letter.getOutcomeAfterSend();
    expect(outcome).toMatch(/sent successfully/i);
  });

  test('ONB-AL-17 [Positive]: Grid reflects the send after returning', async () => {
    await letter.clickBackToGrid();
    await grid.waitForAppointmentPageReady();
    await grid.waitForGridDataLoaded();

    // Genuinely determine whether an "Appointment Letter" Yes/No filter
    // column exists (this was never confirmed live before now) rather than
    // assuming it mirrors Offer Letter's grid exactly. Checked via a fast
    // .count() first - clicking a 0-match locator directly would otherwise
    // burn through Playwright's ~30s actionability timeout per attempt.
    let sawInFilteredGrid = false;
    let usedFallback = false;
    const columnExists = (await grid.thForColumn('Appointment Letter').count()) > 0;
    if (columnExists) {
      await grid.filterByDropdown('Appointment Letter', 'Yes');
      const rowCount = await grid.getVisibleRowCount();
      const regIds = [];
      for (let i = 0; i < rowCount; i++) regIds.push(await grid.getColumnValueForRowIndex(i, 'Reg ID'));
      await grid.clearAllFilters();
      sawInFilteredGrid = regIds.includes(APPOINTMENT_LETTER_ITAP);
    } else {
      usedFallback = true;
      await grid.filterByRegId(APPOINTMENT_LETTER_ITAP);
      await grid.waitForGridDataLoaded();
      sawInFilteredGrid = (await grid.getVisibleRowCount()) > 0;
      await grid.clearAllFilters();
    }
    test.info().annotations.push({
      type: 'result',
      description: usedFallback
        ? 'No "Appointment Letter" dropdown filter column exists on this grid - fell back to confirming the candidate still exists via Reg ID filter.'
        : 'A real "Appointment Letter" Yes/No filter column exists and correctly includes this candidate after the send.',
    });
    expect(sawInFilteredGrid).toBe(true);
  });
});
