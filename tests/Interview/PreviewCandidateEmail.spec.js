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

// Preview Candidate Email tab validation (see pages/Interview/PreviewCandidateEmail.js).
// Originally extracted out of tests/Interview/Process.spec.js's E2E chain
// (2026-09-02) into its own fully independent describe.serial block, matching
// the same pattern already used by Setup.spec.js/StatusFeedback.spec.js:
// creates its own fresh candidate and drives its own schedule+allocate+
// submit+confirm, then sends the interviewer email for real (required to
// reach this tab at all — confirmed live it does not auto-advance otherwise)
// in beforeAll, rather than depending on the E2E chain having already run.
// Process.spec.js was later removed entirely (2026-09-02) as a redundant
// duplicate of the coverage in this file and PreviewInterviewerEmail.spec.js —
// this file owns the actual validation of this tab's behavior.
test.describe.serial('FC Admin - Preview Candidate Email Validation', () => {
  let bf;
  let grid;
  let setup;
  let interviewerEmail;
  let candidateEmail;

  test.beforeAll(async () => {
    // Default hook timeout (120s) isn't enough once beforeAll also creates
    // a fresh candidate (~3 min) plus a full schedule+allocate+submit+confirm+
    // interviewer-email-send flow - confirmed live elsewhere as a "beforeAll
    // hook timeout exceeded" failure once candidate creation was added.
    test.setTimeout(480000);
    await createFreshInterviewCandidate();

    bf = new BrowserFactory();
    await bf.launchBrowser(config.FC_URL);
    const loginPage = new ITAP_Login(bf.page);
    grid = new ITAP_InterviewGrid(bf.page);
    setup = new ITAP_InterviewSetup(bf.page);
    interviewerEmail = new ITAP_PreviewInterviewerEmail(bf.page);
    candidateEmail = new ITAP_PreviewCandidateEmail(bf.page);

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

    // Send the interviewer email for real - confirmed live this tab is only
    // reachable after that, it does not auto-advance any other way.
    await interviewerEmail.updateInterviewerToEmail();
    await interviewerEmail.clickSendEmailToInterviewers();
    await bf.hardWait(1);
    await interviewerEmail.confirmInterviewerEmail();
    await bf.hardWait(1);
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  // Confirmed live: sending the interviewer email does NOT auto-advance to
  // the Candidate Email tab - it stays on Interviewer. A plain click() on
  // the tab is intercepted by the tablist overlay, so this uses clickJS()
  // instead (confirmed live to work around it).
  test('INT-29 [Positive]: Preview Candidate Email tab allows editing CC and requires confirmation to send', async () => {
    await bf.hardWait(1);
    await candidateEmail.clickJS(candidateEmail.previewCandidateTab);
    await bf.hardWait(1);
    await expect(bf.page.locator(candidateEmail.candidateToField)).toBeVisible();
    // Bug fixed 2026-09-07: this override was missing entirely (only CC was
    // ever cleared) - every real send in this project's history was going
    // to the candidate's own registered address, not config.EmailId. See
    // ITAP_PreviewCandidateEmail.updateCandidateToEmail()'s own comment.
    await candidateEmail.updateCandidateToEmail();
    await candidateEmail.clearCandidateCCField();
  });

  test('FC Admin: Scroll and click Send Email to Candidates', async () => {
    await bf.hardWait(1);
    await candidateEmail.clickSendEmailToCandidates();
  });

  test('FC Admin: Confirm sending email to candidates', async () => {
    await bf.hardWait(1);
    await candidateEmail.confirmCandidateEmail();
  });

  test('FC Admin: Click OK on email success popup', async () => {
    await bf.hardWait(1);
    await candidateEmail.clickEmailSuccessOk();
  });

  test('INT-31 [Positive]: After sending both emails, user is redirected back to the Interview tab', async () => {
    await bf.hardWait(1);
    await candidateEmail.verifyInterviewTabRedirection();
  });
});
