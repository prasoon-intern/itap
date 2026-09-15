const path = require('path');
const BrowserFactory = require('./BrowserFactory');
const { ITAP_LoginPage } = require('../pages/Candidate/SignUpSignIn');
const {
  ITAPInterviewPerformaPage,
  ITAP_QualificationDetailsPage,
  ITAP_ExperienceDetailPage,
} = require('../pages/Candidate/Phase1');
const { ITAP_ContinueToPhase2Page } = require('../pages/Candidate/Phase2');
const { getNextTestCandidateName } = require('./DailyCandidateNaming');
const { getRandomAadhar } = require('./CandidateFlowHelpers');
const ctx = require('./Globals');
const config = require('../config');

// Speed optimization (2026-08-26): candidate creation was dominated by fixed
// bf.hardWait(N) delays between steps (~137s of the ~175s total per
// candidate) - these were copied from candidateform.spec.js, which was
// written as ~50 separate Playwright test() steps each with its own
// reporting/boundary overhead, and used generous margins accordingly.
// Halved here after live verification held up (still 100% reliable) - cuts
// per-candidate creation time roughly in half, which matters a lot now that
// several Interview test files each create their own candidate in
// beforeAll. WAIT_SCALE make it a single tunable knob rather than 40+
// scattered literals, in case a future run reveals this was too aggressive
// for a particular step and needs dialing back.
const WAIT_SCALE = 0.5;
function wait(bf, seconds) {
  return bf.hardWait(seconds * WAIT_SCALE);
}
// Same scale factor for the 3 page-object methods that take a wait
// CALLBACK (select_StateDistrict, fill_Experienced, dependantDetails) -
// these live in shared page objects also used by candidateform.spec.js
// directly, so they aren't touched; passing a scaled wrapper here instead
// of bf.hardWait.bind(bf) gets the same speedup without changing shared code.
function scaledHardWait(bf) {
  return (seconds) => bf.hardWait(seconds * WAIT_SCALE);
}

/**
 * Creates one fresh Interview-batch candidate end-to-end (signup through
 * Phase 2 submission) and sets ctx.itapNumber, so an Interview module test
 * file can get its own guaranteed-fresh candidate directly in its own
 * beforeAll, without depending on cross-spec-file execution order or a
 * shared prereq injection (the "Run All" limitation this replaces - see
 * project memory).
 *
 * Mirrors tests/AutoAssignFreshCandidateName.spec.js + tests/candidateform.spec.js
 * exactly, but only the fixed branch actually used for Interview-batch
 * candidates (signup, address=same, vehicle=yes, interviewDate=no,
 * additionalQualification=yes, experience=yes, hq=flexible - matching
 * flowConfig.json's committed values). Runs on its own CANDIDATE_URL
 * browser session, separate from and closed before the caller's own FC
 * Admin browser session.
 */
async function createFreshInterviewCandidate() {
  const name = getNextTestCandidateName();
  config.FirstName = name;
  config.MiddleName = 'Interview';
  config.LastName = 'Batch';

  // No longer round-trips through flowConfig.json - that was only ever
  // needed so a SEPARATE process (candidateform.spec.js) could read the
  // Aadhaar back later. This function uses it directly in-memory, so the
  // file read+write was vestigial (and would have been a real race-
  // condition risk if candidate creations were ever parallelized).
  const aadharNum = getRandomAadhar();

  console.log(`[createFreshInterviewCandidate] Creating: ${name} Interview Batch, Aadhaar ${aadharNum}`);

  const bf = new BrowserFactory();
  await bf.launchBrowser(config.CANDIDATE_URL || config.url);

  const lp = new ITAP_LoginPage(bf.page);
  const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
  const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
  const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
  const itap_Phase2Page = new ITAP_ContinueToPhase2Page(bf.page);
  const filesDir = path.join(__dirname, '..', 'upload-files');

  try {
    // -- Signup --
    await lp.scrollToFirst();
    await wait(bf, 2);
    await lp.clickOn_createNewOne();
    await wait(bf, 2);
    await lp.enterAadhaarNumber(aadharNum);
    await wait(bf, 2);
    await lp.enter_emailId(bf.getPropertyValue('PersonalEmailId'));
    await wait(bf, 2);
    await lp.enter_newPassword(bf.getPropertyValue('NewPassword'));
    await wait(bf, 2);
    await lp.enter_confirmPassword(bf.getPropertyValue('ConfirmPassword'));
    await wait(bf, 2);
    await lp.enter_managerRefID(bf.getPropertyValue('ManagerRefID'));
    await wait(bf, 2);
    await lp.clickOn_checkBox1();
    await wait(bf, 2);
    await lp.clickOn_SignUp();
    await wait(bf, 2);
    await lp.validateHomePageTitle();
    console.log('[createFreshInterviewCandidate] Checkpoint: Signup complete.');

    // -- Phase 1: Personal Details --
    await itapPage1.enter_FirstName(bf.getPropertyValue('FirstName'));
    await itapPage1.enter_MiddleName(bf.getPropertyValue('MiddleName'));
    await itapPage1.enter_LastName(bf.getPropertyValue('LastName'));
    await wait(bf, 4);
    await itapPage1.select_Role(bf.getPropertyValue('Role'));
    await itapPage1.select_HQ(bf.getPropertyValue('HQPreference'));
    await wait(bf, 4);
    await itapPage1.select_HQFlexible(); // hq: flexible
    await wait(bf, 4);
    await itapPage1.fill_ContactDetails();
    await wait(bf, 4);
    await itapPage1.select_Gender();
    await wait(bf, 5);
    await itapPage1.fill_PersonalDetails();
    await wait(bf, 5);
    await itapPage1.fill_ParentDetails();
    await wait(bf, 5);
    await itapPage1.fill_Address();
    await wait(bf, 5);
    await itapPage1.select_StateDistrict(scaledHardWait(bf));
    await wait(bf, 4);
    await itapPage1.click_PerAddRadioBtn(); // address: same
    await wait(bf, 3);
    await itapPage1.select_vehicleNum_yes(); // vehicleNumber: yes
    await wait(bf, 3);
    await itapPage1.select_No_InterviewDate(); // interviewDate: no
    await wait(bf, 3);
    await itapPage1.click_NextBtn();
    await wait(bf, 3);
    console.log('[createFreshInterviewCandidate] Checkpoint: Phase 1 (Personal Details) complete.');

    // -- Qualification details --
    await itapPage2.fill_XthDetails();
    await wait(bf, 2);
    await itapPage2.fill_XIIthDetails();
    await wait(bf, 2);
    await itapPage2.fill_graduationDetails();
    await wait(bf, 2);
    await itapPage2.fill_additionalQualificationDetails(); // additionalQualification: yes
    await wait(bf, 2);
    await itapPage2.click_NextBtn();
    await wait(bf, 2);
    console.log('[createFreshInterviewCandidate] Checkpoint: Qualification Details complete.');

    // -- Experience details (experience: yes) --
    await wait(bf, 2);
    await itapPage3.fill_Experienced(scaledHardWait(bf));
    await wait(bf, 4);
    console.log('[createFreshInterviewCandidate] Checkpoint: Experience Details complete.');

    // -- ITAP number generation --
    ctx.itapNumber = await itap_Phase2Page.Extract_itap_number();
    console.log('[createFreshInterviewCandidate] Itap number generated:', ctx.itapNumber);
    await wait(bf, 2);
    await itap_Phase2Page.click_continueToPhase2Btn();
    await wait(bf, 2);

    // -- Phase 2 --
    await itap_Phase2Page.otherDetails();
    await wait(bf, 2);
    await itap_Phase2Page.dependantDetails(scaledHardWait(bf));
    await wait(bf, 2);
    await itap_Phase2Page.uanDetails();
    await wait(bf, 2);
    await itap_Phase2Page.pfmemeber_toggle();
    await wait(bf, 2);
    await itap_Phase2Page.emergencyContact();
    await wait(bf, 2);
    await itap_Phase2Page.clickNextBtn();
    await wait(bf, 2);
    console.log('[createFreshInterviewCandidate] Checkpoint: Phase 2 (Other/Dependant/UAN/Emergency Details) complete.');

    // -- Phase 2: Documents Upload (experience: yes -> 13 files) --
    const uploads = [
      ['Aadhar.jpg', 1], ['Pancard.jpg', 2], ['samplepic.jpg', 3], ['cheque.jpg', 4],
      ['uan.jpg', 5], ['10.jpg', 6], ['12.jpg', 7], ['bsc.jpg', 8],
      ['experience.jpg', 9], ['Aadhar.jpg', 10], ['samplepic.jpg', 11], ['Aadhar.jpg', 12], ['samplepic.jpg', 13],
    ];
    for (const [file, index] of uploads) {
      const input = bf.page.locator(`(//input[@type='file'])[${index}]`);
      await input.setInputFiles(path.join(filesDir, file));
      await wait(bf, 2);
    }

    const checkBox = bf.page.locator("//*[contains(@id,'CandidatePhase2_UploadDocument.checkBox1')]");
    await checkBox.scrollIntoViewIfNeeded();
    await wait(bf, 1);
    await checkBox.check();
    await wait(bf, 2);

    const submitClick = bf.page.locator("//*[contains(@data-button-id,'CandidatePhase2_UploadDocument.actionButton13')]");
    await submitClick.click();
    await wait(bf, 2);

    const yesButton = bf.page
      .locator("div[role='dialog']")
      .filter({ has: bf.page.getByRole('heading', { name: 'Confirmation' }) })
      .getByRole('button', { name: 'Yes' });
    await yesButton.click();
    await wait(bf, 4);

    const successDialog = bf.page
      .locator("div[role='dialog']")
      .filter({ has: bf.page.getByRole('heading', { name: 'Application Submitted' }) });
    const closeDialogButton = successDialog.locator("button:has-text('Close')").last();
    await closeDialogButton.waitFor({ state: 'visible' });
    await closeDialogButton.click({ force: true });
    await wait(bf, 4);

    console.log(`[createFreshInterviewCandidate] Done: ${name} Interview Batch, ITAP ${ctx.itapNumber}`);
  } finally {
    await bf.closeBrowser();
  }

  return ctx.itapNumber;
}

module.exports = { createFreshInterviewCandidate };
