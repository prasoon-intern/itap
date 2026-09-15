const BasePage = require('../BasePage');

// pages/Interview/StatusFeedback.js — Candidate Status popup (Next Round
// Required toggle, Final Status, remarks), the separate Final Status screen,
// and the Feedback flow (trigger + comment in the main grid dialog, plus the
// standalone "Feedback-MR" form tab itself). Split out of the old single
// ITAP_InterviewSchedule/ITAP_fillFeedbackform classes — see Setup.js,
// PreviewInterviewerEmail.js, and PreviewCandidateEmail.js for the rest of
// the scheduling flow.
class ITAP_InterviewStatusFeedback extends BasePage {
  constructor(page) {
    super(page);

    // ── Clear Interview Status ──────────────────────────────────────────────
    this.candidateStatusIcon    = ".mx-name-actionButton38";
    this.nextRoundRequiredToggle = ".mx-name-switch1 .widget-switch-btn-wrapper";
    this.remarksTextarea        = ".mx-name-textArea1 textarea";
    this.saveChangesStatusBtn   = "[data-button-id*='CandidateInterview_newedit.actionButton1']:has-text('Save Changes')";

    // ── Feedback ────────────────────────────────────────────────────────────
    this.feedbackIcon           = ".td.td-borders.align-column-left.col-center img";
    this.fillFeedbackLink       = ".mx-name-actionButton3";
    this.feedbackFormLink       = "a:has-text('Feedback Form'), span:has-text('Feedback Form')";
    this.feedbackCommentField   = ".mx-name-textBox13 input";

    // ── Final Status ────────────────────────────────────────────────────────
    this.finalStatusIcon        = "a[role='button'] img";
    this.nextRoundToggle        = ".widget-switch-btn.right";
    this.finalStatusDropdown    = ".mx-name-dropDown1 select";
    this.saveChangesBtn         = "button:has-text('Save Changes')";
    this.finalPopupBtn          = "button.btn.btn-primary";

    // ── Back Button ─────────────────────────────────────────────────────────
    // Was two comma-separated alternatives that both matched (the button AND
    // its own inner icon span) - confirmed live as a strict-mode violation
    // ("resolved to 2 elements"). A plain button[title='Back'] is enough.
    this.backBtn                = "button[title='Back']";
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Clear Interview Status Workflow
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Click the status icon (Edit icon) next to checkbox to open Candidate Status popup.
   */
  async clickCandidateStatusIcon() {
    console.log('Clicking Candidate Status icon');
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.candidateStatusIcon);
    await this.click(this.candidateStatusIcon);
    await this.page.waitForTimeout(2000);
    return this;
  }

  /**
   * Toggle Next Round Required switch.
   * @param {boolean} enable - true to enable, false to disable
   */
  async toggleNextRoundRequired(enable = false) {
    console.log(`Toggling Next Round Required to: ${enable ? 'ON' : 'OFF'}`);
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.nextRoundRequiredToggle);

    // Check current state
    const toggleElement = await this.page.locator(this.nextRoundRequiredToggle);
    const ariaChecked = await toggleElement.getAttribute('aria-checked');
    const currentState = ariaChecked === 'true';

    // Click only if state needs to change
    if (currentState !== enable) {
      await this.click(this.nextRoundRequiredToggle);
      await this.page.waitForTimeout(1000);
      console.log(`✓ Toggled from ${currentState ? 'ON' : 'OFF'} to ${enable ? 'ON' : 'OFF'}`);
    } else {
      console.log(`Already ${enable ? 'ON' : 'OFF'} - no action needed`);
    }
    return this;
  }

  /**
   * Select Final Status from dropdown.
   * @param {string} status - "Cleared", "Rejected", or "On_Hold"
   */
  async selectCandidateFinalStatus(status) {
    console.log(`Selecting Final Status: ${status}`);
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.finalStatusDropdown);
    await this.selectOption(this.finalStatusDropdown, status);
    await this.page.waitForTimeout(1000);
    return this;
  }

  /**
   * Enter remarks in the remarks textarea.
   * @param {string} remarks - Remarks text (max 200 characters)
   */
  async enterStatusRemarks(remarks) {
    console.log(`Entering remarks: ${remarks}`);
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.remarksTextarea);
    await this.click(this.remarksTextarea);
    await this.fill(this.remarksTextarea, remarks);
    await this.page.waitForTimeout(500);
    return this;
  }

  /**
   * Click Save Changes button in Candidate Status popup.
   */
  async clickSaveStatusChanges() {
    console.log('Clicking Save Changes button');
    await this.page.waitForTimeout(1000);
    await this.waitForVisible(this.saveChangesStatusBtn);
    await this.click(this.saveChangesStatusBtn);
    await this.page.waitForTimeout(2000);
    return this;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Navigation
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Click the Back button using JS click (mirrors Java clickBackButton).
   */
  async clickBack() {
    console.log('Clicking back button');
    await this.waitForVisible(this.backBtn);
    await this.clickJS(this.backBtn);
    await this.waitForPageLoad();
    return this;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Feedback
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Click the feedback icon in the table row.
   */
  async clickFeedback() {
    console.log('Clicking feedback icon');
    await this.waitForVisible(this.feedbackIcon);
    await this.click(this.feedbackIcon);
    return this;
  }

  /**
   * Click the Fill Feedback link.
   */
  async clickFillFeedback() {
    console.log('Clicking fill feedback link');
    await this.waitForVisible(this.fillFeedbackLink);
    await this.click(this.fillFeedbackLink);
    return this;
  }

  /**
   * Click the "Feedback Form" link (opens the feedback form, typically in a new tab).
   */
  async clickFeedbackForm() {
    console.log('Clicking Feedback Form link');
    await this.waitForVisible(this.feedbackFormLink);
    await this.click(this.feedbackFormLink);
    return this;
  }

  /**
   * Fill the feedback form using keyboard navigation.
   * Replaces the Robot class key simulation from the Java version.
   */
  async fillFeedbackForm() {
    console.log('Filling feedback form via keyboard navigation');
    const kb = this.page.keyboard;

    // Navigate to "Filled By" dropdown via TAB (2 tabs)
    await kb.press('Tab');
    await this.page.waitForTimeout(2000);
    await kb.press('Tab');
    await this.page.waitForTimeout(2000);

    // Select option via Arrow Down (x2) + Enter
    await kb.press('ArrowDown');
    await this.page.waitForTimeout(2000);
    await kb.press('ArrowDown');
    await this.page.waitForTimeout(2000);
    await kb.press('Enter');
    await this.page.waitForTimeout(2000);
    await kb.press('Enter');
    await this.page.waitForTimeout(2000);

    // Tab to Feedback Status field (3 tabs)
    await kb.press('Tab');
    await this.page.waitForTimeout(2000);
    await kb.press('Tab');
    await this.page.waitForTimeout(2000);
    await kb.press('Tab');
    await this.page.waitForTimeout(2000);

    // Select feedback status
    await kb.press('ArrowDown');
    await this.page.waitForTimeout(2000);

    // Tab to Remarks field and type
    await kb.press('Tab');
    await this.page.waitForTimeout(2000);
    await kb.press('a');

    // Tab to Submit and click Enter
    await kb.press('Tab');
    await this.page.waitForTimeout(2000);
    await kb.press('Enter');
    await this.page.waitForTimeout(3000);

    // Confirm popup
    await kb.press('Enter');
    await this.page.waitForTimeout(2000);

    return this;
  }

  /**
   * Add a comment to the feedback comment field.
   * @param {string} comment
   */
  async addFeedbackComment(comment) {
    console.log('Adding feedback comment');
    await this.waitForVisible(this.feedbackCommentField);
    await this.click(this.feedbackCommentField);
    await this.fill(this.feedbackCommentField, comment);
    return this;
  }

  /**
   * Close the current popup/window and switch back to main page.
   * In Playwright, new windows are handled as new Page objects in the context.
   */
  async closeCurrentWindowAndSwitchBack() {
    console.log('Closing current window and switching back');
    const context = this.page.context();
    const pages = context.pages();
    const mainPage = pages[0];

    // Confirmed live: more than one extra page can be open at this point
    // (e.g. a feedback-form tab that got closed and re-opened earlier in
    // the same flow) - the old "close the first non-main page, then break"
    // only ever closed one, silently leaving others open. Close all of them.
    for (const pg of pages) {
      if (pg !== mainPage) {
        await pg.close();
      }
    }

    await mainPage.bringToFront();
    this.page = mainPage;
    return this;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Final Status
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Click the final status icon.
   */
  async clickFinalStatus() {
    console.log('Clicking final status icon');
    await this.waitForVisible(this.finalStatusIcon);
    await this.click(this.finalStatusIcon);
    return this;
  }

  /**
   * Toggle the next-round switch.
   */
  async toggleNextRound() {
    console.log('Toggling next round');
    await this.waitForVisible(this.nextRoundToggle);
    await this.click(this.nextRoundToggle);
    return this;
  }

  /**
   * Click the final status dropdown.
   */
  async clickFinalStatusDropdown() {
    console.log('Clicking final status dropdown');
    await this.waitForVisible(this.finalStatusDropdown);
    await this.click(this.finalStatusDropdown);
    return this;
  }

  /**
   * Select a reason via Arrow Down key (replaces Robot class in Selectreason()).
   */
  async selectReason() {
    console.log('Selecting reason via arrow key');
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(2000);
    return this;
  }

  /**
   * Click Save Changes.
   */
  async saveChanges() {
    console.log('Saving changes');
    await this.waitForVisible(this.saveChangesBtn);
    await this.click(this.saveChangesBtn);
    return this;
  }

  /**
   * Confirm the final popup by pressing Enter (replaces Robot class).
   */
  async confirmFinalPopup() {
    console.log('Confirming final popup');
    await this.page.waitForTimeout(2000);
    await this.page.keyboard.press('Enter');
    return this;
  }
}

/**
 * ITAP_fillFeedbackform
 * Fills the separate-tab "Feedback-MR" form:
 * - "Feedback Filled By" (combobox, must be set first - Status/Remarks stay
 *   disabled until it is).
 * - Status (<select>, first real option if none requested).
 * - Remarks (required <textarea>) - the first enabled textarea in the pane.
 * - Several evaluation rows, each with a Score (out of 10) input and an
 *   Observation textarea - addressed generically as "every enabled text
 *   input" / "every enabled textarea after Remarks", since the exact row
 *   set (Communication Skills, Technical Knowledge, ... plus a "Common"
 *   section with Overall Score/Knowledge About Mankind/Package/etc.) can
 *   vary. This also happens to fill the read-only-looking Qualification/
 *   Total Experience boxes with the same score value if they're not
 *   actually disabled for a given candidate - confirmed live as harmless
 *   (cosmetic only, on our own disposable test candidate's feedback record).
 * - "Submit Feedback" is the only submit action - there is no separate
 *   "Save".
 */
class ITAP_fillFeedbackform extends BasePage {
  constructor(page) {
    super(page);

    this.activePane = '.tab-pane.mx-tabcontainer-pane.active';
    this.feedbackFilledByCombo = `${this.activePane} .widget-combobox`;
    this.statusDropdown = `${this.activePane} select:not([disabled])`;
    this.enabledTextareas = `${this.activePane} textarea:not([disabled])`;
    this.enabledTextInputs = `${this.activePane} input[type="text"]:not([disabled])`;
    this.submitFeedbackBtn = `${this.activePane} button:has-text('Submit Feedback')`;
    this.comboSuggestionList = "[role='listbox'], .widget-combobox-menu, ul[id*='combobox']";
  }

  /**
   * Select the first suggestion in the "Feedback Filled By" combobox. Status
   * and Remarks are disabled until this is set.
   */
  async selectFeedbackFilledBy() {
    // Confirmed live: a single ArrowDown+Enter occasionally doesn't commit
    // a selection (the combobox stays blank, later surfacing as "Please
    // provide Submitted By email" only when Submit Feedback is clicked) -
    // verify the input actually shows a value, retry otherwise.
    await this.waitForVisible(this.feedbackFilledByCombo);
    const combo = this.page.locator(this.feedbackFilledByCombo).first();
    const inputField = combo.locator('input').first();
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = (await inputField.inputValue().catch(() => '')).trim();
      if (current) return this;
      await combo.click();
      await this.wait(800);
      await this.page.keyboard.press('ArrowDown');
      await this.wait(500);
      await this.page.keyboard.press('Enter');
      await this.wait(1500);
    }
    const finalValue = (await inputField.inputValue().catch(() => '')).trim();
    if (!finalValue) {
      throw new Error('selectFeedbackFilledBy(): combobox still blank after retries.');
    }
    return this;
  }

  /**
   * Select a Status option (defaults to the first real option if the
   * requested label isn't found). Only call after selectFeedbackFilledBy().
   */
  async selectStatus(label) {
    const dropdown = this.page.locator(this.statusDropdown).first();
    await dropdown.waitFor({ state: 'visible' });
    const options = (await dropdown.locator('option').allTextContents()).map(o => o.trim()).filter(Boolean);
    const target = label && options.includes(label) ? label : options[0];
    await dropdown.selectOption({ label: target });
    return this;
  }

  /**
   * Fill Remarks - the first enabled textarea in the active pane (it sits
   * above the evaluation table in on-screen/DOM order).
   */
  async fillRemarks(text) {
    const remarks = this.page.locator(this.enabledTextareas).first();
    await remarks.waitFor({ state: 'visible' });
    await remarks.fill(text);
    return this;
  }

  /**
   * Fill every enabled score input and every observation textarea after
   * Remarks (index 0) with the same value - adequate for automation
   * purposes.
   */
  async fillAllEvaluationRows(score = '8', observation = 'Good performance - Auto Test') {
    const scoreInputs = this.page.locator(this.enabledTextInputs);
    const scoreCount = await scoreInputs.count();
    for (let i = 0; i < scoreCount; i++) {
      await scoreInputs.nth(i).fill(String(score));
    }

    const textareas = this.page.locator(this.enabledTextareas);
    const textareaCount = await textareas.count();
    for (let i = 1; i < textareaCount; i++) {
      await textareas.nth(i).fill(observation);
    }
    return this;
  }

  async clickSubmitFeedback() {
    await this.waitForVisible(this.submitFeedbackBtn);
    await this.click(this.submitFeedbackBtn);
    await this.wait(2000);
    return this;
  }

  /**
   * Dismiss the "Feedback Submitted Successfully." confirmation popup.
   */
  async dismissSuccessPopup() {
    const okBtn = this.page.locator("button:has-text('OK'), button:has-text('Ok')");
    if (await okBtn.count()) {
      await okBtn.first().click();
      await this.wait(1000);
    }
    return this;
  }

  /**
   * Full fill + submit in the correct dependency order (Feedback Filled By
   * before Status/Remarks, since those are disabled until it's set).
   */
  async fillAndSubmit({ status, remarks = 'Candidate performed well - Auto Test', score = '8', observation = 'Good performance - Auto Test' } = {}) {
    await this.selectFeedbackFilledBy();
    await this.selectStatus(status);
    await this.fillRemarks(remarks);
    await this.fillAllEvaluationRows(score, observation);
    await this.clickSubmitFeedback();
    await this.dismissSuccessPopup();
    return this;
  }
}

module.exports = { ITAP_InterviewStatusFeedback, ITAP_fillFeedbackform };
