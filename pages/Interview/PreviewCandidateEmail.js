const BasePage = require('../BasePage');
const config = require('../../config');

// pages/Interview/PreviewCandidateEmail.js — the "Preview Candidate Email"
// tab reached after sending the interviewer email. Split out of the old
// single ITAP_InterviewSchedule class — see Setup.js,
// PreviewInterviewerEmail.js, and StatusFeedback.js for the rest of that flow.
class ITAP_PreviewCandidateEmail extends BasePage {
  constructor(page) {
    super(page);

    this.previewCandidateTab    = ".mx-name-tabPage3";
    this.candidateToField       = ".mx-name-textBox2 input";
    this.candidateCCField       = ".mx-name-textBox4 input";
    this.sendEmailToCandidatesBtn   = "[data-button-id*='actionButton12']:has-text('Send Email to Candidates')";
    this.confirmEmailYesBtn     = "button:has-text('Yes')";
    this.emailSuccessOkBtn      = "button:has-text('Ok'), button:has-text('OK')";
    // Was "li[role='button']:has(span:text('Interview'))" - a sidebar-item
    // pattern that could never match, since "Interview" is one of the three
    // TABS under Appointment (Interview/Training/Onboarding), not a sidebar
    // entry. Never caught before because no earlier run had gotten this far
    // (confirmed live: blocked upstream by the stale-interview-date bug).
    this.interviewTab           = "ul.mx-tabcontainer-tabs li a:has-text('Interview')";
  }

  /**
   * Update the "To" field in Preview Candidate Email tab.
   * Clears existing value and sets it to config.EmailId.
   *
   * CONFIRMED BUG, fixed 2026-09-07: this method never existed before -
   * every call site in this project only ever called clearCandidateCCField()
   * before sending, never touching the To field at all. Since the candidate
   * signup form fills config.PersonalEmailId as the candidate's own
   * registered email, "Preview Candidate Email" almost certainly defaults
   * To to that same address, meaning every real "Send Email to Candidates"
   * action in this project's history has been delivering to a real
   * discovery.candidate18@gmail.com inbox instead of config.EmailId - the
   * exact standing policy violation flagged in
   * feedback_interview_email_destination. Mirrors
   * PreviewInterviewerEmail.js's own updateInterviewerToEmail(), which
   * never had this gap.
   */
  async updateCandidateToEmail() {
    console.log('Updating Candidate To email field');
    await this.page.waitForTimeout(2000);
    await this.waitForVisible(this.candidateToField);
    await this.click(this.candidateToField);
    await this.page.waitForTimeout(500);
    // Clear existing value
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(500);
    // Fill new email
    await this.fill(this.candidateToField, config.EmailId);
    await this.page.waitForTimeout(1000);
    return this;
  }

  /**
   * Clear the CC field in Preview Candidate Email tab.
   */
  async clearCandidateCCField() {
    console.log('Clearing Candidate CC field');
    await this.page.waitForTimeout(2000);
    await this.waitForVisible(this.candidateCCField);
    await this.click(this.candidateCCField);
    await this.page.waitForTimeout(500);
    // Clear existing value
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(500);
    return this;
  }

  /**
   * Scroll to bottom and click "Send Email to Candidates" button.
   */
  async clickSendEmailToCandidates() {
    console.log('Clicking Send Email to Candidates button');
    await this.page.waitForTimeout(1000);
    await this.scrollIntoView(this.sendEmailToCandidatesBtn);
    await this.waitForVisible(this.sendEmailToCandidatesBtn);
    await this.click(this.sendEmailToCandidatesBtn);
    await this.page.waitForTimeout(1000);
    return this;
  }

  /**
   * Click "Yes" on the confirmation popup for candidate emails.
   */
  async confirmCandidateEmail() {
    console.log('Confirming candidate email send');
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.confirmEmailYesBtn);
    await this.click(this.confirmEmailYesBtn);
    await this.page.waitForTimeout(2000);
    return this;
  }

  /**
   * Click "OK" on the success popup.
   */
  async clickEmailSuccessOk() {
    console.log('Clicking OK on email success popup');
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.emailSuccessOkBtn);
    await this.click(this.emailSuccessOkBtn);
    await this.page.waitForTimeout(2000);
    return this;
  }

  /**
   * Verify redirection to Interview tab.
   */
  async verifyInterviewTabRedirection() {
    console.log('Verifying redirection to Interview tab');
    await this.page.waitForTimeout(2000);
    await this.waitForVisible(this.interviewTab);
    const isVisible = await this.isElementVisible(this.interviewTab);
    if (isVisible) {
      console.log('✓ Successfully redirected to Interview tab');
    } else {
      throw new Error('Not redirected to Interview tab');
    }
    return this;
  }
}

module.exports = { ITAP_PreviewCandidateEmail };
