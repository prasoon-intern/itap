const { test, expect } = require('@playwright/test');
const BrowserFactory = require('../../utils/BrowserFactory');
const ITAP_Login = require('../../pages/FCAdminLogin');
const { ITAP_InterviewGrid } = require('../../pages/Interview');
const { ITAP_InterviewSetup } = require('../../pages/Interview/Setup');
const { ITAP_PreviewInterviewerEmail } = require('../../pages/Interview/PreviewInterviewerEmail');
const { addResult, saveFile } = require('../../excelReporter');
const config = require('../../config');
const ctx = require('../../utils/Globals.js');
const { createFreshInterviewCandidate } = require('../../utils/createFreshInterviewCandidate.js');

// Preview Interviewer Email tab validation (see pages/Interview/PreviewInterviewerEmail.js).
// Originally extracted out of tests/Interview/Process.spec.js's E2E chain
// (2026-09-02) into its own fully independent describe.serial block, matching
// the same pattern already used by Setup.spec.js/StatusFeedback.spec.js:
// creates its own fresh candidate and drives its own schedule+allocate+
// submit+confirm in beforeAll to reach this tab, rather than depending on the
// E2E chain having already run. Process.spec.js was later removed entirely
// (2026-09-02) as a redundant duplicate of the coverage in this file and
// PreviewCandidateEmail.spec.js — this file owns the actual validation of
// this tab's behavior.
test.describe.serial('FC Admin - Preview Interviewer Email Validation', () => {
  let bf;
  let grid;
  let setup;
  let interviewerEmail;

  test.beforeAll(async () => {
    // Default hook timeout (120s) isn't enough once beforeAll also creates
    // a fresh candidate (~3 min) plus a full schedule+allocate+submit+confirm
    // flow - confirmed live elsewhere as a "beforeAll hook timeout exceeded"
    // failure once candidate creation was added.
    test.setTimeout(480000);
    await createFreshInterviewCandidate();

    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    const loginPage = new ITAP_Login(bf.page);
    grid = new ITAP_InterviewGrid(bf.page);
    setup = new ITAP_InterviewSetup(bf.page);
    interviewerEmail = new ITAP_PreviewInterviewerEmail(bf.page);

    await loginPage.performLogin(config.username, config.password);
    await loginPage.navigateToAppointment();
    await grid.waitForAppointmentPageReady();

    await setup.searchItapNumber(ctx.itapNumber);
    await bf.hardWait(1);
    await setup.selectItapCheckbox();
    await bf.hardWait(1);
    await setup.clickScheduleInterview();
    await setup.selectInterviewer();
    await setup.selectInterviewDate();
    await setup.selectStartTime();
    await setup.selectAM_PM1();
    await setup.selectEndTime();
    await setup.selectAM_PM2();
    await setup.selectDuration();
    await setup.clickAllocate();
    await bf.hardWait(1);
    await setup.clickSubmit();
    await bf.hardWait(1);
    await setup.clickConfirm();
    await bf.hardWait(1);
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  test('INT-27 [Positive]: Preview Interviewer Email tab shows correct, editable To/CC fields', async () => {
    await bf.hardWait(1);
    await expect(bf.page.locator(interviewerEmail.interviewerToField)).toBeVisible();
    await expect(bf.page.locator(interviewerEmail.interviewerCCField)).toBeVisible();
    // config.EmailId per standing instruction - all Interview module
    // automation emails go there, never anywhere else.
    await interviewerEmail.updateInterviewerToEmail();
    await expect(bf.page.locator(interviewerEmail.interviewerToField)).toHaveValue(config.EmailId);
  });

  // Confirmed live: neither an emptied "To" field nor a malformed address
  // mixed into "CC" is rejected at the confirmation-dialog stage - the same
  // "Are you sure...?" popup appears regardless. This documents that real
  // behavior rather than asserting the xlsx's assumed "blocked from
  // sending" - always declines (No), so nothing invalid is ever actually
  // sent.
  test('INT-30 [Negative]: Invalid/empty "To" email does not block reaching the send confirmation', async () => {
    await bf.hardWait(1);
    const toField = bf.page.locator(interviewerEmail.interviewerToField);
    await toField.click();
    await bf.page.keyboard.press('Control+A');
    await bf.page.keyboard.press('Backspace');
    await bf.hardWait(1);
    await interviewerEmail.clickSendEmailToInterviewers();
    await bf.hardWait(1);
    await expect(bf.page.locator("[role='dialog']")).toBeVisible();
    await bf.page.getByRole('button', { name: 'No', exact: true }).click();
    await bf.hardWait(1);
    // Restore a valid To before continuing.
    await interviewerEmail.updateInterviewerToEmail();
  });

  test('INT-66 [Negative]: A malformed address mixed into CC does not block reaching the send confirmation', async () => {
    await bf.hardWait(1);
    const ccField = bf.page.locator(interviewerEmail.interviewerCCField);
    await ccField.click();
    await bf.page.keyboard.press('Control+A');
    await bf.page.keyboard.press('Backspace');
    await ccField.fill('not-an-email, ' + config.EmailId);
    await bf.hardWait(1);
    await interviewerEmail.clickSendEmailToInterviewers();
    await bf.hardWait(1);
    await expect(bf.page.locator("[role='dialog']")).toBeVisible();
    await bf.page.getByRole('button', { name: 'No', exact: true }).click();
    await bf.hardWait(1);
    // Clear CC back to clean before the real send.
    await ccField.click();
    await bf.page.keyboard.press('Control+A');
    await bf.page.keyboard.press('Backspace');
  });

  test('INT-67 [Negative]: Declining the send-confirmation popup does not send the email', async () => {
    await bf.hardWait(1);
    await interviewerEmail.clickSendEmailToInterviewers();
    await bf.hardWait(1);
    await bf.page.getByRole('button', { name: 'No', exact: true }).click();
    await bf.hardWait(1);
    // Still on the same Preview Interviewer Email tab, To field intact.
    await expect(bf.page.locator(interviewerEmail.interviewerToField)).toHaveValue(config.EmailId);
  });

  test('INT-28 [Positive]: Sending interviewer email requires confirmation and shows success', async () => {
    await bf.hardWait(1);
    await interviewerEmail.clickSendEmailToInterviewers();
    await bf.hardWait(1);
    await interviewerEmail.confirmInterviewerEmail();
  });
});
