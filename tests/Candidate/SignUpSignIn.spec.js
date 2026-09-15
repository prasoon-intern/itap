const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const { getRandomAadhar } = require('../../utils/CandidateFlowHelpers');
const { ITAP_LoginPage, ITAP_AlreadySignedUserPage } = require('../../pages/Candidate/SignUpSignIn');

// Negative-case coverage for the Candidate Sign-In form — the happy-path
// sign-in with fully valid, hardcoded credentials is exercised elsewhere
// (e.g. utils/createFreshInterviewCandidate.js), not duplicated here.
//
// Confirmed live behavior: unlike Signup (which shows explicit inline error
// text), invalid Sign-In attempts fail *silently* here — wrong password,
// an unregistered Aadhaar, and an unchecked confirmation radio all leave the
// user on the same "Mendix - Candidate Login" page with no visible message.
// So the only reliable, assertable signal for "rejected" is that the page
// never navigates away from the login screen.
const LOGIN_TITLE = 'Mendix - Candidate Login';

test.describe('Candidate Sign-In - Negative Cases', () => {
  let bf;
  let login;

  test.beforeEach(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    login = new ITAP_AlreadySignedUserPage(bf.page);
    await bf.hardWait(1);
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // TC-012
  test('TC-012: rejects sign-in with an incorrect password', async () => {
    // config.DuplicateTestAadhar is signed up for real by
    // this file's "Candidate Signup - Negative & Edge Cases" describe (TC-003),
    // so it's a known-registered account.
    await login.enter_AadharNumber(config.DuplicateTestAadhar);
    await login.enter_Password('DefinitelyWrongPassword@999');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    await bf.hardWait(2);

    await expect(bf.page).toHaveTitle(LOGIN_TITLE);
  });

  // TC-013
  test('TC-013: rejects sign-in with an unregistered Aadhaar number', async () => {
    await login.enter_AadharNumber('888877776666');
    await login.enter_Password('WhateverPassword@1');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    await bf.hardWait(2);

    await expect(bf.page).toHaveTitle(LOGIN_TITLE);
  });

  // TC-014
  test('TC-014: safely rejects script/SQL-injection style input without executing it', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await login.enter_AadharNumber("' OR 1=1--");
    await login.enter_Password('<script>alert(1)</script>');
    await login.clickOn_radioButton();
    await login.clickOn_SignInButton();
    await bf.hardWait(2);

    // Treated as plain text and rejected by ordinary format validation.
    const errors = await bf.page.locator(".mx-validation-message").allTextContents();
    expect(errors.map(t => t.trim())).toContain('Please enter valid Aadhaar number');
    expect(dialogAppeared).toBe(false);
    await expect(bf.page).toHaveTitle(LOGIN_TITLE);
  });

  // TC-LP-N11 (new)
  test('TC-N11: blocks sign-in when the acknowledgement checkbox is left unchecked', async () => {
    // config.DuplicateTestAadhar is signed up for real by
    // this file's "Candidate Signup - Negative & Edge Cases" describe (TC-003),
    // so it's a known-registered account.
    await login.enter_AadharNumber(config.DuplicateTestAadhar);
    await login.enter_Password(config.NewPassword);
    // Deliberately not checking the acknowledgement checkbox.
    await login.clickOn_SignInButton();
    await bf.hardWait(2);

    await expect(bf.page).toHaveTitle(LOGIN_TITLE);
  });

  // TC-LP-E07 (new)
  test('E07: rapid double-click on Sign In does not cause a duplicate session or error', async () => {
    await login.enter_AadharNumber(config.DuplicateTestAadhar);
    await login.enter_Password(config.NewPassword);
    await login.clickOn_radioButton();

    await Promise.allSettled([
      login.clickOn_signInButton.click({ timeout: 5000 }),
      login.clickOn_signInButton.click({ timeout: 5000 }),
    ]);
    await bf.hardWait(2);

    await login.validateSignInSuccess();
  });
});

// "Forgot password?" was previously present in the UI but never referenced
// anywhere in the automation. It opens its own popup (separate Aadhaar field
// + Submit button), followed by an "Information" popup whose message differs
// depending on whether the Aadhaar Number is registered — both confirmed live.
test.describe('Candidate Sign-In - Forgot Password', () => {
  let bf;
  let login;

  test.beforeEach(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    login = new ITAP_AlreadySignedUserPage(bf.page);
    await bf.hardWait(1);
    await login.clickOn_ForgotPassword();
    await bf.hardWait(1);
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // TC-LP-P (new): registered Aadhaar gets a reset-link confirmation
  test('Forgot Password: registered Aadhaar number receives a reset-link confirmation', async () => {
    // config.DuplicateTestAadhar is signed up for real by
    // this file's "Candidate Signup - Negative & Edge Cases" describe (TC-003),
    // so it's a known-registered account.
    await login.enterForgotPasswordAadhaar(config.DuplicateTestAadhar);
    await login.clickOn_ForgotPasswordSubmit();

    const message = await login.getForgotPasswordResultMessage();
    expect(message).toContain('A password reset link has been sent to your email');

    await login.closeForgotPasswordResultDialog();
  });

  // TC-LP-N (new): unregistered Aadhaar gets a distinct "not available" message
  test('Forgot Password: unregistered Aadhaar number is told details are not available', async () => {
    await login.enterForgotPasswordAadhaar('555566667777');
    await login.clickOn_ForgotPasswordSubmit();

    const message = await login.getForgotPasswordResultMessage();
    expect(message).toContain('Details Not Available');

    await login.closeForgotPasswordResultDialog();
  });

  // TC-LP-N (new): blank Aadhaar is rejected before it ever reaches the server
  test('Forgot Password: blank Aadhaar number is rejected by field validation', async () => {
    await login.clickOn_ForgotPasswordSubmit();

    const messages = await login.getForgotPasswordValidationMessages();
    expect(messages).toContain('Enter Valid Aadhaar Number');
  });
});

// Negative / edge-case coverage for the Candidate Signup modal — the
// happy-path signup with fully valid, hardcoded data is exercised elsewhere
// (e.g. utils/createFreshInterviewCandidate.js), not duplicated here.
//
// Every expected message/behavior below was confirmed by hand against the
// live form at config.CANDIDATE_URL before being encoded as an assertion
// (see Modification Test Cases.xlsx, TC-001..TC-011).
test.describe('Candidate Signup - Negative & Edge Cases', () => {
  let bf;
  let lp;

  test.beforeEach(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    lp = new ITAP_LoginPage(bf.page);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
    await bf.hardWait(1);
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // TC-001 / TC-002
  test('TC-001/002: rejects a non-numeric or short Aadhaar number', async () => {
    await lp.enterAadhaarNumber('abc');
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain('Enter Valid Aadhaar Number');
  });

  // TC-003
  test('TC-003: rejects signup with an already-registered Aadhaar number', async () => {
    const aadhar = config.DuplicateTestAadhar;

    // First attempt: idempotently ensures the account exists (may succeed the
    // very first time this ever runs, or fail as a duplicate on every run after).
    await lp.enterAadhaarNumber(aadhar);
    await lp.enter_emailId(config.PersonalEmailId);
    await lp.enter_newPassword(config.NewPassword);
    await lp.enter_confirmPassword(config.ConfirmPassword);
    await lp.enter_managerRefID(config.ManagerRefID);
    await lp.clickOn_checkBox1();
    await lp.attemptSignUp();

    // Second attempt in the same run: whether or not the first attempt just
    // created the account, this one is guaranteed to hit a duplicate.
    await bf.page.goto(config.CANDIDATE_URL);
    await bf.hardWait(1);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
    await bf.hardWait(1);
    await lp.enterAadhaarNumber(aadhar);
    await lp.enter_emailId(config.PersonalEmailId);
    await lp.enter_newPassword(config.NewPassword);
    await lp.enter_confirmPassword(config.ConfirmPassword);
    await lp.enter_managerRefID(config.ManagerRefID);
    await lp.clickOn_checkBox1();
    await lp.attemptSignUp();

    // Duplicate submission must not reach Phase 1.
    await expect(bf.page).not.toHaveTitle('Mendix - Application Form - Phase 1');
  });

  // TC-004
  test('TC-004: rejects an invalid / official Mankind email address', async () => {
    // Fixed 2026-09-07: this test wrongly expected the SAME "official
    // Mankind email" message for both halves. Confirmed live (dashboard
    // failure screenshot): a malformed, non-email-shaped value like
    // "not-an-email" never reaches the domain check at all - it's caught
    // by the form's own generic format validation first, which shows
    // "Please enter a valid email address." The "Official Mankind email
    // IDs..." message only fires for a VALIDLY-formatted official-domain
    // address, which the second half of this test (a real
    // @mankindpharma.com address) already covers correctly.
    await lp.enter_emailId('not-an-email');
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain('Please enter a valid email address.');

    await lp.enter_emailId('someone@mankindpharma.com');
    await lp.attemptSignUp();
    const messages2 = await lp.getVisibleValidationMessages();
    expect(messages2).toContain('Official Mankind email IDs are not allowed. Please enter a personal email address.');
  });

  // TC-005
  test('TC-005: rejects mismatched New Password / Confirm Password', async () => {
    await lp.enter_newPassword('Password@123');
    await lp.enter_confirmPassword('Different@456');
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain('New Password and Confirm Password must be same');
  });

  // TC-006
  test('TC-006: shows the password policy tooltip and enforces it', async () => {
    const policyText = await lp.getPasswordPolicyText();
    expect(policyText).toContain('8 Character');
    expect(policyText).toContain('1 digit');

    // Enforcement check: a password violating the stated policy (no digit,
    // fewer than 8 characters) must not be enough to reach Phase 1, even
    // when every other field is otherwise valid.
    await lp.enterAadhaarNumber(getRandomAadhar());
    await lp.enter_emailId(config.PersonalEmailId);
    await lp.enter_newPassword('abc');
    await lp.enter_confirmPassword('abc');
    await lp.enter_managerRefID(config.ManagerRefID);
    await lp.clickOn_checkBox1();
    await lp.attemptSignUp();
    await expect(bf.page).not.toHaveTitle('Mendix - Application Form - Phase 1');
  });

  // TC-007
  test('TC-007: rejects an invalid Manager Reference ID', async () => {
    // Confirmed live behavior: a blank Manager Reference ID and a filled-but-
    // wrong one produce two different messages.
    await lp.enter_managerRefID('99999999');
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(
      'Please enter correct Manager Reference ID as provided by your referring manager or refer to the Sign-up email that you have received'
    );
  });

  // TC-008
  test('TC-008: blocks submission when the acknowledgement checkbox is unchecked', async () => {
    await lp.enterAadhaarNumber(getRandomAadhar());
    await lp.enter_emailId(config.PersonalEmailId);
    await lp.enter_newPassword(config.NewPassword);
    await lp.enter_confirmPassword(config.ConfirmPassword);
    await lp.enter_managerRefID(config.ManagerRefID);
    // Deliberately not checking the checkbox.
    await lp.attemptSignUp();

    // Confirmed live behavior: this fails *silently* (no validation message at
    // all) rather than showing an error — the click has no effect. We assert
    // on the one observable symptom: no navigation to Phase 1.
    await expect(bf.page).not.toHaveTitle('Mendix - Application Form - Phase 1');
  });

  // TC-009
  test('TC-009: shows per-field validation on a fully blank form submit', async () => {
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toEqual(expect.arrayContaining([
      'Enter Valid Aadhaar Number',
      'Enter Email ID',
      'Enter Password',
      'Manager Reference ID does not contain the Division Code. Please contact your referrer.',
    ]));
  });

  // TC-010
  test('TC-010: toggles between Sign Up and Sign In modals', async () => {
    await lp.clickOn_signInToggle();
    await bf.hardWait(1);
    // NOTE: the Sign-In form's Aadhaar field sits on the base page underneath
    // the Signup modal at all times, so asserting only that it's "visible"
    // passes whether or not the modal actually closed — it was a false
    // positive. The real, meaningful check is that the modal itself is gone.
    expect(await bf.page.locator("div[role='dialog']").count()).toBe(0);
    await expect(bf.page.locator("//*[@placeholder='Aadhar Number']")).toBeVisible();
  });

  // TC-011
  test('TC-011: closing the Signup modal mid-entry and reopening it clears the form', async () => {
    await lp.enterAadhaarNumber('123456789012');
    await lp.closeSignupModal();
    await bf.hardWait(1);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
    await bf.hardWait(1);
    await expect(lp.aadharNo).toHaveValue('');
  });

  // E01
  test('E01: Aadhaar Number field enforces the 12-digit maximum length on both forms', async () => {
    await lp.enterAadhaarNumber('123456789012345'); // 15 digits
    await expect(lp.aadharNo).toHaveValue('123456789012');

    // Same enforcement on the Sign-In form's Aadhaar field (reached by
    // toggling — it's not a separate page, just a hidden view underneath).
    await lp.clickOn_signInToggle();
    await bf.hardWait(1);
    const signInAadhaar = bf.page.locator("//*[@placeholder='Aadhar Number']");
    await signInAadhaar.fill('123456789012345');
    await expect(signInAadhaar).toHaveValue('123456789012');
  });

  // E02
  test('E02: Manager Reference ID field enforces the 8-character maximum length', async () => {
    await lp.enter_managerRefID('ABCDEFGHIJKL'); // 12 chars
    await expect(lp.managerRefID).toHaveValue('ABCDEFGH');
  });

  // E03
  test('E03: Email field accepts up to its 200-character maximum length', async () => {
    const longEmail = `${'a'.repeat(190)}@example.com`; // 202 chars total
    await lp.enter_emailId(longEmail);
    const value = await lp.emailId.inputValue();
    expect(value.length).toBe(200);
    expect(value).toBe(longEmail.slice(0, 200));
  });

  // E04
  test('E04: Password / Confirm Password fields enforce their 50-character maximum', async () => {
    const longPassword = 'Aa1@'.repeat(15); // 60 chars
    await lp.enter_newPassword(longPassword);
    await lp.enter_confirmPassword(longPassword);
    await expect(lp.newPassword).toHaveValue(longPassword.slice(0, 50));
    await expect(lp.confirmPassword).toHaveValue(longPassword.slice(0, 50));
  });

  // E05
  test('E05: leading whitespace in Aadhaar Number is not trimmed and silently truncates the real digits', async () => {
    // Confirmed live: the field does NOT trim whitespace. Because leading
    // spaces count against the 12-character maxlength, they consume part of
    // the limit and truncate the real Aadhaar digits instead of being
    // stripped — typing "  723927100205  " ends up holding "  7239271002",
    // not the intended 12-digit number. A real user pasting a number with a
    // stray leading space would silently sign up with the wrong Aadhaar.
    await lp.enterAadhaarNumber('  723927100205  ');
    await expect(lp.aadharNo).toHaveValue('  7239271002');
  });

  // E06
  test('E06: rapid double-click on Sign Up does not break the flow or leave a broken UI state', async () => {
    await lp.enterAadhaarNumber(getRandomAadhar());
    await lp.enter_emailId(config.PersonalEmailId);
    await lp.enter_newPassword(config.NewPassword);
    await lp.enter_confirmPassword(config.ConfirmPassword);
    await lp.enter_managerRefID(config.ManagerRefID);
    await lp.clickOn_checkBox1();

    // Fire both clicks without waiting on the first — this is what a real
    // impatient double-click looks like, as opposed to two sequential
    // awaited clicks (which would just be two separate, safe actions).
    await Promise.allSettled([
      lp.signUpBtn.click({ timeout: 5000 }),
      lp.signUpBtn.click({ timeout: 5000 }),
    ]);
    await bf.hardWait(3);

    // Confirmed live: this still lands cleanly on a single, stable Phase 1
    // page rather than an error state or a stuck spinner. (This checks the
    // client-visible outcome only — confirming exactly one backend record
    // was created would require DB/admin-side access, out of scope here.)
    await lp.validateHomePageTitle();
  });

  // E08
  test('E08: browser refresh while the Signup modal is open does not leave a broken state', async () => {
    await lp.enterAadhaarNumber('999900001111');
    await lp.enter_emailId(config.PersonalEmailId);
    await bf.page.reload({ waitUntil: 'networkidle' });
    await bf.hardWait(1);

    await expect(bf.page).toHaveTitle('Mendix - Candidate Login');
    expect(await bf.page.locator("div[role='dialog']").count()).toBe(0);
  });

  // E10
  test('E10: pasting a value longer than maxlength into Aadhaar Number is still truncated', async () => {
    await bf.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await bf.page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, '12345678901234567890');

    await lp.aadharNo.click();
    await bf.page.keyboard.press('Control+A');
    await bf.page.keyboard.press('Control+V');
    await expect(lp.aadharNo).toHaveValue('123456789012');
  });

  // E11
  test('E11: repeatedly toggling between Sign Up and Sign In does not stack modals or leak data', async () => {
    for (let i = 0; i < 3; i++) {
      await lp.clickOn_signInToggle();
      await bf.hardWait(1.5);

      await lp.scrollToFirst();
      await lp.clickOn_createNewOne();
      await bf.hardWait(1.5);
    }

    expect(await bf.page.locator("div[role='dialog']").count()).toBe(1);
    await expect(lp.aadharNo).toHaveValue('');
  });
});

// P08: needs its own signup + a completely separate browser session for the
// follow-up sign-in, so it doesn't fit the shared beforeEach above.
test.describe('Candidate Signup - Positive Follow-up', () => {
  test('P08: sign in succeeds immediately after a fresh sign-up, using the same credentials', async () => {
    const aadhar = getRandomAadhar();

    const bfSignup = new BrowserFactory();
    await bfSignup.launchBrowser(config.CANDIDATE_URL);
    const lp = new ITAP_LoginPage(bfSignup.page);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
    await bfSignup.hardWait(1);
    await lp.enterAadhaarNumber(aadhar);
    await lp.enter_emailId(config.PersonalEmailId);
    await lp.enter_newPassword(config.NewPassword);
    await lp.enter_confirmPassword(config.ConfirmPassword);
    await lp.enter_managerRefID(config.ManagerRefID);
    await lp.clickOn_checkBox1();
    await lp.attemptSignUp();
    await lp.validateHomePageTitle();
    await bfSignup.closeBrowser();

    // Deliberately a fresh browser/session — this verifies the account is
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

// E09: needs two concurrent sessions racing each other, so it also gets its
// own describe block rather than the shared single-browser beforeEach.
test.describe('Candidate Signup - Concurrency', () => {
  test('E09: concurrent sign-up attempts with the same Aadhaar Number only let one succeed', async () => {
    const aadhar = getRandomAadhar();
    const successTitle = 'Mendix - Application Form - Phase 1';

    const bfA = new BrowserFactory();
    const bfB = new BrowserFactory();
    await Promise.all([
      bfA.launchBrowser(config.CANDIDATE_URL),
      bfB.launchBrowser(config.CANDIDATE_URL),
    ]);

    const lpA = new ITAP_LoginPage(bfA.page);
    const lpB = new ITAP_LoginPage(bfB.page);

    async function fillSignup(lp, bf) {
      await lp.scrollToFirst();
      await lp.clickOn_createNewOne();
      await bf.hardWait(1);
      await lp.enterAadhaarNumber(aadhar);
      await lp.enter_emailId(config.PersonalEmailId);
      await lp.enter_newPassword(config.NewPassword);
      await lp.enter_confirmPassword(config.ConfirmPassword);
      await lp.enter_managerRefID(config.ManagerRefID);
      await lp.clickOn_checkBox1();
    }

    await Promise.all([fillSignup(lpA, bfA), fillSignup(lpB, bfB)]);

    // Submit both at nearly the same time.
    await Promise.allSettled([lpA.attemptSignUp(), lpB.attemptSignUp()]);
    await Promise.all([bfA.hardWait(1), bfB.hardWait(1)]);

    const [titleA, titleB] = await Promise.all([bfA.page.title(), bfB.page.title()]);
    const successCount = [titleA, titleB].filter((t) => t === successTitle).length;

    expect(successCount).toBe(1);

    await bfA.closeBrowser();
    await bfB.closeBrowser();
  });
});
