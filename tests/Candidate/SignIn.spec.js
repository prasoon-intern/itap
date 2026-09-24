const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const { getRandomAadhar } = require('../../utils/CandidateFlowHelpers');
const { ITAP_LoginPage, ITAP_AlreadySignedUserPage } = require('../../pages/Candidate/SignUpSignIn');
const { ITAPInterviewPerformaPage } = require('../../pages/Candidate/Phase1');

// Built from Test Cases/candidateSignInSignUp.xlsx, sheet
// "CandidateSignIn_TestCases" (17 rows, Excel IDs TC_01..TC_17 - split out of
// the old ManagerReferral_TestCases.xlsx's CandidateAuth_TestCases sheet,
// which bundled both Sign-In and Sign-Up rows together). TC_01-11 were
// confirmed live (2026-09-16) via a throwaway Playwright probe against the
// actual form - including two cases where the sheet's own documented
// behavior turned out to be right where this project's PREVIOUS sign-in spec
// (now retired) was wrong: it claimed invalid sign-in attempts fail
// "silently" with no visible message, but the live form actually shows a
// specific inline message or "Information" popup for every case below.
// TC_12-16 (double-click, Positive Follow-up, Forgot Password) restore
// coverage the retired spec already had but the original CandidateAuth
// sheet never captured as its own rows - added back 2026-09-16 with the
// same behavior that spec had already confirmed live.
const AADHAAR_INVALID_MSG = 'Please enter valid Aadhaar number';
const PASSWORD_BLANK_MSG = 'Please enter Password';
const CHECKBOX_REQUIRED_MSG = 'Please acknowledge the terms before signing in';
const NO_ACCOUNT_MSG = 'We couldn’t find your account. Please sign up to get started.';
const WRONG_CREDENTIALS_MSG = 'Your Username or Password is incorrect';
const SCRIPT_PAYLOAD = '<script>alert(1)</script>';

test.describe('Candidate Sign In - Field Validations', () => {
  let bf;
  let login;
  let signup;

  // One shared tab for every test in this group, instead of relaunching per
  // test - see BrowserFactory.resetForNextTest()'s own comment for why this
  // stays just as isolated per-test as a fresh tab would be.
  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL, config.browser, { shared: true });
    login = new ITAP_AlreadySignedUserPage(bf.page);
    signup = new ITAP_LoginPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.CANDIDATE_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const issue = bf.getEnvironmentIssuesSummary();
      if (issue) await testInfo.attach('environment-issue', { body: issue, contentType: 'text/plain' });
    }
  });

  test.afterAll(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_01
  test('TC_01: every UI component on the Candidate Sign In page is present', async () => {
    await expect(login.enter_aadharNumber).toBeVisible();
    await expect(login.enter_password).toBeVisible();
    await expect(login.radioButton).toBeVisible();
    await expect(login.clickOn_signInButton).toBeVisible();
    await expect(login.forgotPasswordLink).toBeVisible();
    await expect(signup.createNewOne).toBeVisible();
  });

  // Excel TC_02 - config.DuplicateTestAadhar is a known-registered account.
  // Checks a couple of Phase 1's own fields actually render, not just the
  // page title - Phase1.spec.js (a separate module) already covers Phase
  // 1's fields in depth, so this only spot-checks that the real form
  // appeared, rather than re-testing Phase 1 itself.
  test('TC_02: Sign In succeeds with valid, existing credentials', async () => {
    await login.enter_AadharNumber(config.DuplicateTestAadhar);
    await login.enter_Password(config.NewPassword);
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    await login.validateSignInSuccess();

    const phase1 = new ITAPInterviewPerformaPage(bf.page);
    await expect(phase1.firstNamefield).toBeVisible();
    await expect(phase1.pancardField).toBeVisible();
  });

  // Excel TC_03
  test('TC_03: rejects Sign In with an empty Username', async () => {
    await login.enter_Password('Passw0rd1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const messages = await login.getVisibleValidationMessages();
    expect(messages).toContain(AADHAAR_INVALID_MSG);
  });

  // Excel TC_04
  test('TC_04: rejects Sign In with an empty Password', async () => {
    await login.enter_AadharNumber('989127033381');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const messages = await login.getVisibleValidationMessages();
    expect(messages).toContain(PASSWORD_BLANK_MSG);
  });

  // Excel TC_05
  test('TC_05: rejects a non-numeric Username', async () => {
    await login.enter_AadharNumber('abcdefghijkl');
    await login.enter_Password('Passw0rd1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const messages = await login.getVisibleValidationMessages();
    expect(messages).toContain(AADHAAR_INVALID_MSG);
  });

  // Excel TC_06
  test('TC_06: rejects a Username shorter than 12 digits', async () => {
    await login.enter_AadharNumber('12345678901'); // 11 digits
    await login.enter_Password('Passw0rd1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const messages = await login.getVisibleValidationMessages();
    expect(messages).toContain(AADHAAR_INVALID_MSG);
  });

  // Excel TC_07 - the field caps input at 12 digits, and that truncated
  // 12-digit value isn't a real account either, reaching the same
  // no-account-found modal as TC_09.
  // Confirmed live (2026-09-16): a hardcoded 13-digit literal here previously
  // truncated to "123456789012" - which collided with utils/SampleCandidate.js's
  // own Aadhaar once that became a real registered account, flipping the
  // outcome from "no account found" to "wrong password" and failing this
  // test. A fresh random value each run can't collide with any known account.
  test('TC_07: Username field restricts input beyond 12 digits, then rejects the truncated value', async () => {
    const truncated = getRandomAadhar();
    await login.enter_AadharNumber(truncated + '9'); // 13 digits
    await expect(login.enter_aadharNumber).toHaveValue(truncated);
    await login.enter_Password('Passw0rd1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const dialogText = await login.getInfoDialogText();
    expect(dialogText).toContain(NO_ACCOUNT_MSG);
    await login.closeInfoDialog();
  });

  // Excel TC_08
  test('TC_08: requires the acknowledgment checkbox', async () => {
    await login.enter_AadharNumber(config.DuplicateTestAadhar);
    await login.enter_Password(config.NewPassword);
    // Deliberately not checking the acknowledgment checkbox.
    await login.clickOn_SignInButton();
    const dialogText = await login.getInfoDialogText();
    expect(dialogText).toContain(CHECKBOX_REQUIRED_MSG);
    await login.closeInfoDialog();
  });

  // Excel TC_09
  test('TC_09: shows an appropriate message for a non-existent account', async () => {
    await login.enter_AadharNumber('123400005678'); // valid format, no account
    await login.enter_Password('Passw0rd1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const dialogText = await login.getInfoDialogText();
    expect(dialogText).toContain(NO_ACCOUNT_MSG);
    await login.closeInfoDialog();
  });

  // Excel TC_10
  test('TC_10: shows an appropriate message for a wrong password on an existing account', async () => {
    await login.enter_AadharNumber(config.DuplicateTestAadhar);
    await login.enter_Password('DefinitelyWrongPassword@999');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const dialogText = await login.getInfoDialogText();
    expect(dialogText).toContain(WRONG_CREDENTIALS_MSG);
    await login.closeInfoDialog();
  });

  // Excel TC_11 - two independent payloads in one test, matching how the
  // workbook itself records this as a single case.
  test('TC_11: Username field against script/SQL injection input', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => { dialogAppeared = true; await dialog.dismiss(); });

    await login.enter_AadharNumber(SCRIPT_PAYLOAD);
    await login.enter_Password('Passw0rd1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const messages = await login.getVisibleValidationMessages();
    expect(messages).toContain(AADHAAR_INVALID_MSG);
    expect(dialogAppeared).toBe(false);
    bf.page.removeAllListeners('dialog');

    await bf.page.goto(config.CANDIDATE_URL);
    await login.enter_AadharNumber("' OR '1'='1");
    await login.enter_Password('Passw0rd1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    const messages2 = await login.getVisibleValidationMessages();
    expect(messages2).toContain(AADHAAR_INVALID_MSG);
  });

  // Excel TC_12
  test('TC_12: rapid double-click on Sign In does not cause a duplicate session or error', async () => {
    await login.enter_AadharNumber(config.DuplicateTestAadhar);
    await login.enter_Password(config.NewPassword);
    await login.clickOn_radioButton();

    // Fire both clicks without waiting on the first - this is what a real
    // impatient double-click looks like, as opposed to two sequential
    // awaited clicks (which would just be two separate, safe actions).
    await Promise.allSettled([
      login.clickOn_signInButton.click({ timeout: 5000 }),
      login.clickOn_signInButton.click({ timeout: 5000 }),
    ]);

    await login.validateSignInSuccess();
  });

  // Excel TC_17 - verifies the page's own fixed UI copy (header, subtitle,
  // field labels, button/link text, checkbox text, footer) is present and
  // correctly worded - distinct from TC_01, which only checks that the
  // form's own input/button elements are locatable, not any of their text.
  // Every string below confirmed live (2026-09-16) via a throwaway
  // Playwright probe against the actual page.
  test('TC_17: header, footer, and all static UI text on the Candidate Sign In page are correct', async () => {
    await expect(login.headerLogo).toBeVisible();

    const text = await login.getPageText();
    const expectedStrings = [
      'Create an account to start registration, or Sign-In to continue.',
      'Username',
      'Password',
      'Forgot password?',
      'I acknowledge that this account is for applying to Mankind jobs. Submitting this application does not guarantee an interview, travel reimbursement, or employment.',
      'Sign in',
      "Don't have an account?",
      'Create a new one',
      '© Mankind@2026. All rights reserved.',
    ];
    for (const expected of expectedStrings) {
      expect(text).toContain(expected);
    }
  });
});

// Reuses the popup opened by ITAP_AlreadySignedUserPage.clickOn_ForgotPassword()
// (forgotPasswordAadhaar / forgotPasswordSubmit / forgotPasswordValidationMessages
// / infoDialog) rather than the main Sign-In form's own locators - a separate
// popup with its own Aadhaar field and Submit button.
test.describe('Candidate Sign In - Forgot Password', () => {
  let bf;
  let login;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL, config.browser, { shared: true });
    login = new ITAP_AlreadySignedUserPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.CANDIDATE_URL);
    await login.clickOn_ForgotPassword();
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const issue = bf.getEnvironmentIssuesSummary();
      if (issue) await testInfo.attach('environment-issue', { body: issue, contentType: 'text/plain' });
    }
  });

  test.afterAll(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_14 - config.DuplicateTestAadhar is the same known-registered
  // account used throughout this file.
  test('TC_14: a registered Aadhaar Number receives a reset-link confirmation', async () => {
    await login.enterForgotPasswordAadhaar(config.DuplicateTestAadhar);
    await login.clickOn_ForgotPasswordSubmit();
    const message = await login.getForgotPasswordResultMessage();
    expect(message).toContain('A password reset link has been sent to your email');
    await login.closeForgotPasswordResultDialog();
  });

  // Excel TC_15
  test('TC_15: an unregistered Aadhaar Number is told details are not available', async () => {
    await login.enterForgotPasswordAadhaar('555566667777');
    await login.clickOn_ForgotPasswordSubmit();
    const message = await login.getForgotPasswordResultMessage();
    expect(message).toContain('Details Not Available');
    await login.closeForgotPasswordResultDialog();
  });

  // Excel TC_16
  test('TC_16: rejects an empty Aadhaar Number', async () => {
    await login.clickOn_ForgotPasswordSubmit();
    const messages = await login.getForgotPasswordValidationMessages();
    expect(messages).toContain('Enter Valid Aadhaar Number');
  });
});

// TC_13 needs its own signup + a completely separate browser session for the
// follow-up sign-in (verifying the account is usable with zero backend
// propagation delay, not just that the same session can keep going), so it
// doesn't fit the shared-tab pattern above - same reasoning as
// SignUp.spec.js's own concurrency test.
test.describe('Candidate Sign In - Positive Follow-up', () => {
  test('TC_13: Sign In succeeds immediately after a fresh Sign Up, using the same credentials', async () => {
    const aadhar = getRandomAadhar();

    const bfSignup = new BrowserFactory();
    await bfSignup.launchBrowser(config.CANDIDATE_URL);
    const lp = new ITAP_LoginPage(bfSignup.page);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
    await lp.enterAadhaarNumber(aadhar);
    await lp.enter_emailId(config.PersonalEmailId);
    await lp.enter_newPassword(config.NewPassword);
    await lp.enter_confirmPassword(config.ConfirmPassword);
    await lp.enter_managerRefID(config.ManagerRefID);
    await lp.clickOn_checkBox1();
    await lp.attemptSignUp();
    await lp.validateHomePageTitle();
    await bfSignup.closeBrowser();

    // Deliberately a fresh browser/session - this verifies the account is
    // usable immediately (no backend propagation delay), not just that the
    // same session that created it can keep going.
    const bfSignin = new BrowserFactory();
    await bfSignin.launchBrowser(config.CANDIDATE_URL);
    const login = new ITAP_AlreadySignedUserPage(bfSignin.page);
    await login.enter_AadharNumber(aadhar);
    await login.enter_Password(config.NewPassword);
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    await login.validateSignInSuccess();
    await bfSignin.closeBrowser();
  });
});
