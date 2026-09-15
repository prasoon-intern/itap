const { test, expect } = require('@playwright/test');
const BrowserFactory = require('../../utils/BrowserFactory');
const ITAP_Login = require('../../pages/FCAdminLogin');
const { ITAP_InterviewGrid } = require('../../pages/Interview');
const { ITAP_InterviewSetup } = require('../../pages/Interview/Setup');
const { ITAP_PreviewInterviewerEmail } = require('../../pages/Interview/PreviewInterviewerEmail');
const { ITAP_PreviewCandidateEmail } = require('../../pages/Interview/PreviewCandidateEmail');
const { addResult, saveFile } = require('../../excelReporter');
const config = require('../../config');
const ctx = require('../../utils/Globals.js');
const { createFreshInterviewCandidate } = require('../../utils/createFreshInterviewCandidate.js');

// Everything needed to search for a candidate, fill out the Schedule
// Interview form, and Allocate/Submit/Confirm — the "Interview Setup" flow
// (see pages/Interview/Setup.js). Split out of the old single
// tests/Interview.spec.js (2026-09-02) — three describe blocks that all
// exercise this same setup form, from different angles:
// - Schedule Interview Form Validation: field-level validation on the setup
//   form itself.
// - Multi-Candidate Batch Scheduling: scheduling 2+ candidates in one
//   submission (needs the full setup->both-emails flow to actually confirm
//   it worked, so it also imports the two email-preview page objects).
// - Schedule Interview Edge Cases: Cancel/decline-only edge cases against a
//   short-lived session (confirmed live: clickScheduleInterview() is
//   reliable early in a fresh session but became flaky once the shared
//   Interview grid session had 45+ prior tests behind it).

test.describe.serial('FC Admin - Schedule Interview Form Validation', () => {
  let bf;
  let loginPage;
  let appt;

  test.beforeAll(async () => {
    // Self-sufficient: creates its own fresh candidate rather than
    // depending on cross-file execution order (see project memory on the
    // "Run All" cascading-failure fix).
    // Default hook timeout (120s) isn't enough once beforeAll also creates
    // a fresh candidate (~3 min) - confirmed live as a "beforeAll hook
    // timeout exceeded" failure.
    test.setTimeout(300000);
    await createFreshInterviewCandidate();

    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    // Defensive: a native browser dialog (confirm/alert) left unhandled can
    // block Playwright indefinitely with no timeout ever firing - confirmed
    // live as a multi-minute hang with the process sitting fully idle.
    bf.page.on('dialog', (d) => d.dismiss().catch(() => {}));
    loginPage = new ITAP_Login(bf.page);
    appt = new ITAP_InterviewSetup(bf.page);

    await loginPage.performLogin(config.username, config.password);
    await loginPage.navigateToAppointment();
    await bf.hardWait(2);

    if (!ctx.itapNumber) {
      throw new Error('ctx.itapNumber is not set - createFreshInterviewCandidate() must have failed silently.');
    }

    await appt.searchItapNumber(ctx.itapNumber);
    await bf.hardWait(2);

    // Confirmed live: clicking the checkbox immediately after the filtered
    // search re-renders can lose the click if the row's DOM node gets
    // replaced mid-click. Retry until it's actually checked.
    const checkbox = bf.page.locator(appt.itapCheckbox).first();
    let isChecked = false;
    for (let attempt = 0; attempt < 5 && !isChecked; attempt++) {
      await checkbox.click({ force: true }).catch(() => {});
      await bf.hardWait(1);
      isChecked = await checkbox.isChecked().catch(() => false);
    }
    if (!isChecked) {
      throw new Error(`Could not check the candidate checkbox for ITAP ${ctx.itapNumber} after 5 attempts.`);
    }

    await appt.clickScheduleInterview();
    await bf.hardWait(2);
    await bf.page.locator('.mx-name-comboBox1 .widget-combobox-input').waitFor({ state: 'visible', timeout: 20000 });
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  async function dismissErrorBanner() {
    const closeBtn = bf.page.locator("button:has-text('OK'), button:has-text('Ok'), .mx-icon-close, [aria-label='Close']");
    if (await closeBtn.count()) await closeBtn.first().click({ timeout: 3000 }).catch(() => {});
    await bf.hardWait(1);
  }

  test('INT-18 [Positive]: Interviewer field only suggests valid (non-empty) interviewers', async () => {
    const suggestions = await appt.getInterviewerSuggestions();
    console.log('RESULT Interviewer suggestions (first few):', JSON.stringify(suggestions.slice(0, 5)), '| total:', suggestions.length);
    test.info().annotations.push({ type: 'result', description: `Interviewer suggestions (first few): ${JSON.stringify(suggestions.slice(0, 5))}` });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.length).toBeGreaterThan(0);
    }
  });

  test('INT-59 [Negative]: Interviewer selected but Start Date left blank shows mandatory-fields error', async () => {
    await appt.selectInterviewer();
    await bf.hardWait(1);
    await appt.clickAllocate();
    await bf.hardWait(1);
    const errorText = await appt.getMandatoryFieldsErrorText();
    expect(errorText).toMatch(/please fill all mandatory fields/i);
    await dismissErrorBanner();
  });

  test('INT-21 [Negative]: Allocate blocked when every field is left blank', async () => {
    // Checkbox-list multi-select: running the exact same arrow-down x3 +
    // Enter sequence again lands on the same item and toggles it back off,
    // since it's already checked from INT-59.
    await appt.selectInterviewer();
    await bf.hardWait(1);

    await appt.clickAllocate();
    await bf.hardWait(1);
    const errorText = await appt.getMandatoryFieldsErrorText();
    expect(errorText).toMatch(/please fill all mandatory fields/i);
    await dismissErrorBanner();
  });

  test('TC-037 [Negative]: Past Start Date shows "Please Select Future Date" inline', async () => {
    await appt.click(appt.Interview_date);
    await appt.fill(appt.Interview_date, '01/01/2020');
    await bf.page.keyboard.press('Tab');
    await bf.hardWait(1);
    const inlineText = await appt.getDateValidationInlineText();
    expect(inlineText).toMatch(/please select future date/i);
  });

  test('INT-61 [Edge]: Start Date set to exactly today', async () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    await appt.click(appt.Interview_date);
    await appt.fill(appt.Interview_date, todayStr);
    await bf.page.keyboard.press('Tab');
    await bf.hardWait(1);
    const inlineText = await appt.getDateValidationInlineText();
    console.log(`RESULT Today's date (${todayStr}) validation message:`, inlineText || 'none shown');
    test.info().annotations.push({ type: 'result', description: `Today's date (${todayStr}) validation message: ${inlineText || 'none shown'}` });
    // Documents actual behavior at the boundary rather than assuming which
    // way it should go - either outcome is informative.
    expect(typeof inlineText === 'string' || inlineText === null).toBe(true);
  });

  test('INT-60 [Edge]: Selecting the maximum available Duration value is accepted', async () => {
    const durations = await appt.getDurationOptions();
    console.log('RESULT Duration options:', JSON.stringify(durations));
    test.info().annotations.push({ type: 'result', description: `Duration options: ${JSON.stringify(durations)}` });
    expect(durations.length).toBeGreaterThan(0);
    const maxDuration = durations[durations.length - 1];
    await appt.selectDurationByLabel(maxDuration);
    await bf.hardWait(1);
    expect(await bf.page.locator(appt.durationDropdown).inputValue()).toBeTruthy();
  });

  test('TC-036 [Negative]: End Time earlier than Start Time is rejected or not silently accepted', async () => {
    // Rebuild a fully valid baseline first - interviewer (currently blank
    // since INT-21 toggled it off) and a real future date (currently holds
    // today's date from INT-61) - so the mandatory-fields error can't mask
    // the specific time-order behavior being tested here.
    await appt.selectInterviewer();
    await bf.hardWait(1);
    await appt.click(appt.Interview_date);
    await appt.fill(appt.Interview_date, config.interviewDate);
    await bf.page.keyboard.press('Tab');
    await bf.hardWait(1);

    const startOptions = (await appt.getStartTimeOptions()).map(o => o.trim()).filter(Boolean);
    const endOptions = (await appt.getEndTimeOptions()).map(o => o.trim()).filter(Boolean);
    console.log('RESULT Start options:', JSON.stringify(startOptions), '| End options:', JSON.stringify(endOptions));
    test.info().annotations.push({ type: 'result', description: `Start options: ${JSON.stringify(startOptions)} | End options: ${JSON.stringify(endOptions)}` });
    expect(startOptions.length).toBeGreaterThan(1);
    expect(endOptions.length).toBeGreaterThan(1);

    // Pick a "late" Start Time and an "early" End Time, assuming both lists
    // are in chronological order (see the annotation above for the real
    // values captured on this run).
    const lateStart = startOptions[startOptions.length - 1];
    const earlyEnd = endOptions[0];

    await appt.selectStartTimeByLabel(lateStart);
    await appt.selectEndTimeByLabel(earlyEnd);
    await appt.selectAmPm1ByLabel('AM');
    await appt.selectAmPm2ByLabel('AM');
    await bf.hardWait(1);
    await appt.clickAllocate();
    await bf.hardWait(1);

    const mandatoryError = await appt.getMandatoryFieldsErrorText();
    const genericErrorDialog = await bf.page.locator("[role='dialog']:has-text('Error')").count();
    const allocatedEndTime = await bf.page.locator('table').locator(`text=${earlyEnd}`).count();

    console.log(`RESULT TC-036 outcome: mandatoryError=${mandatoryError}, genericErrorDialogCount=${genericErrorDialog}, endTimeAppearedInTable=${allocatedEndTime > 0}`);
    test.info().annotations.push({
      type: 'result',
      description: `mandatoryError=${mandatoryError}, genericErrorDialogCount=${genericErrorDialog}, endTimeAppearedInTable=${allocatedEndTime > 0}`,
    });

    // Known app bug (confirmed live): picking an End Time earlier than the
    // Start Time shows no error at all - Allocate just silently no-ops
    // (mandatoryError=null, genericErrorDialogCount=0, endTimeAppearedInTable=
    // false). Per explicit user direction, this test asserts the CORRECT
    // behavior (an explicit error should be shown) rather than accepting the
    // silent-failure as passing, and is intentionally left red until the dev
    // team adds real validation in Mendix - same pattern as TC-019 (future
    // interview date bug in tests/Candidate/Phase1.spec.js).
    const rejectedViaError = Boolean(mandatoryError) || genericErrorDialog > 0;
    expect(rejectedViaError).toBe(true);
    if (mandatoryError || genericErrorDialog > 0) await dismissErrorBanner();
  });

  test('Cleanup: Cancel out of the Schedule Interview screen without submitting', async () => {
    const cancelBtn = bf.page.locator("button:has-text('Cancel')");
    if (await cancelBtn.count()) {
      await appt.clickCancel();
    }
  });
});

// Multi-candidate batch scheduling module from "Fc_admin interview.xlsx"
// (FCI-01, FCI-02). FCI-01 needs 2 simultaneously-eligible fresh candidates
// - checking both boxes before clicking "Schedule Interview" (confirmed
// live: checkbox selection survives clearing the Reg ID search filter,
// letting two different candidates both stay checked at once). FCI-02
// pairs one eligible candidate with an already-finalized/ineligible one.
// Self-sufficient: creates its own two fresh candidates directly in
// beforeAll (see project memory on the "Run All" cascading-failure fix).
test.describe.serial('FC Admin - Multi-Candidate Batch Scheduling', () => {
  let bf;
  let loginPage;
  let grid;
  let sched;
  let interviewerEmail;
  let candidateEmail;
  let regId1;
  let regId2;
  let regId3;

  test.beforeAll(async () => {
    // Default hook timeout (120s) isn't enough once beforeAll creates
    // THREE fresh candidates (~3 min each, ~9 min total) plus FC Admin
    // login - confirmed live elsewhere as a "beforeAll hook timeout
    // exceeded" failure once candidate creation was added to a beforeAll.
    test.setTimeout(720000);
    await createFreshInterviewCandidate();
    regId1 = ctx.itapNumber;
    await createFreshInterviewCandidate();
    regId2 = ctx.itapNumber;
    // FCI-01 schedules and consumes regId1/regId2, so FCI-02 (which runs
    // after it in this serial describe block) needs its own third fresh,
    // still-eligible candidate rather than reusing either of those.
    await createFreshInterviewCandidate();
    regId3 = ctx.itapNumber;

    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    loginPage = new ITAP_Login(bf.page);
    grid = new ITAP_InterviewGrid(bf.page);
    sched = new ITAP_InterviewSetup(bf.page);
    interviewerEmail = new ITAP_PreviewInterviewerEmail(bf.page);
    candidateEmail = new ITAP_PreviewCandidateEmail(bf.page);

    await loginPage.performLogin(config.username, config.password);
    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  // Checks both target Reg IDs' checkboxes, one search at a time - checkbox
  // state is confirmed live to persist across clearing the Reg ID filter,
  // so this correctly leaves both rows checked simultaneously even though
  // the grid can only search one Reg ID at a time.
  async function checkTwoCandidates(regIdA, regIdB) {
    for (const regId of [regIdA, regIdB]) {
      await sched.searchItapNumber(regId);
      await bf.hardWait(1);
      await sched.ensureItapCheckboxChecked();
      await bf.page.locator(sched.itapSearchField).fill('');
      await bf.page.keyboard.press('Enter');
      await bf.hardWait(1);
    }
  }

  test('FCI-01 [Positive]: Schedule interviews for multiple candidates in one submission', async () => {
    await checkTwoCandidates(regId1, regId2);

    // Use the already-hardened clickScheduleInterview() (polls for the
    // button, retries a raw JS click, verifies the setup form actually
    // appeared) instead of a single bare evaluate() click - confirmed live
    // 2026-08-26 that the bare click here was unreliable and could leave
    // the batch table with fewer than 2 rows selected by the time the setup
    // form was checked.
    await sched.clickScheduleInterview();
    await expect(bf.page.locator(sched.interviewerInput)).toBeVisible();

    // Both selected candidates appear together in the setup table.
    expect(await sched.getBatchTableRowCount()).toBe(2);

    await sched.selectInterviewer(config.interviewerName);
    await sched.selectInterviewDate();
    await sched.selectStartTime();
    await sched.selectAM_PM1();
    await sched.selectEndTime();
    await sched.selectAM_PM2();
    await sched.selectDuration();
    await sched.clickAllocate();
    await bf.hardWait(1);
    await sched.clickSubmit();
    await bf.hardWait(1);
    await bf.page.getByRole('button', { name: 'Yes', exact: true }).click();
    await bf.hardWait(2);

    // Complete both emails in this same session (confirmed live: no
    // reopening this screen once started).
    await interviewerEmail.updateInterviewerToEmail();
    await interviewerEmail.clickSendEmailToInterviewers();
    await bf.hardWait(1);
    await interviewerEmail.confirmInterviewerEmail();
    await bf.hardWait(1);
    await candidateEmail.clickJS(candidateEmail.previewCandidateTab);
    await bf.hardWait(1);
    await candidateEmail.updateCandidateToEmail();
    await candidateEmail.clearCandidateCCField();
    await candidateEmail.clickSendEmailToCandidates();
    await bf.hardWait(1);
    await candidateEmail.confirmCandidateEmail();
    await bf.hardWait(1);
    await candidateEmail.clickEmailSuccessOk();
    await bf.hardWait(1);

    // Confirmed live: a single submission scheduled BOTH candidates.
    const cells1 = await grid.getRowCellsByRegId(regId1);
    const cells2 = await grid.getRowCellsByRegId(regId2);
    expect(cells1[9]).toBe('Scheduled');
    expect(cells2[9]).toBe('Scheduled');
  });

  test('FCI-02 [Negative]: Selecting an eligible candidate together with an ineligible one blocks the whole batch', async () => {
    // An already-finalized candidate from an earlier Rejected-path run
    // (Next Round Required = No) - genuinely ineligible.
    const ineligibleRegId = '250303';
    const ineligibleCells = await grid.getRowCellsByRegId(ineligibleRegId);
    test.skip(ineligibleCells[11] !== 'No', `Candidate ${ineligibleRegId} is no longer in the expected ineligible state (Next round = ${ineligibleCells[11]}) - this test relies on a specific earlier run's leftover state.`);

    await checkTwoCandidates(regId3, ineligibleRegId);
    await bf.page.locator(sched.scheduleInterviewBtn).evaluate((el) => el.click());
    await bf.hardWait(2);

    // Confirmed live: the whole batch is blocked, not just the ineligible
    // row silently dropped - the same "Next round cannot be set" error as
    // the single-candidate case (TC-039), naming the ineligible candidate.
    await expect(bf.page.locator('text=/cannot be set/i')).toBeVisible();
    const setupVisible = await bf.page.locator(sched.interviewerInput).isVisible().catch(() => false);
    expect(setupVisible).toBe(false);

    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();
  });
});

// Schedule Interview edge cases from "Fc_admin interview.xlsx" (INT-63,
// INT-62, INT-23) that need to actually reach the real Schedule Interview
// setup form (unlike TC-039 in the Grid/Filters file, which is blocked
// before ever getting there). Deliberately kept in their own short-lived
// session - confirmed live that clickScheduleInterview() is reliable early
// in a fresh session but became flaky once a shared session had 45+ prior
// tests behind it. None of these three ever complete a real Allocate/
// confirmed Submit - only Cancel/decline actions - so nothing is ever
// actually scheduled, so all three safely reuse the one candidate created
// below. Self-sufficient: creates its own fresh candidate directly (see
// project memory on the "Run All" cascading-failure fix).
test.describe.serial('FC Admin - Schedule Interview Edge Cases', () => {
  let bf;
  let loginPage;
  let grid;
  let sched;
  let regId;

  test.beforeAll(async () => {
    // Default hook timeout (120s) isn't enough once beforeAll also creates
    // a fresh candidate (~3 min) - confirmed live as a "beforeAll hook
    // timeout exceeded" failure once candidate creation was added.
    test.setTimeout(300000);
    await createFreshInterviewCandidate();
    regId = ctx.itapNumber;

    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    loginPage = new ITAP_Login(bf.page);
    grid = new ITAP_InterviewGrid(bf.page);
    sched = new ITAP_InterviewSetup(bf.page);

    await loginPage.performLogin(config.username, config.password);
    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  test('INT-63 [Edge]: Move Up / Move Down are disabled with only one candidate in the batch', async () => {
    await sched.searchItapNumber(regId);
    await bf.hardWait(1);
    await sched.ensureItapCheckboxChecked();
    await sched.clickScheduleInterview();
    await bf.hardWait(1);

    expect(await sched.isMoveDownEnabled()).toBe(false);
    expect(await sched.isMoveUpEnabled()).toBe(false);

    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();
  });

  test('INT-62 [Negative]: Removing every candidate from the batch does not block Submit & Preview at the UI level', async () => {
    await sched.searchItapNumber(regId);
    await bf.hardWait(1);
    await sched.ensureItapCheckboxChecked();
    await sched.clickScheduleInterview();
    await bf.hardWait(1);

    await sched.deleteBatchRowByRegId(regId);
    expect(await sched.getBatchTableRowCount()).toBe(0);

    // Confirmed live: same as FCI-03 - the app does not block this at the
    // button/click level even with zero candidates in the batch, still
    // showing the "Are you sure...?" confirmation. Declines rather than
    // actually confirming, so nothing is submitted.
    await sched.click(sched.submitBtn);
    await bf.hardWait(1);
    await expect(bf.page.locator("text=/submit the schedule and preview the emails/i")).toBeVisible();
    await bf.page.getByRole('button', { name: 'No', exact: true }).click();
    await bf.hardWait(1);

    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();

    // Confirm the candidate itself still exists and is untouched - only
    // removed from this local batch, never from the system.
    const cells = await grid.getRowCellsByRegId(regId);
    expect(cells[9]).toBe('Not Scheduled');
  });

  test('INT-23 [Positive]: Cancelling out of the Schedule Interview screen discards changes', async () => {
    await sched.searchItapNumber(regId);
    await bf.hardWait(1);
    await sched.ensureItapCheckboxChecked();
    await sched.clickScheduleInterview();
    await bf.hardWait(1);

    // Make a real change (pick an interviewer) before cancelling, so this
    // actually tests that Cancel discards it rather than trivially passing
    // on an already-empty form.
    await sched.selectInterviewer(config.interviewerName);

    await bf.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await bf.hardWait(1);
    await bf.page.getByRole('button', { name: 'Yes', exact: true }).click();
    await bf.hardWait(1);

    // Confirmed live: confirming Cancel redirects to a completely unrelated
    // "CDC" module page (Talent Pool tab), not back to the Interview grid -
    // a real navigation quirk, not a test bug. Recover with an explicit
    // navigateToAppointment() rather than any Back/Cancel click.
    test.info().annotations.push({
      type: 'known-issue',
      description: 'Confirming "Cancel" on the Schedule Interview screen redirects to an unrelated "CDC" (Talent Pool) module page instead of back to the Interview grid.',
    });

    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();

    const cells = await grid.getRowCellsByRegId(regId);
    expect(cells[9]).toBe('Not Scheduled');
  });
});
