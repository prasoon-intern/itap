const BasePage = require('../BasePage');
const config = require('../../config');

// pages/Interview/PreviewInterviewerEmail.js — the "Preview Interviewer
// Email" tab reached after Submit & Preview on the Schedule Interview form.
// Split out of the old single ITAP_InterviewSchedule class — see Setup.js,
// PreviewCandidateEmail.js, and StatusFeedback.js for the rest of that flow.
class ITAP_PreviewInterviewerEmail extends BasePage {
  constructor(page) {
    super(page);

    this.previewInterviewerTab  = ".mx-name-tabPage2";
    this.interviewerToField     = ".mx-name-textBox5 input";
    this.interviewerCCField     = ".mx-name-textBox6 input";
    this.sendEmailToInterviewersBtn = "button:has-text('Send Email to Interviewers')";
    this.confirmEmailYesBtn     = "button:has-text('Yes')";
  }

  /**
   * Update the "To" field in Preview Interviewer Email tab.
   * Clears existing value and sets it to config.EmailId.
   */
  async updateInterviewerToEmail() {
    console.log('Updating Interviewer To email field');
    await this.page.waitForTimeout(2000);
    await this.waitForVisible(this.interviewerToField);
    await this.click(this.interviewerToField);
    await this.page.waitForTimeout(500);
    // Clear existing value
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(500);
    // Fill new email
    await this.fill(this.interviewerToField, config.EmailId);
    await this.page.waitForTimeout(1000);
    return this;
  }

  /**
   * Scroll to bottom and click "Send Email to Interviewers" button.
   */
  async clickSendEmailToInterviewers() {
    console.log('Clicking Send Email to Interviewers button');
    await this.page.waitForTimeout(1000);
    await this.scrollIntoView(this.sendEmailToInterviewersBtn);
    await this.waitForVisible(this.sendEmailToInterviewersBtn);
    await this.click(this.sendEmailToInterviewersBtn);
    await this.page.waitForTimeout(1000);
    return this;
  }

  /**
   * Click "Yes" on the confirmation popup for interviewer emails.
   */
  async confirmInterviewerEmail() {
    console.log('Confirming interviewer email send');
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.confirmEmailYesBtn);
    await this.click(this.confirmEmailYesBtn);
    await this.page.waitForTimeout(2000);
    return this;
  }
}

module.exports = { ITAP_PreviewInterviewerEmail };
