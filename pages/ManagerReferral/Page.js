// pages/ManagerReferral/Page.js — the public Manager Referral form at
// config.MANAGER_REFERRAL_URL: Candidate Name / Mobile Number / Email ID /
// Reference ID, Submit, Reset, and the link into the Report view.
//
// Real element ids/data-button-ids confirmed live (2026-09-14) via a
// throwaway Playwright probe against the actual page — same "confirmed
// live" approach used throughout this codebase (e.g. pages/Candidate/SignUpSignIn.js).
class ManagerReferralPage {
  constructor(page) {
    this.page = page;

    this.candidateName = page.locator("//input[contains(@id,'Manager_Referral.textBox9')]");
    this.mobileNumber  = page.locator("//input[contains(@id,'Manager_Referral.textBox10')]");
    this.emailId       = page.locator("//input[contains(@id,'Manager_Referral.textBox11')]");
    // Field label is "Reference ID" but the workbook and app both call this
    // the Manager SAP code (8-digit, maxlength enforced live).
    this.referenceId   = page.locator("//input[contains(@id,'Manager_Referral.textBox13')]");

    this.submitBtn      = page.locator("//*[contains(@data-button-id,'Manager_Referral.actionButton7')]");
    this.resetBtn        = page.locator("//*[contains(@data-button-id,'Manager_Referral.actionButton14')]");
    this.viewReportLink = page.locator("//*[contains(@data-button-id,'Manager_Referral.actionButton9')]");

    // Field-level errors render inline (no popup) - confirmed live: a blank
    // submit shows both "Please enter valid Candidate Name" and "Please
    // enter your employee ID" simultaneously via this class.
    this.validationMessages = page.locator('.mx-validation-message');

    // Every popup on this page (mandatory Mobile/Email modal, DB-lookup
    // rejection, submit-success) is a Mendix "Information"-style dialog with
    // just an OK button - handled generically rather than filtered by
    // header text, since the header wording isn't confirmed identical across
    // all of them. The Reset prompt is the one exception: a real
    // "Confirmation" dialog with Yes/No, handled separately below.
    this.resultDialog = page.locator("div[role='dialog']").first();
    this.confirmDialog = page.locator("div[role='dialog']").filter({ hasText: 'Confirmation' });

    // Confirmed live: the Mankind header image has no alt text, so it can
    // only be checked by visibility, identified by its src instead.
    this.headerLogo = page.locator('img[src*="MankindUIResources"]');

    // The "Referral Successful" dialog's own registration link (shown when
    // the referral includes an Email ID) - confirmed live it points to
    // config.CANDIDATE_URL and opens in a new tab when clicked.
    this.registrationLink = page.locator("//*[contains(@data-button-id,'Referral_Successfull.actionButton1')]");
  }

  /**
   * Full page's visible text, for checking the fixed UI copy on the page
   * (title, subtitle, field labels, button/link text, info notes, footer)
   * is present and correctly worded - not covered by the field-visibility-
   * only check in TC_51.
   */
  async getPageText() {
    return (await this.page.locator('body').innerText()).trim();
  }

  async enter_CandidateName(value) {
    await this.candidateName.fill(value);
  }

  async enter_MobileNumber(value) {
    await this.mobileNumber.fill(value);
  }

  async enter_EmailId(value) {
    await this.emailId.fill(value);
  }

  async enter_ReferenceId(value) {
    await this.referenceId.fill(value);
  }

  /**
   * Click Submit and wait for whichever outcome this attempt actually
   * triggers - an inline validation message or a popup - instead of a fixed
   * sleep. Confirmed live (2026-09-15): a flat 1500ms occasionally lost the
   * race for submissions that reach a real backend round trip (e.g. TC_21's
   * Mobile Number check), leaving getVisibleValidationMessages() reading an
   * empty result while the page was still showing "Please wait...". Same
   * race-the-real-outcome pattern as ManagerReferralReportPage.waitForSearchResult().
   */
  async clickOn_Submit() {
    await this.submitBtn.click();
    await Promise.race([
      this.validationMessages.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
      this.resultDialog.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    ]);
    await this.page.waitForTimeout(300);
    await this.throwIfSystemError();
  }

  // Confirmed live (2026-09-15): the app's own backend threw an unhandled
  // exception on Submit and showed its generic "An error occurred, please
  // contact your system administrator" dialog - resultDialog above matches any
  // dialog generically, so this was silently read by the test as just another
  // "no validation message shown" outcome, hiding the real cause behind an
  // unrelated assertion failure. Failing fast here with a distinctly-tagged
  // error lets the dashboard's Reason column tell "the app errored" apart from
  // "this field's own validation is broken" - same intent as
  // BrowserFactory.assertAppIsOnline().
  async throwIfSystemError() {
    const visible = await this.resultDialog.isVisible().catch(() => false);
    if (!visible) return;
    const text = ((await this.resultDialog.innerText().catch(() => '')) || '').trim();
    if (/contact your system administrator|an error occurred/i.test(text)) {
      throw new Error(`[APP_SERVER_ERROR] The form's own backend reported "${text}" after Submit.`);
    }
  }

  async clickOn_Reset() {
    await this.resetBtn.click();
    await this.page.waitForTimeout(500);
  }

  async confirmReset() {
    await this.confirmDialog.getByRole('button', { name: 'Yes' }).click();
    await this.page.waitForTimeout(500);
  }

  async cancelReset() {
    await this.confirmDialog.getByRole('button', { name: 'No' }).click();
    await this.page.waitForTimeout(500);
  }

  async clickOn_ViewReport() {
    await this.viewReportLink.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Unique, non-empty inline validation messages currently visible.
   */
  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  }

  /**
   * Text of whichever popup dialog is currently showing (mandatory-field
   * modal, DB-lookup rejection, or submit-success).
   */
  async getResultDialogText() {
    await this.resultDialog.waitFor({ state: 'visible', timeout: 10000 });
    return (await this.resultDialog.innerText()).trim();
  }

  /**
   * Clicks the "Referral Successful" dialog's registration link and returns
   * the new tab/page it opens - confirmed live the link's own href is "#"
   * (Mendix navigates via its own click handler, not a real href), so this
   * has to catch the resulting "page" event on the browser context rather
   * than read/navigate to an href directly.
   */
  async clickRegistrationLinkAndGetNewPage(context) {
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 10000 }),
      this.registrationLink.click(),
    ]);
    await newPage.waitForLoadState();
    return newPage;
  }

  async closeResultDialog() {
    await this.resultDialog.getByRole('button', { name: 'OK' }).click();
    await this.page.waitForTimeout(300);
  }

  async getFieldValues() {
    return {
      candidateName: await this.candidateName.inputValue(),
      mobileNumber: await this.mobileNumber.inputValue(),
      emailId: await this.emailId.inputValue(),
      referenceId: await this.referenceId.inputValue(),
    };
  }
}

module.exports = { ManagerReferralPage };
