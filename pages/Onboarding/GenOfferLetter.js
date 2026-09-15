const BasePage = require('../BasePage');

/**
 * ITAP_GenerateOfferLetter
 * Page object for the Onboarding grid's "Gen Offer Letter" flow: the 3-tab
 * Generate Offer Letter page (Letter Details / Preview Letter / Preview
 * Candidate Email). Every method here mirrors exactly what was confirmed
 * live this project (see project_onboarding_module_automation.md memory) -
 * including the real quirks (Vacant Position ID reselect-to-cascade,
 * salary-reset-on-Designation-change, stacked validation dialogs).
 *
 * Shared 1:1 with "Gen Appointment Letter" - both open the same 3-tab
 * Generate Letter page pattern in Mendix, and every field here is located
 * by its visible label text rather than page-specific widget ids, so this
 * same class works unchanged against either page. See
 * pages/Onboarding/GenAppointmentLetter.js, which re-exports this class
 * rather than duplicating it.
 */
class ITAP_GenerateOfferLetter extends BasePage {
  constructor(page) {
    super(page);

    this.pageTitleHeader = 'h1.mx-title.mx-name-pageTitle1';
    this.letterTabs = 'ul.mx-tabcontainer-tabs li a';
    this.letterTabListItems = 'ul.mx-tabcontainer-tabs li';

    this.calculateSalaryBtn = "button:has-text('Calculate Salary')";
    this.calculateSalaryInlineError = '.mx-name-container30 span';
    this.totalCtcValues = '.mx-name-text2, .mx-name-text3';
    this.submitAndPreviewBtn = "button:has-text('Submit and Preview')";
    this.letterDetailsCancelBtn = "button:has-text('Cancel')";
    this.viewCandidateEmailBtn = "button:has-text('View Candidate Email')";
    this.sendToCandidateBtn = "button:has-text('Send To Candidate')";
    this.previewLetterRows = ".CustomOnboardingGrid2 .tr[role='row']:not(:first-child)";
    this.dialog = "[role='dialog'], .modal";
    this.dialogOkBtn = "[role='dialog'] button:has-text('OK'), .modal button:has-text('OK')";
  }

  // ── Field/combobox lookup helpers ───────────────────────────────────────
  // Fields are located by their visible label text, not Mendix's
  // auto-generated widget class suffixes - confirmed live this project that
  // those numeric ids are session-specific and unreliable to hardcode.
  comboByLabel(labelText) {
    const label = this.page.locator('label.control-label', { hasText: labelText });
    const container = label.locator('xpath=..');
    return { container, input: container.locator('input.widget-combobox-input') };
  }

  textInputByLabel(labelText) {
    const label = this.page.locator('label.control-label', { hasText: labelText });
    return label.locator('xpath=..').locator('input[type="text"]');
  }

  switchByLabel(labelText) {
    const label = this.page.locator('label.control-label', { hasText: labelText });
    return label.locator('xpath=..').locator(".widget-switch-btn-wrapper");
  }

  salaryRow(categoryLabel) {
    return this.page.locator('.mx-name-layoutGrid5', { hasText: categoryLabel }).first();
  }

  // ── Page identity ────────────────────────────────────────────────────────
  async getPageTitleText() {
    return (await this.getText(this.pageTitleHeader)).trim();
  }

  async getActiveSubTabText(attempts = 10, delayMs = 300) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const items = this.page.locator(this.letterTabListItems);
      const total = await items.count();
      for (let i = 0; i < total; i++) {
        const item = items.nth(i);
        const cls = (await item.getAttribute('class')) || '';
        if (cls.split(/\s+/).includes('active')) {
          return (await item.locator('a').first().textContent()).replace(/clickable|non-clickable/g, '').trim();
        }
      }
      await this.wait(delayMs);
    }
    return null;
  }

  // ── Letter Details tab: read-only/disabled fields ──────────────────────
  async getCandidateFieldValue() {
    return this.textInputByLabel('Candidate Name').inputValue();
  }

  async getDivisionFieldValue() {
    return this.textInputByLabel('Division').inputValue();
  }

  async isFieldDisabled(labelText) {
    return this.textInputByLabel(labelText).isDisabled();
  }

  async isComboDisabled(labelText) {
    const { input } = this.comboByLabel(labelText);
    return input.isDisabled();
  }

  // ── Vacant Position ID -> Designation cascade ──────────────────────────
  // Confirmed live this project (across several runs) that this cascade is
  // genuinely flaky, not a fixed one-time quirk: reselecting Vacant Position
  // ID sometimes populates Designation, sometimes clears it back to 0, in
  // no consistent pattern between otherwise-identical attempts. Same class
  // of "Mendix click/toggle sometimes silently doesn't register" issue
  // already documented repeatedly elsewhere in this project (see
  // ITAP_InterviewSchedule's toggleNextRoundRequired/ensureItapCheckboxChecked)
  // - verify-and-retry rather than trusting a single attempt.
  async reselectVacantPositionId(attempts = 4) {
    const { input } = this.comboByLabel('Vacant Position ID *');
    let picked = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      await input.click();
      await this.wait(600);
      const options = await this.getAllTexts("ul[role='listbox'] li, .widget-combobox-menu li");
      const trimmed = options.map(o => o.trim()).filter(Boolean);
      if (!trimmed.length) {
        await this.page.keyboard.press('Escape');
        return null;
      }
      picked = trimmed[0];
      await input.fill(picked);
      await this.wait(700);
      await this.page.locator("ul[role='listbox'] li, .widget-combobox-menu li", { hasText: picked }).first().click();
      await this.wait(1200);

      const designationOptions = await this.getDesignationOptions();
      if (designationOptions.length > 0) return picked;
      await this.wait(500);
    }
    return picked; // Return whatever was picked even if the cascade never populated - caller checks getDesignationOptions() itself.
  }

  async getDesignationOptions() {
    const { input } = this.comboByLabel('Designation *');
    await input.click();
    await this.wait(600);
    const options = await this.getAllTexts("ul[role='listbox'] li, .widget-combobox-menu li");
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    return options.map(o => o.trim()).filter(Boolean);
  }

  async selectDesignation(optionText) {
    const { input } = this.comboByLabel('Designation *');
    await input.click();
    await input.fill(optionText);
    await this.wait(800);
    const option = this.page.locator("ul[role='listbox'] li, .widget-combobox-menu li", { hasText: optionText }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await this.wait(500);
  }

  // ── Salary fields ────────────────────────────────────────────────────────
  // Confirmed live: picking a new Designation resets ALL 6 editable salary
  // category fields to blank - callers must refill every one, not just the
  // one they care about, or Calculate Salary fails on an unrelated field.
  async fillSalaryField(categoryLabel, value) {
    const row = this.salaryRow(categoryLabel);
    const input = row.locator("input[type='text']").first();
    await input.click();
    await input.fill(String(value));
    await this.page.keyboard.press('Tab');
  }

  async fillAllEditableSalaryFields(values = {
    'Gross Total': '27800', 'Basic': '15050', 'Base Pay': '6450',
    'IMGI': '3000', 'Bonus (Annual)': '700', 'Leave Travel Allowance': '275',
  }) {
    for (const [category, value] of Object.entries(values)) {
      await this.fillSalaryField(category, value);
    }
  }

  async setDateOfJoining(ddmmyyyy) {
    const input = this.textInputByLabel('Date Of Joining');
    await input.fill(ddmmyyyy);
    await this.page.keyboard.press('Tab');
  }

  async getDateOfJoiningValue() {
    return this.textInputByLabel('Date Of Joining').inputValue();
  }

  async clickCalculateSalary() {
    await this.click(this.calculateSalaryBtn);
    await this.wait(1500);
  }

  async getCalculateSalaryInlineError() {
    return (await this.getText(this.calculateSalaryInlineError).catch(() => '')).trim();
  }

  async getTotalCtcValues() {
    return this.getAllTexts(this.totalCtcValues);
  }

  async getToggleState(labelText) {
    const toggle = this.switchByLabel(labelText);
    return (await toggle.getAttribute('aria-checked')) === 'true';
  }

  // ── Dialog handling ───────────────────────────────────────────────────────
  // Confirmed live: Submit and Preview can show STACKED dialogs in sequence
  // (e.g. "Salary details not found" then "Please complete salary
  // calculations...") - a single OK click is not enough.
  async dismissDialogs(max = 5) {
    const texts = [];
    for (let i = 0; i < max; i++) {
      const okBtn = this.page.locator(this.dialogOkBtn).first();
      if (!(await okBtn.count().catch(() => 0))) break;
      if (!(await okBtn.isVisible().catch(() => false))) break;
      texts.push((await this.getText(this.dialog).catch(() => '')).replace(/\s+/g, ' ').trim());
      await okBtn.click({ timeout: 5000 }).catch(() => {});
      await this.wait(700);
    }
    return texts;
  }

  // A successful Submit and Preview / Send To Candidate can show a
  // self-dismissing green TOAST ("...generated successfully." /
  // "...Sent Successfully") INSTEAD OF a modal "Information" dialog with an
  // OK button - confirmed live this project that which UI element appears
  // is inconsistent between otherwise-identical attempts (sometimes modal,
  // sometimes toast, for the exact same outcome). dismissDialogs() alone
  // only catches the modal case. Polls briefly for the toast since it can
  // fade before a slow caller checks.
  async getOutcome(textPattern, timeoutMs = 4000) {
    const dialogTexts = await this.dismissDialogs();
    if (dialogTexts.length) return dialogTexts.join(' ');

    // IMPORTANT: textContent() on a Locator auto-waits internally (default
    // ~30s) when no element currently matches - passing an explicit short
    // per-call timeout is what actually makes this a poll loop. Without it,
    // a single iteration can block for the full Playwright default even
    // though the outer deadline says 4s, confirmed live as a real 60s+ test
    // timeout/hang.
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const toastText = await this.page.locator(`text=${textPattern}`).first()
        .textContent({ timeout: 300 })
        .catch(() => null);
      if (toastText) return toastText.trim();
      await this.wait(200);
    }
    return '';
  }

  async getOutcomeAfterSubmit(timeoutMs = 4000) {
    return this.getOutcome(/generated successfully/i, timeoutMs);
  }

  async getOutcomeAfterSend(timeoutMs = 4000) {
    return this.getOutcome(/sent successfully/i, timeoutMs);
  }

  // ── Submit / navigation ──────────────────────────────────────────────────
  async clickSubmitAndPreview() {
    // Bounded explicitly (rather than Playwright's ~30s actionability
    // default) - confirmed live this project that clicking this while the
    // last Calculate Salary attempt is still showing its inline error can
    // just silently no-op (no dialog, no navigation) rather than hang, so a
    // caller should fail fast and check the resulting state itself instead
    // of trusting this call to always produce visible feedback.
    await this.page.locator(this.submitAndPreviewBtn).click({ timeout: 10000 }).catch(() => {});
    await this.wait(1000);
  }

  async clickCancelLetterDetails() {
    await this.click(this.letterDetailsCancelBtn);
    await this.wait(1500);
  }

  async getPreviewLetterRowTexts() {
    return this.getAllTexts(this.previewLetterRows);
  }

  async clickViewCandidateEmail() {
    await this.click(this.viewCandidateEmailBtn);
    await this.wait(1500);
  }

  // ── Preview Candidate Email tab ──────────────────────────────────────────
  // Confirmed live: Offer/Appointment/Apprentice Letter are separate Mendix
  // pages, each with their OWN auto-generated layoutGrid numbers for the
  // To/CC/BCC/Subject rows (e.g. Offer Letter used layoutGrid9/10/11/16,
  // Appointment Letter used layoutGrid13/14/15/17) - hardcoding either set
  // silently breaks on the other page. Locates by the visible label text
  // itself instead, which is stable across all three letter types.
  emailFieldRow(label) {
    const labelSpan = this.page.locator('span.text-detail.text-semibold', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();
    return labelSpan.locator('xpath=ancestor::div[contains(@class, "mx-layoutgrid")][1]');
  }

  async getEmailFieldValue(label) {
    return this.emailFieldRow(label).locator('input[type="text"]').first().inputValue();
  }

  async isEmailFieldDisabled(label) {
    return this.emailFieldRow(label).locator('input[type="text"]').first().isDisabled();
  }

  async setEmailFieldValue(label, value) {
    const input = this.emailFieldRow(label).locator('input[type="text"]').first();
    await input.click();
    await input.fill(value);
    await this.page.keyboard.press('Tab');
    await this.wait(500);
  }

  async isAttachmentLinkVisible() {
    return this.isVisible("a:has-text('.pdf')");
  }

  async clickSendToCandidate() {
    await this.click(this.sendToCandidateBtn);
    await this.wait(2500);
  }

  // Confirmed live: Send To Candidate does NOT auto-navigate back to the
  // Onboarding grid - it stays on the same Preview Candidate Email tab
  // after the success toast fades. The circular "<" icon next to the page
  // title is what actually returns to the grid.
  async clickBackToGrid() {
    // Confirmed via DOM inspection: button[title="Back"], same convention
    // as ITAP_InterviewSchedule.backBtn.
    await this.click("button[title='Back']");
    await this.wait(1500);
  }
}

module.exports = { ITAP_GenerateOfferLetter };
