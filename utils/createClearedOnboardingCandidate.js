const BrowserFactory = require('./BrowserFactory');
const ITAP_Login = require('../pages/FCAdminLogin');
const { ITAP_InterviewSetup } = require('../pages/Interview/Setup');
const { ITAP_PreviewInterviewerEmail } = require('../pages/Interview/PreviewInterviewerEmail');
const { ITAP_PreviewCandidateEmail } = require('../pages/Interview/PreviewCandidateEmail');
const { createFreshInterviewCandidate } = require('./createFreshInterviewCandidate');
const config = require('../config');

/**
 * Creates one fresh candidate (via createFreshInterviewCandidate - signup
 * through Phase 2 submission) and drives them through FC Admin just far
 * enough to schedule an Interview and send both emails. Returns the new ITAP
 * number, now sitting in HR's Document Verification "Verification Pending"
 * queue - confirmed live (2026-09-04) that's ALL it takes to get there,
 * nothing about Interview Feedback or Final Status is required.
 *
 * Used to ALSO submit Interview Feedback and set Final Status ("Cleared")
 * before returning, on the assumption the Onboarding grid needed that. It
 * doesn't, for Document Verification's purposes - and that Feedback step was
 * a real, mostly-failing dependency anyway (the "Feedback Form" link
 * deterministically opened "Feedback - Training" instead of "Feedback -
 * Interview" for most candidates, for reasons still not fully understood,
 * blocking Final Status from ever being set since it requires Feedback
 * first). Confirmed live: a candidate scheduled+emailed but with NO Feedback
 * and NO Final Status set still reaches Verification Pending correctly, and
 * Document Verification (checkboxes, Field Coordinator, Verify) completes
 * normally on it. That candidate then does NOT yet appear in the FC Admin
 * Onboarding grid itself (Gen Offer/Appointment/Apprentice Letter) - Final
 * Status genuinely is a separate, later gate for THAT specific view - but
 * none of this project's Letter-generation tests need a fresh candidate for
 * that anyway; they all reuse existing, already-onboarded fixtures ("Demo
 * User Alpha", ITAP 250347, ITAP 250349).
 *
 * Needed by Onboarding automation for anything downstream of Document
 * Verification (which is a ONE-WAY status transition, unlike letter
 * generation - Offer/Appointment/Apprentice letters can be regenerated
 * against the same "Demo User Alpha"-style recurring dummy candidate, but a
 * candidate's document verification can only genuinely happen once).
 *
 * Opens and closes its OWN BrowserFactory session for the FC Admin part -
 * separate from whatever browser the calling test file is using, so it can
 * be called safely from a beforeAll without interfering with the caller's
 * own page/session.
 */
async function createClearedOnboardingCandidate({ middleName = 'Onboarding', lastName = 'Batch' } = {}) {
  config.MiddleName = middleName;
  config.LastName = lastName;
  const itapNumber = await createFreshInterviewCandidate();

  const bf = new BrowserFactory();
  await bf.launchBrowser(config.FC_URL);
  const login = new ITAP_Login(bf.page);
  const sched = new ITAP_InterviewSetup(bf.page);
  const interviewerEmail = new ITAP_PreviewInterviewerEmail(bf.page);
  const candidateEmail = new ITAP_PreviewCandidateEmail(bf.page);

  try {
    await login.performLogin();
    await login.navigateToAppointment();
    await sched.searchItapNumber(itapNumber);
    await bf.hardWait(1);
    await sched.selectItapCheckbox();
    await bf.hardWait(1);
    await sched.clickScheduleInterview();

    await sched.selectInterviewer();
    await sched.selectInterviewDate();
    await sched.selectStartTime();
    await sched.selectAM_PM1();
    await sched.selectEndTime();
    await sched.selectAM_PM2();
    await sched.selectDuration();
    await sched.clickAllocate();
    await sched.clickSubmit();
    await bf.hardWait(1);
    await sched.clickConfirm();
    await bf.hardWait(2);

    await interviewerEmail.updateInterviewerToEmail();
    await interviewerEmail.clickSendEmailToInterviewers();
    await interviewerEmail.confirmInterviewerEmail();
    await bf.hardWait(1);
    await candidateEmail.clickJS(candidateEmail.previewCandidateTab);
    await bf.hardWait(1);
    await candidateEmail.updateCandidateToEmail();
    await candidateEmail.clearCandidateCCField();
    await candidateEmail.clickSendEmailToCandidates();
    await candidateEmail.confirmCandidateEmail();
    await bf.hardWait(1);
    await candidateEmail.clickEmailSuccessOk();
    await bf.hardWait(2);
    // Deliberately stops here - see the header comment above for why no
    // Feedback/Final Status step follows. The candidate is already in HR's
    // Document Verification "Verification Pending" queue at this point.
  } finally {
    await bf.closeBrowser();
  }

  return { itapNumber, candidateName: `${config.FirstName} ${config.MiddleName} ${config.LastName}` };
}

module.exports = { createClearedOnboardingCandidate };
