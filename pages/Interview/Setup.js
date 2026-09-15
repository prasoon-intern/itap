const BasePage = require('../BasePage');
const config = require('../../config');

// pages/Interview/Setup.js — everything needed to search for a candidate,
// select them, fill out the Schedule Interview form (interviewer, date,
// time, duration), and Allocate/Submit/Confirm through to the email preview
// tabs. Split out of the old single ITAP_InterviewSchedule class (which also
// covered email preview and status/feedback — see PreviewInterviewerEmail.js,
// PreviewCandidateEmail.js, and StatusFeedback.js for those).
class ITAP_InterviewSetup extends BasePage {
  constructor(page) {
    super(page);

    // ── Search & Selection ──────────────────────────────────────────────────
    this.itapSearchField    = ".mx-name-textFilter4 input[type='text']";
    this.itapCheckbox       = ".mx-name-checkBox4 input[type='checkbox']";
    this.appointment_tab = "li[role='button']:has(span:text('Appointment'))";
    // ── Schedule Interview ──────────────────────────────────────────────────
    this.scheduleInterviewBtn   = ".mx-name-actionButton13";
    this.interviewerInput       = ".mx-name-comboBox1 .widget-combobox-input";
    this.startTimedropdown      = ".mx-name-dropDown2 select";
    this.endTimedropdown        = ".mx-name-dropDown4 select";
    this.durationDropdown       = ".mx-name-dropDown1 select";
    this.amPmDropdown1          = ".mx-name-dropDown3 select";
    this.amPmDropdown2          = ".mx-name-dropDown5 select";
    this.allocateBtn            = "[data-button-id*='actionButton8']";
    this.submitBtn              = ".mx-name-actionButton9";
    this.confirmBtn             = "button.mx-name-actionButton2:has-text('Yes'), [data-button-id*='Confirmation'][data-button-id*='actionButton2']";
    this.Interview_date         = ".mx-name-datePicker1 input[type='text']";

    // ── Overlay ─────────────────────────────────────────────────────────────
    this.overlay                = '.overlay';
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Search & Selection
  // ────────────────────────────────────────────────────────────────────────────

   async clickAppointmentTab() {

    await this.appointment_tab.scrollIntoViewIfNeeded();
    await this.waitForVisible(this.appointment_tab);
    await this.click(this.appointment_tab);
    return this;

  }


  /**
   * Search for an ITAP number and press Enter.
   * @param {string} itapNumber
   */
  async searchItapNumber(itapNumber) {
    console.log(`Searching for ITAP number: ${itapNumber} `);
    await this.waitForVisible(this.itapSearchField);
    await this.waitForPageLoad();
    await this.page.waitForTimeout(1000);
    await this.fill(this.itapSearchField, itapNumber);
    // await this.fill(this.itapSearchField,'25572');
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    return this;
  }

  /**
   * Search ITAP number from config.
   */
  async searchItapNumberFromConfig() {
    return this.searchItapNumber(config.itapNumber);
  }

  /**
   * Select the ITAP checkbox.
   */
  async selectItapCheckbox() {
    console.log('Selecting ITAP checkbox');
    await this.waitForVisible(this.itapCheckbox);
    await this.click(this.itapCheckbox);
    return this;
  }

  /**
   * Confirmed live: this checkbox's checked state can persist server-side
   * across runs (same class of issue documented elsewhere in this project) -
   * a blind click() can UNCHECK an already-checked row instead of checking
   * it, leaving "Schedule Interview" disabled and any later click on it
   * hanging until the test timeout. Checks current state first.
   */
  async ensureItapCheckboxChecked() {
    // Verify-and-retry rather than a single click - the same class of
    // Mendix click-doesn't-always-register issue documented elsewhere in
    // this project (e.g. ITAP_ReScheduleInterview's mode checkbox). A
    // silently-unchecked second candidate here was traced live 2026-08-26
    // as the cause of FCI-01 opening the Schedule Interview form with only
    // 1 row in the batch table instead of 2.
    await this.waitForVisible(this.itapCheckbox);
    const cb = this.page.locator(this.itapCheckbox);
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await cb.isChecked()) return this;
      await this.click(this.itapCheckbox);
      await this.wait(500);
    }
    throw new Error('ensureItapCheckboxChecked(): checkbox still not checked after 4 attempts.');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Schedule Interview
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Click the Schedule Interview button.
   */
  async clickScheduleInterview() {
    console.log('Clicking Schedule Interview button');
    // Confirmed live: checking the ITAP checkbox right before this can
    // trigger a re-render of the header action-button area, leaving this
    // button transiently not-visible for longer than any single fixed
    // wait reliably covers - poll for it instead of guessing a duration.
    const btn = this.page.locator(this.scheduleInterviewBtn);
    let btnReady = false;
    for (let i = 0; i < 15; i++) {
      if (await btn.isVisible().catch(() => false)) { btnReady = true; break; }
      await this.wait(1000);
    }
    if (!btnReady) throw new Error('clickScheduleInterview(): button never became visible after 15s of polling.');

    // Confirmed live (separately): a normal Playwright click on this
    // button occasionally does nothing at all (no error, no navigation),
    // even retried - a raw JS-dispatched click (bypassing Playwright's
    // actionability/animation checks entirely) is more reliable for this
    // specific button. Verify the setup form actually appeared before
    // moving on. Bounded tightly (4 short attempts) so the worst case
    // can't itself exceed a caller's test timeout.
    for (let attempt = 0; attempt < 4; attempt++) {
      await btn.evaluate((el) => el.click()).catch(() => {});
      await this.waitForOverlayToDisappear(this.overlay, 3000);
      await this.waitForPageLoad();
      const onSetupForm = await this.page.locator(this.interviewerInput).isVisible().catch(() => false);
      if (onSetupForm) return this;
      await this.wait(1000);
    }
    return this;
  }

  /**
   * Select the interviewer by name (config.interviewerName - "Aakriti" per
   * explicit user instruction). Was previously 3 blind ArrowDowns + Enter
   * with no name filter, which just picked whatever landed 3rd in the
   * unfiltered suggestion list (consistently "Aakash Tiwari", NOT what was
   * asked for) - fixed to type the name first so exactly one suggestion
   * ("Aakriti .") remains before selecting it.
   */
  async selectInterviewer(interviewerName = config.interviewerName) {
    await this.waitForVisible(this.interviewerInput);
    await this.click(this.interviewerInput);
    await this.page.waitForTimeout(500);
    await this.page.keyboard.type(interviewerName);
    await this.page.waitForTimeout(800);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);

    // Close the dropdown. Confirmed live: it does NOT auto-close after
    // selection and visually overlaps the rest of the form (including the
    // Allocate button), so a later click on Allocate would otherwise wait
    // forever for the obscured element to become clickable. The previous
    // approach - page.mouse.click(100, 100) - lands on the sidebar's "Home
    // Dashboard" link, a real navigation click that can trigger an
    // unsaved-changes confirm dialog and hang the whole run. Escape closes
    // the dropdown without navigating anywhere.
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);

    return this;
  }

  async selectInterviewDate(dateText) {
    // Was a fixed '20/04/2026' fallback - silently became a past date once
    // real time caught up to it (confirmed live), so this now defers to the
    // same dynamically-computed date config.js uses, rather than a second
    // hardcoded literal that could go stale independently.
    const date = dateText ?? config.interviewDate;
    console.log(`Selecting interview date: ${date}`);
    await this.waitForVisible(this.Interview_date);
    await this.click(this.Interview_date);
    await this.fill(this.Interview_date, date);
    await this.page.waitForTimeout(2000);
    return this;
  }



  async selectStartTime() {
   await this.waitForVisible(this.startTimedropdown );
    await this.click(this.startTimedropdown );
    await this.page.waitForTimeout(500);
    // Arrow Down + Enter to select the first suggestion (replaces Robot class)
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);

    return this;
  }

  async selectAM_PM1() {
  await this.waitForVisible(this.amPmDropdown1 );
    await this.click(this.amPmDropdown1 );
    await this.page.waitForTimeout(500);
    // Arrow Down + Enter to select the first suggestion (replaces Robot class)
    await this.page.keyboard.press('ArrowDown');

     await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);
  }


  async selectEndTime() {
      await this.waitForVisible(this.endTimedropdown );
    await this.click(this.endTimedropdown );
    await this.page.waitForTimeout(500);
    // Arrow Down + Enter to select the first suggestion (replaces Robot class)
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);

    return this;
  }

   async selectAM_PM2() {
  await this.waitForVisible(this.amPmDropdown2 );
    await this.click(this.amPmDropdown2 );
    await this.page.waitForTimeout(500);
    // Arrow Down + Enter to select the first suggestion (replaces Robot class)
    await this.page.keyboard.press('ArrowDown');

     await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);
  }


  async selectDuration() {
     await this.waitForVisible(this.durationDropdown );
    await this.click(this.durationDropdown );
    await this.page.waitForTimeout(500);
    // Arrow Down + Enter to select the first suggestion (replaces Robot class)
    await this.page.keyboard.press('ArrowDown');

     await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);

  }

  // ────────────────────────────────────────────────────────────────────────────
  // Deterministic dropdown/validation helpers (for the Schedule Interview Form
  // Validation tests). Added alongside the existing arrow-key based selectors
  // above, which pick "whatever option ArrowDown lands on" and can't guarantee
  // a specific relative ordering (e.g. "End Time before Start Time"). These
  // use BasePage.selectOption()/getAllTexts() directly against the confirmed
  // native <select> elements instead.
  // ────────────────────────────────────────────────────────────────────────────

  async getStartTimeOptions() {
    return this.getAllTexts(`${this.startTimedropdown} option`);
  }

  async getEndTimeOptions() {
    return this.getAllTexts(`${this.endTimedropdown} option`);
  }

  async getDurationOptions() {
    return this.getAllTexts(`${this.durationDropdown} option`);
  }

  async selectStartTimeByLabel(label) {
    await this.selectOption(this.startTimedropdown, { label });
  }

  async selectEndTimeByLabel(label) {
    await this.selectOption(this.endTimedropdown, { label });
  }

  async selectDurationByLabel(label) {
    await this.selectOption(this.durationDropdown, { label });
  }

  async selectAmPm1ByLabel(label) {
    await this.selectOption(this.amPmDropdown1, { label });
  }

  async selectAmPm2ByLabel(label) {
    await this.selectOption(this.amPmDropdown2, { label });
  }

  /**
   * Open the interviewer combobox and return the visible suggestion texts
   * without selecting one (leaves the field as it was).
   */
  async getInterviewerSuggestions() {
    const listSelector = "[role='listbox'] li, .widget-combobox-menu li, ul[id*='combobox'] li";
    await this.click(this.interviewerInput);
    try {
      await this.page.locator(listSelector).first().waitFor({ state: 'visible', timeout: 5000 });
    } catch (e) {
      // Confirmed live: the dropdown occasionally doesn't open on the first
      // click. One retry before giving up.
      await this.click(this.interviewerInput);
      await this.page.locator(listSelector).first().waitFor({ state: 'visible', timeout: 5000 });
    }
    const suggestions = await this.getAllTexts(listSelector);
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    return suggestions.map(s => s.trim()).filter(Boolean);
  }

  /**
   * Text of the red mandatory-fields error banner, if visible ("Please fill
   * all mandatory fields." - confirmed live). Returns null if not shown.
   */
  async getMandatoryFieldsErrorText() {
    const banner = this.page.locator("text=/Please fill all mandatory fields/i");
    if (await banner.count()) {
      return (await banner.first().textContent()).trim();
    }
    return null;
  }

  /**
   * Text of the inline past-date validation message under Start Date
   * ("Please Select Future Date" - confirmed live). Returns null if not shown.
   */
  async getDateValidationInlineText() {
    const inline = this.page.locator("text=/Please Select Future Date/i");
    if (await inline.count()) {
      return (await inline.first().textContent()).trim();
    }
    return null;
  }

  /**
   * Click Cancel on the Schedule Interview screen (returns to the grid
   * without submitting). Confirmed live: Escape does NOT close this screen,
   * since it's a full-page view rather than a modal.
   */
  async clickCancel() {
    await this.click("button:has-text('Cancel')");
    await this.waitForPageLoad();
  }

  /**
   * Click the Allocate button.
   */
  async clickAllocate() {
    console.log('Clicking Allocate button');
    await this.waitForVisible(this.allocateBtn);
    await this.click(this.allocateBtn);
    return this;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Multi-candidate batch table (Move Up/Down, delete row)
  // ────────────────────────────────────────────────────────────────────────────

  async isMoveDownEnabled() {
    return this.page.getByRole('button', { name: /Move Down/i }).isEnabled();
  }

  async isMoveUpEnabled() {
    return this.page.getByRole('button', { name: /Move Up/i }).isEnabled();
  }

  async getBatchTableRowCount() {
    return this.page.locator('div.tr[role="row"][aria-selected]').count();
  }

  /**
   * Delete a row from the batch table by its Reg ID, confirming the
   * "Do you want to delete this candidate?" popup. Confirmed live: this
   * only removes the candidate from this local scheduling batch, not from
   * the system - the candidate's own grid row is unaffected.
   */
  async deleteBatchRowByRegId(regId) {
    const row = this.page.locator(`div.tr[role="row"]:has-text("${regId}")`).first();
    await row.locator('.mx-icon-trash-can').click();
    await this.wait(1000);
    await this.page.getByRole('button', { name: 'Proceed', exact: true }).click();
    await this.wait(1000);
    return this;
  }

  /**
   * Click the Submit button.
   */
  async clickSubmit() {
    console.log('Clicking Submit button');
    await this.waitForVisible(this.submitBtn);
    await this.click(this.submitBtn);
    return this;
  }

  /**
   * Click the Confirm button.
   */
  async clickConfirm() {
    console.log('Clicking Confirm button');
    await this.page.waitForTimeout(2000);
    await this.waitForVisible(this.confirmBtn);
    await this.click(this.confirmBtn);
    return this;
  }
}

module.exports = { ITAP_InterviewSetup };
