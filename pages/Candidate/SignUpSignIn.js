// pages/Candidate/SignUpSignIn.js — Candidate Signup + Sign-In page objects.
// Contains 2 classes, unchanged from the previous consolidated pages/Candidate.js:
//   - ITAP_LoginPage: candidate signup modal
//   - ITAP_AlreadySignedUserPage: candidate sign-in + forgot password
const { expect } = require('@playwright/test');

// pages/ITAP_LoginPage.js — equivalent to ITAP_LoginPage.java
class ITAP_LoginPage {
  constructor(page) {
    this.page = page;

    // Scoped to //input (or //*[@type='checkbox']) rather than a bare //*,
    // because once a validation error is showing, Mendix renders the error
    // <div> with an id that also contains the same field id (e.g.
    // "...textBox5..."), which turns a bare //*[contains(@id,...)] locator
    // into a strict-mode multi-match after the first failed submit attempt.
    this.createNewOne   = page.locator("//*[contains(@class,'actionButton3')]");
    this.aadharNo       = page.locator("//input[contains(@id,'CandidateSignup.textBox3')]");
    this.emailId        = page.locator("//input[contains(@id,'CandidateSignup.textBox5')]");
    this.newPassword    = page.locator("//input[contains(@id,'CandidateSignup.textBox1')]");
    this.confirmPassword= page.locator("//input[contains(@id,'CandidateSignup.textBox2')]");
    this.managerRefID   = page.locator("//input[contains(@id,'CandidateSignup.textBox4')]");
    this.checkBox1      = page.locator("//input[contains(@id,'CandidateSignup.checkBox1')]");
    this.signUpBtn      = page.locator("//*[contains(@class,'ScheduleInterviewButton')]");

    // Validation-related locators (confirmed against the live form: errors only
    // render after a Sign Up click attempt, not on field blur).
    // Scoped to the precise Mendix validation-message class rather than a
    // broad [class*='error'] selector — the latter also matches "has-error"
    // wrapper divs around reference-selector widgets, which can contain a
    // huge hidden dropdown option list as text content.
    this.validationMessages = page.locator(".mx-validation-message");
    this.signInToggleLink   = page.getByText('Already have an account? Sign In', { exact: false });
    this.closeModalBtn      = page.locator("div[role='dialog'] button.close");
    this.passwordInfoTrigger = page.locator('.widget-tooltip-trigger').first();
    this.passwordInfoContent = page.locator('.widget-tooltip-content');

    // Confirmed live (2026-09-16): several rejection paths (unchecked
    // checkbox, duplicate Aadhaar, password-policy violation) don't render
    // an inline .mx-validation-message at all - they open a SECOND dialog
    // ("Information") stacked on top of the still-open Sign Up modal itself
    // (which is also a div[role='dialog']). Filtered by "Information" text,
    // same pattern as ITAP_AlreadySignedUserPage's own infoDialog, so a bare
    // .first() here can't accidentally match the signup modal instead.
    this.infoDialog   = page.locator("div[role='dialog']").filter({ hasText: 'Information' });
    this.infoDialogOk = this.infoDialog.getByRole('button', { name: 'OK' });

    // Confirmed live (2026-09-16): the Sign Up modal's own header logo is a
    // DIFFERENT file ("Mankind_logo_new.svg") than the Sign-In page's
    // ("mankind_logo_dark_big.svg" - see ITAP_AlreadySignedUserPage below),
    // so a shared case-insensitive "logo" substring match is used instead of
    // matching either exact filename.
    this.headerLogo = page.locator('div[role=\'dialog\']').filter({ hasText: 'Sign Up' }).locator('img[src*="logo" i]');
  }

  /**
   * Full page's visible text (not just the modal), for checking the fixed
   * UI copy around the Sign Up modal (its own labels/buttons, plus the
   * underlying page's header/footer which stay in the DOM behind it) is
   * present and correctly worded.
   */
  async getPageText() {
    return (await this.page.locator('body').innerText()).trim();
  }

  async scrollToFirst() {
    await this.createNewOne.scrollIntoViewIfNeeded();
  }

  async clickOn_createNewOne() {
    // Confirmed live: this click can silently not register (same "Mendix
    // click sometimes doesn't register" issue documented repeatedly
    // elsewhere in this project) - when it doesn't, the signup form's
    // fields (starting with Aadhaar) stay present in the DOM but disabled
    // forever, and a plain .fill() on them retries every 500ms
    // indefinitely until the whole test times out, rather than failing
    // fast. Verify the Aadhaar field actually became enabled before
    // moving on, retrying the click a few times otherwise.
    //
    // Confirmed live (2026-09-02): the retry itself had a real bug - if the
    // FIRST click succeeds but the modal is just slow to finish rendering
    // (aadharNo not yet enabled within 5s), the loop assumed the click had
    // failed and clicked createNewOne AGAIN - but that button is now
    // COVERED by the modal that already opened, so the second click hangs
    // for Playwright's own ~30s actionability retry trying to click
    // through the dialog's underlay ("... intercepts pointer events",
    // confirmed live as 50+ internal retry attempts before failing
    // outright). Now checks whether the dialog is already open before ever
    // clicking again - an already-open modal just needs a longer wait for
    // aadharNo, not a redundant click.
    for (let attempt = 0; attempt < 4; attempt++) {
      const alreadyOpen = await this.page.locator("[role='dialog']").first().isVisible().catch(() => false);
      if (!alreadyOpen) await this.createNewOne.click();
      const enabled = await this.aadharNo.isEnabled({ timeout: alreadyOpen ? 8000 : 5000 }).catch(() => false);
      if (enabled) return;
    }
    throw new Error('clickOn_createNewOne(): Aadhaar field never became enabled after 4 click attempts.');
  }

  async enterAadhaarNumber(aadharNum) {
    await this.aadharNo.fill(aadharNum);
  }

  async enter_emailId(emailId) {
    await this.emailId.click();
    await this.emailId.fill(emailId);
  }

  async enter_newPassword(newPassword) {
    await this.newPassword.fill(newPassword);
  }

  async enter_confirmPassword(confirmPassword) {
    await this.confirmPassword.fill(confirmPassword);
  }

  async enter_managerRefID(managerRefID) {
    await this.managerRefID.fill(managerRefID);
  }

  async clickOn_checkBox1() {
    await this.checkBox1.click();
  }

  async clickOn_SignUp() {
    await this.signUpBtn.click();
  }

  async validateHomePageTitle() {
    // Confirmed live: a successful signup lands on "Mendix - Application Form
    // - Phase 1", not "Interview Form" — the previous string never matched a
    // real successful signup, so this assertion (and the sign-in equivalent,
    // and every negative test's `.not.toHaveTitle(...)` check) was silently
    // checking against a title that could never occur.
    const expectedTitle = 'Mendix - Application Form - Phase 1';
    await expect(this.page).toHaveTitle(expectedTitle, { timeout: 15000 });
    console.log('[PASS] Home page title is correct:', expectedTitle);
  }

  /**
   * Return the unique, non-empty validation/error messages currently visible
   * on the page. These only render after a Sign Up click attempt (confirmed
   * against the live form — there is no per-field blur validation).
   */
  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map(t => t.trim()).filter(Boolean))];
  }

  /**
   * Click the Sign Up button and wait briefly for validation messages (if any)
   * to render, without waiting on navigation (invalid submissions don't navigate).
   */
  async attemptSignUp() {
    await this.signUpBtn.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Text of the "Information" popup shown after a rejected Sign Up attempt
   * (unchecked checkbox, duplicate Aadhaar, password-policy violation) -
   * confirmed live these render as a second dialog stacked on the still-open
   * Sign Up modal, not an inline .mx-validation-message.
   */
  async getInfoDialogText() {
    await this.infoDialog.waitFor({ state: 'visible', timeout: 10000 });
    return (await this.infoDialog.innerText()).trim();
  }

  async closeInfoDialog() {
    await this.infoDialogOk.click();
    await this.page.waitForTimeout(300);
  }

  async clickOn_signInToggle() {
    // The modal's resize handle (.mx-resizer) permanently occupies the exact
    // on-screen pixels this link sits at. A plain click times out retrying
    // forever (blocked), and {force: true} doesn't actually fix it either —
    // force still dispatches a real mouse click at those same coordinates,
    // which still lands on the resize handle instead of the link. Confirmed
    // live: only a direct DOM click event (bypassing hit-testing/coordinates
    // entirely) actually triggers the toggle.
    await this.signInToggleLink.scrollIntoViewIfNeeded();
    await this.signInToggleLink.dispatchEvent('click');
  }

  async closeSignupModal() {
    await this.closeModalBtn.click();
  }

  /**
   * Reveal (by click) and return the password policy tooltip text next to
   * "New Password - Mankind ID".
   */
  async getPasswordPolicyText() {
    await this.passwordInfoTrigger.click({ force: true });
    await this.page.waitForTimeout(500);
    return (await this.passwordInfoContent.first().textContent() || '').trim();
  }
}

// pages/ITAP_AlreadySignedUserPage.js — equivalent to ITAP_AlreadySignedUserPage.java
class ITAP_AlreadySignedUserPage {
  constructor(page) {
    this.page = page;

    this.enter_aadharNumber   = page.locator("//*[@placeholder='Aadhar Number']");
    this.enter_password       = page.locator("//*[@placeholder='Password']");
    this.radioButton          = page.locator("//*[contains(@id,'Candidate_Login.checkBox1')]");
    this.clickOn_signInButton = page.locator("//*[contains(@data-button-id,'Candidate_Login.actionButton4')]");
    this.forgotPasswordLink   = page.locator("//*[contains(@data-button-id,'Candidate_Login.actionButton1')]");

    // Confirmed live (2026-09-16): a blank/malformed Username or a blank
    // Password DOES render an inline .mx-validation-message on the Sign-In
    // form itself (e.g. "Please enter valid Aadhaar number") - this was
    // previously undocumented here (only the Forgot Password popup's own
    // messages were, below), and only cases that require a real backend
    // account lookup (wrong password, unregistered Aadhaar, unchecked
    // checkbox) show the separate "Information" popup instead (see
    // infoDialog below).
    this.validationMessages = page.locator(".mx-validation-message");

    // Forgot Password popup (opened by forgotPasswordLink). Scoped to //input
    // rather than a bare //*, for the same reason as ITAP_LoginPage's fields:
    // once "Enter Valid Aadhaar Number" is showing, the error <div> also has
    // an id containing "ForgotPassword.textBox3", turning a bare
    // contains(@id,...) locator into a strict-mode multi-match.
    this.forgotPasswordAadhaar = page.locator("//input[contains(@id,'ForgotPassword.textBox3')]");
    this.forgotPasswordSubmit  = page.locator("//*[contains(@data-button-id,'ForgotPassword.actionButton15')]");
    this.forgotPasswordValidationMessages = page.locator(".mx-validation-message");
    // The follow-up "Information" popup Mendix shows after Submit — its text
    // differs depending on whether the Aadhaar Number is registered
    // (confirmed live: "A password reset link has been sent to your email..."
    // vs. "Details Not Available!" for an unregistered one).
    this.infoDialog    = page.locator("div[role='dialog']").filter({ hasText: 'Information' });
    this.infoDialogOk  = this.infoDialog.getByRole('button', { name: 'OK' });

    // Confirmed live (2026-09-16): the header logo file is
    // "mankind_logo_dark_big.svg" here vs. the Sign Up modal's own
    // "Mankind_logo_new.svg" (see ITAP_LoginPage above) - a shared
    // case-insensitive "logo" substring match covers both without needing to
    // match either exact filename.
    this.headerLogo = page.locator('img[src*="logo" i]');
  }

  /**
   * Full page's visible text, for checking the fixed UI copy on the page
   * (subtitle, field labels, button/link text, footer) is present and
   * correctly worded.
   */
  async getPageText() {
    return (await this.page.locator('body').innerText()).trim();
  }

  async enter_AadharNumber(aadharNumber) {
    await this.enter_aadharNumber.fill(aadharNumber);
  }

  async enter_Password(password) {
    await this.enter_password.fill(password);
  }

  async clickOn_radioButton() {
    await this.radioButton.click();
  }

  async clickOn_SignInButton() {
    await this.clickOn_signInButton.scrollIntoViewIfNeeded();
    await this.clickOn_signInButton.click();
  }

  /**
   * Unique, non-empty inline validation messages currently visible on the
   * Sign-In form itself (e.g. a blank/malformed Username or blank Password).
   */
  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  }

  /**
   * Text of the "Information" popup Mendix shows for rejections that need a
   * real backend account lookup (unchecked checkbox, unregistered Aadhaar,
   * wrong password) - distinct from getVisibleValidationMessages() above,
   * which only covers this form's own field-shape checks.
   */
  async getInfoDialogText() {
    await this.infoDialog.waitFor({ state: 'visible', timeout: 10000 });
    return (await this.infoDialog.innerText()).trim();
  }

  async closeInfoDialog() {
    await this.infoDialogOk.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Assert sign-in actually succeeded (navigated past the login page into
   * Phase 1), rather than silently continuing into Phase 1 steps regardless.
   * Mirrors ITAP_LoginPage.validateHomePageTitle() on the signup path, which
   * already asserts this — the sign-in path previously had no equivalent
   * check at all.
   */
  async validateSignInSuccess() {
    // Confirmed live: successfully reaching Phase 1 shows the title
    // "Mendix - Application Form - Phase 1", not "Interview Form".
    const expectedTitle = 'Mendix - Application Form - Phase 1';
    await expect(this.page).toHaveTitle(expectedTitle, { timeout: 15000 });
  }

  /**
   * Click the "Forgot password?" link on the Sign-In page. Previously present
   * in the UI but never referenced anywhere in the automation.
   */
  async clickOn_ForgotPassword() {
    await this.forgotPasswordLink.scrollIntoViewIfNeeded();
    await this.forgotPasswordLink.click();
  }

  async enterForgotPasswordAadhaar(aadharNumber) {
    await this.forgotPasswordAadhaar.fill(aadharNumber);
  }

  async clickOn_ForgotPasswordSubmit() {
    await this.forgotPasswordSubmit.click();
    // Mirrors ITAP_LoginPage.attemptSignUp(): give Mendix a moment to render
    // its validation message (or the follow-up Information popup) before the
    // caller checks for it.
    await this.page.waitForTimeout(1500);
  }

  /**
   * Unique, non-empty validation messages currently visible in the Forgot
   * Password popup (e.g. "Enter Valid Aadhaar Number" on a blank/malformed
   * submit).
   */
  async getForgotPasswordValidationMessages() {
    const texts = await this.forgotPasswordValidationMessages.allTextContents();
    return [...new Set(texts.map(t => t.trim()).filter(Boolean))];
  }

  /**
   * Text of the follow-up "Information" popup shown after a Forgot Password
   * submit. Confirmed live to read "A password reset link has been sent to
   * your email..." for a registered Aadhaar, or "Details Not Available!" for
   * an unregistered one.
   */
  async getForgotPasswordResultMessage() {
    await this.infoDialog.waitFor({ state: 'visible', timeout: 10000 });
    return (await this.infoDialog.innerText()).trim();
  }

  async closeForgotPasswordResultDialog() {
    await this.infoDialogOk.click();
  }
}

module.exports = { ITAP_LoginPage, ITAP_AlreadySignedUserPage };
