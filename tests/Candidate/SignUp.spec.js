const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const { getRandomAadhar } = require('../../utils/CandidateFlowHelpers');
const SampleCandidate = require('../../utils/SampleCandidate');
const { ITAP_LoginPage } = require('../../pages/Candidate/SignUpSignIn');
const { ITAPInterviewPerformaPage } = require('../../pages/Candidate/Phase1');

// Built from Test Cases/candidateSignInSignUp.xlsx, sheet
// "CandidateSignUp_TestCases" (31 rows, Excel IDs TC_01..TC_31 - split out of
// the old ManagerReferral_TestCases.xlsx's CandidateAuth_TestCases sheet,
// which bundled both Sign-In and Sign-Up rows together). TC_01-18 were
// confirmed live (2026-09-16) via a throwaway Playwright probe against the
// actual form - including one case where the sheet's own documented behavior
// turned out to be right where this project's PREVIOUS signup spec (now
// retired) was wrong: it claimed an unchecked acknowledgment checkbox fails
// "silently" with no visible message, but the live form actually shows an
// "Information" popup, same as every other rejection path below that needs a
// real backend check. TC_19-30 (toggle/refresh/maxlength/double-click/
// concurrency) restore coverage the retired spec already had but the
// original CandidateAuth sheet never captured as its own rows - added back
// 2026-09-16 with the same behavior that spec had already confirmed live.
const AADHAAR_INVALID_MSG = 'Enter Valid Aadhaar Number';
const EMAIL_BLANK_MSG = 'Enter Email ID';
const PASSWORD_BLANK_MSG = 'Enter Password';
const REFID_BLANK_MSG = 'Manager Reference ID does not contain the Division Code. Please contact your referrer.';
// Confirmed live (2026-09-17): any malformed/non-standard email - not just a
// real @mankindpharma.com address - now shows this same message instead of a
// generic "please enter a valid email address" one. A genuinely valid
// personal email (e.g. "prasoon@gmail.com") still shows neither message.
const OFFICIAL_EMAIL_BLOCKED_MSG = 'Official Mankind email IDs are not allowed. Please enter a personal email address.';
const PASSWORD_POLICY_MSG = 'Check Password policy 8 Character and at least 1 digit should be there.';
const PASSWORD_MISMATCH_MSG = 'New Password and Confirm Password must be same';
const REFID_UNMATCHED_MSG = 'Please enter correct Manager Reference ID as provided by your referring manager or refer to the Sign-up email that you have received';
const CHECKBOX_REQUIRED_MSG = 'Please acknowledge the terms before signing in';
const DUPLICATE_AADHAAR_MSG = 'An account with this aadhaar number already exists.';
const SUCCESS_TITLE = 'Mendix - Application Form - Phase 1';
const SCRIPT_PAYLOAD = '<script>alert(1)</script>';

// Fills every field validly except whatever the caller overrides, matching
// the workbook's own Preconditions/testdata column ("other fields valid")
// for every negative test below - each one only overrides the single field
// under test.
async function fillValidSignup(lp, overrides = {}) {
  await lp.enterAadhaarNumber(overrides.aadhaar ?? getRandomAadhar());
  await lp.enter_emailId(overrides.email ?? config.PersonalEmailId);
  await lp.enter_newPassword(overrides.newPassword ?? config.NewPassword);
  await lp.enter_confirmPassword(overrides.confirmPassword ?? config.ConfirmPassword);
  await lp.enter_managerRefID(overrides.referenceId ?? config.ManagerRefID);
  if (overrides.skipCheckbox !== true) await lp.clickOn_checkBox1();
}

test.describe('Candidate Sign Up - Field Validations', () => {
  let bf;
  let lp;

  // One shared tab for every test in this group, instead of relaunching per
  // test - see BrowserFactory.resetForNextTest()'s own comment for why this
  // stays just as isolated per-test as a fresh tab would be.
  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL, config.browser, { shared: true });
    lp = new ITAP_LoginPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.CANDIDATE_URL);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
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
  test('TC_01: every UI component on the Candidate Sign Up modal is present', async () => {
    await expect(lp.aadharNo).toBeVisible();
    await expect(lp.emailId).toBeVisible();
    await expect(lp.newPassword).toBeVisible();
    await expect(lp.confirmPassword).toBeVisible();
    await expect(lp.managerRefID).toBeVisible();
    await expect(lp.checkBox1).toBeVisible();
    await expect(lp.signUpBtn).toBeVisible();
    await expect(lp.closeModalBtn).toBeVisible();
    await expect(lp.signInToggleLink).toBeVisible();
  });

  // Excel TC_02 - a real submission against a fresh Aadhaar/Email. Checks a
  // couple of Phase 1's own fields actually render, not just the page
  // title - Phase1.spec.js (a separate module) already covers Phase 1's
  // fields in depth, so this only spot-checks that the real form appeared,
  // rather than re-testing Phase 1 itself.
  test('TC_02: Sign Up succeeds with fully valid data and proceeds to the Application Form', async () => {
    await fillValidSignup(lp);
    await lp.attemptSignUp();
    await lp.validateHomePageTitle();

    const phase1 = new ITAPInterviewPerformaPage(bf.page);
    await expect(phase1.firstNamefield).toBeVisible();
    await expect(phase1.pancardField).toBeVisible();
  });

  // Excel TC_03
  test('TC_03: rejects an empty Aadhaar Number', async () => {
    await fillValidSignup(lp, { aadhaar: '' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(AADHAAR_INVALID_MSG);
  });

  // Excel TC_04
  test('TC_04: rejects an empty Email', async () => {
    await fillValidSignup(lp, { email: '' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_BLANK_MSG);
  });

  // Excel TC_05
  test('TC_05: rejects an empty New Password', async () => {
    await fillValidSignup(lp, { newPassword: '' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(PASSWORD_BLANK_MSG);
  });

  // Excel TC_06 - confirmed live (2026-09-16): a blank Confirm Password
  // alongside a filled New Password doesn't get its own distinct "blank
  // field" message - it's simply unequal to New Password, so the mismatch
  // check (same one TC_13 exercises directly) fires instead. The workbook's
  // own Actual Result column only recorded "confirmPassword aria-invalid=true"
  // with no specific message, so this refines rather than contradicts it.
  test('TC_06: rejects an empty Confirm Password', async () => {
    await fillValidSignup(lp, { confirmPassword: '' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(PASSWORD_MISMATCH_MSG);
  });

  // Excel TC_07
  test('TC_07: rejects an empty Manager Reference ID', async () => {
    await fillValidSignup(lp, { referenceId: '' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(REFID_BLANK_MSG);
  });

  // Excel TC_08
  test('TC_08: rejects a non-numeric Aadhaar Number', async () => {
    await fillValidSignup(lp, { aadhaar: 'abcdefghijkl' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(AADHAAR_INVALID_MSG);
  });

  // Excel TC_09
  test('TC_09: rejects an Aadhaar Number shorter than 12 digits', async () => {
    await fillValidSignup(lp, { aadhaar: '12345678901' }); // 11 digits
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(AADHAAR_INVALID_MSG);
  });

  // Excel TC_10 - confirmed live (2026-09-17): a malformed value like
  // "notanemail" shows the same "Official Mankind email IDs..." message as
  // an actual @mankindpharma.com address, not a distinct "invalid format"
  // one - see OFFICIAL_EMAIL_BLOCKED_MSG's own comment above.
  test('TC_10: rejects an invalid Email format', async () => {
    await fillValidSignup(lp, { email: 'notanemail' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(OFFICIAL_EMAIL_BLOCKED_MSG);
  });

  // Excel TC_11
  test('TC_11: rejects a New Password with no digit', async () => {
    await fillValidSignup(lp, { newPassword: 'Password', confirmPassword: 'Password' });
    await lp.attemptSignUp();
    const dialogText = await lp.getInfoDialogText();
    expect(dialogText).toContain(PASSWORD_POLICY_MSG);
    await lp.closeInfoDialog();
  });

  // Excel TC_12
  test('TC_12: rejects a New Password shorter than 8 characters', async () => {
    await fillValidSignup(lp, { newPassword: 'Pass1', confirmPassword: 'Pass1' });
    await lp.attemptSignUp();
    const dialogText = await lp.getInfoDialogText();
    expect(dialogText).toContain(PASSWORD_POLICY_MSG);
    await lp.closeInfoDialog();
  });

  // Excel TC_13
  test('TC_13: rejects a mismatched Confirm Password', async () => {
    await fillValidSignup(lp, { newPassword: 'Passw0rd1', confirmPassword: 'Passw0rd2' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(PASSWORD_MISMATCH_MSG);
  });

  // Excel TC_14
  test('TC_14: rejects a well-formed but unmatched Manager Reference ID', async () => {
    await fillValidSignup(lp, { referenceId: '99999999' }); // valid shape, not a real code
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(REFID_UNMATCHED_MSG);
  });

  // Excel TC_15
  test('TC_15: rejects a non-numeric Manager Reference ID', async () => {
    await fillValidSignup(lp, { referenceId: 'abcd1234' });
    await lp.attemptSignUp();
    const messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(REFID_UNMATCHED_MSG);
  });

  // Excel TC_16
  test('TC_16: requires the acknowledgment checkbox', async () => {
    await fillValidSignup(lp, { skipCheckbox: true });
    await lp.attemptSignUp();
    const dialogText = await lp.getInfoDialogText();
    expect(dialogText).toContain(CHECKBOX_REQUIRED_MSG);
    await lp.closeInfoDialog();
  });

  // Excel TC_17 - utils/SampleCandidate.js is a specific, real account
  // confirmed live (2026-09-16, by the user themselves) to already exist in
  // this environment, so a single attempt is enough to hit a duplicate
  // rejection - no idempotent "first attempt might create it" dance needed,
  // unlike a fixture that isn't guaranteed to pre-exist. Kept separate from
  // config.DuplicateTestAadhar, which tests/Candidate/SignIn.spec.js's own
  // tests still rely on and which this test doesn't touch.
  test('TC_17: rejects an already-registered Aadhaar Number', async () => {
    await fillValidSignup(lp, {
      aadhaar: SampleCandidate.aadhaar,
      email: SampleCandidate.email,
      newPassword: SampleCandidate.password,
      confirmPassword: SampleCandidate.password,
      referenceId: SampleCandidate.referenceId,
    });
    await lp.attemptSignUp();
    const dialogText = await lp.getInfoDialogText();
    expect(dialogText).toContain(DUPLICATE_AADHAAR_MSG);
    await lp.closeInfoDialog();
  });

  // Excel TC_18 - two independent payloads in one test, matching how the
  // workbook itself records this as a single case. Confirmed live
  // (2026-09-17): both payloads show the same "Official Mankind email
  // IDs..." message as an actual @mankindpharma.com address, not a distinct
  // "invalid format" one - see OFFICIAL_EMAIL_BLOCKED_MSG's own comment above.
  test('TC_18: Email field against script/SQL injection input', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => { dialogAppeared = true; await dialog.dismiss(); });

    await fillValidSignup(lp, { email: SCRIPT_PAYLOAD });
    await lp.attemptSignUp();
    let messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(OFFICIAL_EMAIL_BLOCKED_MSG);
    expect(dialogAppeared).toBe(false);
    bf.page.removeAllListeners('dialog');

    await bf.page.goto(config.CANDIDATE_URL);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
    await fillValidSignup(lp, { email: "test' OR '1'='1'@gmail.com" });
    await lp.attemptSignUp();
    messages = await lp.getVisibleValidationMessages();
    expect(messages).toContain(OFFICIAL_EMAIL_BLOCKED_MSG);
  });

  // Excel TC_19
  test('TC_19: toggles between Sign Up and Sign In modals', async () => {
    await lp.clickOn_signInToggle();
    await bf.page.waitForTimeout(1000);
    // The Sign-In form's Aadhaar field sits on the base page underneath the
    // Signup modal at all times, so asserting only that it's "visible" would
    // pass whether or not the modal actually closed - the real, meaningful
    // check is that the modal itself is gone.
    expect(await bf.page.locator("div[role='dialog']").count()).toBe(0);
    await expect(bf.page.locator("//*[@placeholder='Aadhar Number']")).toBeVisible();
  });

  // Excel TC_20
  test('TC_20: closing the Sign Up modal mid-entry and reopening it clears the form', async () => {
    await lp.enterAadhaarNumber('123456789012');
    await lp.closeSignupModal();
    await bf.page.waitForTimeout(1000);
    await lp.scrollToFirst();
    await lp.clickOn_createNewOne();
    await expect(lp.aadharNo).toHaveValue('');
  });

  // Excel TC_21
  test('TC_21: Aadhaar Number field enforces the 12-digit maximum length', async () => {
    await lp.enterAadhaarNumber('123456789012345'); // 15 digits
    await expect(lp.aadharNo).toHaveValue('123456789012');
  });

  // Excel TC_22
  test('TC_22: Manager Reference ID field enforces the 8-character maximum length', async () => {
    await lp.enter_managerRefID('ABCDEFGHIJKL'); // 12 characters
    await expect(lp.managerRefID).toHaveValue('ABCDEFGH');
  });

  // Excel TC_23
  test('TC_23: Email field accepts up to its 200-character maximum length', async () => {
    const longEmail = `${'a'.repeat(190)}@example.com`; // 202 chars total
    await lp.enter_emailId(longEmail);
    const value = await lp.emailId.inputValue();
    expect(value.length).toBe(200);
    expect(value).toBe(longEmail.slice(0, 200));
  });

  // Excel TC_24
  test('TC_24: New Password / Confirm Password fields enforce their 50-character maximum', async () => {
    const longPassword = 'Aa1@'.repeat(15); // 60 chars
    await lp.enter_newPassword(longPassword);
    await lp.enter_confirmPassword(longPassword);
    await expect(lp.newPassword).toHaveValue(longPassword.slice(0, 50));
    await expect(lp.confirmPassword).toHaveValue(longPassword.slice(0, 50));
  });

  // Excel TC_25 - confirmed live: the field does NOT trim whitespace.
  // Leading spaces count against the 12-character maxlength, so they consume
  // part of the limit and truncate the real Aadhaar digits instead of being
  // stripped - a real user pasting a number with a stray leading space would
  // silently sign up with the wrong Aadhaar.
  test('TC_25: leading whitespace in Aadhaar Number is not trimmed and silently truncates the real digits', async () => {
    await lp.enterAadhaarNumber('  723927100205  ');
    await expect(lp.aadharNo).toHaveValue('  7239271002');
  });

  // Excel TC_26
  test('TC_26: rapid double-click on Sign Up does not break the flow or leave a broken UI state', async () => {
    await fillValidSignup(lp);
    // Fire both clicks without waiting on the first - this is what a real
    // impatient double-click looks like, as opposed to two sequential
    // awaited clicks (which would just be two separate, safe actions).
    await Promise.allSettled([
      lp.signUpBtn.click({ timeout: 5000 }),
      lp.signUpBtn.click({ timeout: 5000 }),
    ]);
    await lp.validateHomePageTitle();
  });

  // Excel TC_27
  test('TC_27: browser refresh while the Sign Up modal is open does not leave a broken state', async () => {
    await lp.enterAadhaarNumber('999900001111');
    await lp.enter_emailId(config.PersonalEmailId);
    await bf.page.reload({ waitUntil: 'networkidle' });
    await expect(bf.page).toHaveTitle('Mendix - Candidate Login');
    expect(await bf.page.locator("div[role='dialog']").count()).toBe(0);
  });

  // Excel TC_28
  test('TC_28: pasting a value longer than maxlength into Aadhaar Number is still truncated', async () => {
    await bf.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await bf.page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, '12345678901234567890');

    await lp.aadharNo.click();
    await bf.page.keyboard.press('Control+A');
    await bf.page.keyboard.press('Control+V');
    await expect(lp.aadharNo).toHaveValue('123456789012');
  });

  // Excel TC_29
  test('TC_29: repeatedly toggling between Sign Up and Sign In does not stack modals or leak data', async () => {
    for (let i = 0; i < 3; i++) {
      await lp.clickOn_signInToggle();
      await bf.page.waitForTimeout(1000);
      await lp.scrollToFirst();
      await lp.clickOn_createNewOne();
      await bf.page.waitForTimeout(1000);
    }
    expect(await bf.page.locator("div[role='dialog']").count()).toBe(1);
    await expect(lp.aadharNo).toHaveValue('');
  });

  // Excel TC_31 - verifies the Sign Up modal's own fixed UI copy (header,
  // field labels, button/link text, checkbox text) plus the underlying
  // page's footer (still in the DOM behind the modal) is present and
  // correctly worded - distinct from TC_01, which only checks that the
  // form's own input/button elements are locatable, not any of their text.
  // Every string below confirmed live (2026-09-16) via a throwaway
  // Playwright probe against the actual page. beforeEach already reopens
  // the Sign Up modal fresh before this test, same as every other test here.
  test('TC_31: header, footer, and all static UI text on the Candidate Sign Up modal are correct', async () => {
    await expect(lp.headerLogo).toBeVisible();

    const text = await lp.getPageText();
    const expectedStrings = [
      'Sign Up',
      'Aadhaar Number',
      'Email',
      'New Password - Mankind ID',
      'Confirm Password - Mankind ID',
      'Manager Reference ID',
      'I acknowledge that this account is for applying to Mankind jobs. Submitting this application does not guarantee an interview, travel reimbursement, or employment.',
      'Already have an account? Sign In',
      '© Mankind@2026. All rights reserved.',
    ];
    for (const expected of expectedStrings) {
      expect(text).toContain(expected);
    }
  });
});

// Excel TC_30 - needs two concurrent sessions racing each other, so it gets
// its own describe block rather than the shared single-tab pattern above.
test.describe('Candidate Sign Up - Concurrency', () => {
  test('TC_30: concurrent Sign Up attempts with the same Aadhaar Number only let one succeed', async () => {
    const aadhar = getRandomAadhar();

    const bfA = new BrowserFactory();
    const bfB = new BrowserFactory();
    await Promise.all([
      bfA.launchBrowser(config.CANDIDATE_URL),
      bfB.launchBrowser(config.CANDIDATE_URL),
    ]);

    const lpA = new ITAP_LoginPage(bfA.page);
    const lpB = new ITAP_LoginPage(bfB.page);

    async function openAndFill(lp) {
      await lp.scrollToFirst();
      await lp.clickOn_createNewOne();
      await fillValidSignup(lp, { aadhaar: aadhar });
    }

    await Promise.all([openAndFill(lpA), openAndFill(lpB)]);

    // Submit both at nearly the same time. Confirmed live: the losing side's
    // rejection modal renders fast (a quick duplicate-check lookup), but the
    // winning side's real account creation + navigation to Phase 1 takes
    // noticeably longer - a fixed wait calibrated to the fast path caught
    // the winning session still mid-navigation, reading its title as neither
    // success nor a captured failure. Waits for each side's own actual
    // outcome (title change or rejection dialog) instead, same
    // race-the-real-outcome pattern used throughout this project.
    async function waitForOutcome(page) {
      await Promise.race([
        page.waitForFunction((title) => document.title === title, SUCCESS_TITLE, { timeout: 20000 }).catch(() => {}),
        page.locator("div[role='dialog']").filter({ hasText: 'Information' }).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {}),
      ]);
    }
    await Promise.allSettled([lpA.attemptSignUp(), lpB.attemptSignUp()]);
    await Promise.all([waitForOutcome(bfA.page), waitForOutcome(bfB.page)]);

    const [titleA, titleB] = await Promise.all([bfA.page.title(), bfB.page.title()]);
    const successCount = [titleA, titleB].filter((t) => t === SUCCESS_TITLE).length;
    expect(successCount).toBe(1);

    await bfA.closeBrowser();
    await bfB.closeBrowser();
  });
});
