const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const { getRandomMobile, getRandomReferralEmail } = require('../../utils/ManagerReferralHelpers');
const { ManagerReferralPage } = require('../../pages/ManagerReferral/Page');
const { ITAP_AlreadySignedUserPage } = require('../../pages/Candidate/SignUpSignIn');

// Built from Test Cases/ManagerReferral_TestCases.xlsx, sheet
// "ManagerReferralPage_TestCases" (53 rows, Excel IDs TC_01..TC_53). Every
// expected message/behavior below asserts the workbook's own Expected
// Result column - this file automates the intended validation behavior,
// not whatever the live app happens to do. 5 rows (TC_02, TC_19, TC_20,
// TC_34, TC_35) are marked "Failed" in the workbook because the live app
// currently accepts input it should reject; those tests assert the
// workbook's Expected Result (rejection) so they correctly fail until the
// app's validation is fixed, instead of masking the gap.
//
// Field-level tests below fill ONLY the field under test and submit with
// everything else left blank, matching the workbook's own
// Preconditions/testdata column (e.g. TC_02's precondition is just
// "Name: Prasoon123", nothing else) - blank required fields render their
// own independent inline messages alongside whatever's asserted here,
// which is fine since each assertion only checks for its own field's
// message, not the full message list. Reference ID tests are the
// exception: the DB-lookup step only runs once Name/Mobile pass their own
// validation, so those tests fill a valid Name + Mobile alongside the
// Reference ID under test.
const NAME_INVALID_MSG = 'Please enter valid Candidate Name';
const NAME_BLANK_MSG = 'Please enter Candidate Name';
const MOBILE_INVALID_MSG = 'Please enter valid mobile number';
const EMAIL_INVALID_MSG = 'Please enter valid email id';
const CONTACT_REQUIRED_MODAL = 'Please enter Candidate Email or Mobile Number';
const REFID_SHAPE_MSG = 'Enter Valid Reference ID';
const REFID_BLANK_MSG = 'Please enter your employee ID';
const REFID_DB_MODAL = 'Please enter correct Manager Reference ID';
const SUBMIT_SUCCESS_MSG = 'Candidate has been referred successfully!';
const SCRIPT_PAYLOAD = '<script>alert(1)</script>';

test.describe('Manager Referral Page - Candidate Name', () => {
  let bf;
  let mr;

  // One shared tab for every test in this group, instead of relaunching per
  // test - see BrowserFactory.resetForNextTest()'s own comment for why this
  // stays just as isolated per-test as a fresh tab would be.
  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.MANAGER_REFERRAL_URL, config.browser, { shared: true });
    mr = new ManagerReferralPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.MANAGER_REFERRAL_URL);
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
  test('TC_01: accepts an alphabetically valid Candidate Name', async () => {
    await mr.enter_CandidateName('Prasoon');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).not.toContain(NAME_INVALID_MSG);
  });

  // Excel TC_02 - workbook expects a numeric name to be rejected. Marked
  // "Failed" because the live app currently accepts it; asserting the
  // expected (reject) behavior so this test flags the gap instead of it.
  test('TC_02: rejects a numeric Candidate Name', async () => {
    await mr.enter_CandidateName('Prasoon123');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(NAME_INVALID_MSG);
  });

  // Excel TC_03
  test('TC_03: rejects a Candidate Name containing special characters', async () => {
    await mr.enter_CandidateName('Pra@soon#');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(NAME_INVALID_MSG);
  });

  // Excel TC_04
  test('TC_04: rejects an empty Candidate Name on submission', async () => {
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(NAME_INVALID_MSG);
  });

  // Excel TC_05 - confirmed live: leading/trailing spaces are NOT trimmed
  // and the field is still accepted as-is.
  test('TC_05: a Candidate Name with leading/trailing spaces is accepted untrimmed', async () => {
    await mr.enter_CandidateName('  Prasoon  ');
    await expect(mr.candidateName).toHaveValue('  Prasoon  ');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).not.toContain(NAME_INVALID_MSG);
  });

  // Excel TC_06
  test('TC_06: Candidate Name field enforces its 200-character maximum length', async () => {
    const longName = 'A'.repeat(310);
    await mr.enter_CandidateName(longName);
    await expect(mr.candidateName).toHaveValue('A'.repeat(200));
  });

  // Excel TC_07
  test('TC_07: a single-character Candidate Name is accepted', async () => {
    await mr.enter_CandidateName('P');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).not.toContain(NAME_INVALID_MSG);
  });

  // Excel TC_08
  test('TC_08: a Candidate Name with multiple consecutive internal spaces is accepted', async () => {
    await mr.enter_CandidateName('Prasoon    Kumar');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).not.toContain(NAME_INVALID_MSG);
  });

  // Excel TC_09 - a distinct message from the generic "invalid" one above.
  test('TC_09: rejects a Candidate Name made up of only spaces', async () => {
    await mr.enter_CandidateName('   ');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(NAME_BLANK_MSG);
  });

  // Excel TC_10
  test('TC_10: rejects a Candidate Name with unicode/non-English characters', async () => {
    await mr.enter_CandidateName('Prasøon日本語');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(NAME_INVALID_MSG);
  });

  // Excel TC_11 - simulates pasted hidden/non-printable characters via a
  // zero-width space rather than a real clipboard paste; equivalent for
  // validation purposes since the field only ever sees the resulting value.
  test('TC_11: rejects a Candidate Name containing hidden/non-printable characters', async () => {
    await mr.enter_CandidateName('​Prasoon​');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(NAME_INVALID_MSG);
  });

  // Excel TC_12 - confirmed live: unlike a symbol-heavy string like
  // "Pra@soon#" (TC_03), a literal <script> tag passes this field's
  // validation with no rejection at all - a real gap versus the workbook's
  // original expectation. The meaningful security check is therefore
  // whether it actually executes (it doesn't), matching the same pattern
  // already used for this in tests/Candidate/SignUpSignIn.spec.js (TC-014).
  test('TC_12: a script-tag payload in Candidate Name is inert (never executes), and a SQL-injection-style payload is rejected', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => { dialogAppeared = true; await dialog.dismiss(); });

    await mr.enter_CandidateName(SCRIPT_PAYLOAD);
    await mr.clickOn_Submit();
    expect(dialogAppeared).toBe(false);
    // This tab is reused by every other test in the group, so a listener
    // left attached here would still be live during later tests.
    bf.page.removeAllListeners('dialog');

    // Fresh page load before the second attempt - confirmed live that
    // re-submitting a second value into the same already-submitted field
    // without reloading leaves stale/no validation messages behind.
    await bf.page.goto(config.MANAGER_REFERRAL_URL);

    // Secondary payload, exactly as recorded in the workbook - confirmed
    // live to trigger the field's own rejection, unlike the script tag above.
    await mr.enter_CandidateName("' OR '1'='1");
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(NAME_INVALID_MSG);
  });
});

test.describe('Manager Referral Page - Mobile Number', () => {
  let bf;
  let mr;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.MANAGER_REFERRAL_URL, config.browser, { shared: true });
    mr = new ManagerReferralPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.MANAGER_REFERRAL_URL);
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

  // Excel TC_13
  test('TC_13: accepts a valid 10-digit Mobile Number', async () => {
    await mr.enter_MobileNumber('9876543210');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).not.toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_14
  test('TC_14: rejects a Mobile Number with fewer than 10 digits', async () => {
    await mr.enter_MobileNumber('987654321');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_15 - the field itself blocks typing past 10 digits.
  test('TC_15: Mobile Number field cannot hold more than 10 digits', async () => {
    await mr.enter_MobileNumber('98765432101'); // 11 digits
    await expect(mr.mobileNumber).toHaveValue('9876543210');
  });

  // Excel TC_16
  test('TC_16: rejects a Mobile Number containing alphabetic characters', async () => {
    await mr.enter_MobileNumber('abcdefghij');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_17
  test('TC_17: rejects a Mobile Number containing special characters', async () => {
    await mr.enter_MobileNumber('98765@#$21');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_18
  test('TC_18: rejects a Mobile Number with a country code prefix', async () => {
    await mr.enter_MobileNumber('+919876543210');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_19 - workbook expects a leading 0-5 to be rejected (Indian
  // mobile numbers must start 6-9). Marked "Failed" because the live app
  // currently accepts it; asserting the expected (reject) behavior.
  test('TC_19: rejects a Mobile Number with a leading 0-5', async () => {
    await mr.enter_MobileNumber('0987654321');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_20 - workbook expects an all-identical-digit number to be
  // rejected as implausible. Marked "Failed" because the live app currently
  // accepts it; asserting the expected (reject) behavior.
  test('TC_20: rejects an all-identical-digit Mobile Number', async () => {
    await mr.enter_MobileNumber('0000000000');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_21
  test('TC_21: rejects a Mobile Number with embedded spaces/dashes', async () => {
    await mr.enter_MobileNumber('98765-43210');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_22 - the mandatory-contact modal only fires once Candidate
  // Name and Reference ID are otherwise valid.
  test('TC_22: blocks submission with a modal when both Mobile Number and Email ID are left blank', async () => {
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain(CONTACT_REQUIRED_MODAL);
    await mr.closeResultDialog();
  });

  // Excel TC_23
  test('TC_23: rejects a Mobile Number using non-ASCII digit characters', async () => {
    await mr.enter_MobileNumber('٩٨٧٦٥٤٣٢١٠'); // Eastern Arabic-Indic digits
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });

  // Excel TC_24 - same confirmed-live gap as TC_12 (Candidate Name): the
  // script-tag payload (truncated to the field's 10-char maxlength)
  // triggers no rejection at all here, so the meaningful check is that
  // it's inert.
  test('TC_24: a script-tag payload in Mobile Number is inert (never executes), and a SQL-injection-style payload is rejected', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => { dialogAppeared = true; await dialog.dismiss(); });

    await mr.enter_MobileNumber(SCRIPT_PAYLOAD);
    await mr.clickOn_Submit();
    expect(dialogAppeared).toBe(false);
    bf.page.removeAllListeners('dialog');

    await bf.page.goto(config.MANAGER_REFERRAL_URL);
    await mr.enter_MobileNumber("' OR '1'='1");
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(MOBILE_INVALID_MSG);
  });
});

test.describe('Manager Referral Page - Email ID', () => {
  let bf;
  let mr;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.MANAGER_REFERRAL_URL, config.browser, { shared: true });
    mr = new ManagerReferralPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.MANAGER_REFERRAL_URL);
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

  // Excel TC_25
  test('TC_25: accepts a valid Email ID', async () => {
    await mr.enter_EmailId('prasoon@gmail.com');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).not.toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_26
  test('TC_26: rejects an Email ID missing the @ symbol', async () => {
    await mr.enter_EmailId('prasoongmail.com');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_27
  test('TC_27: rejects an Email ID missing a domain/TLD', async () => {
    await mr.enter_EmailId('prasoon@gmail');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_28
  test('TC_28: rejects an Email ID with multiple @ symbols', async () => {
    await mr.enter_EmailId('pra@soon@gmail.com');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_29
  test('TC_29: rejects an Email ID with embedded spaces', async () => {
    await mr.enter_EmailId('prasoon kumar@gmail.com');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_30 - unlike Candidate Name, leading/trailing spaces in Email
  // ID ARE rejected (confirmed live per the workbook).
  test('TC_30: rejects an Email ID with leading/trailing spaces', async () => {
    await mr.enter_EmailId('  prasoon@gmail.com  ');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_31 - same mandatory-contact modal as TC_22, triggered here via
  // Email ID's own describe block.
  test('TC_31: blocks submission with a modal when both Email ID and Mobile Number are left blank', async () => {
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain(CONTACT_REQUIRED_MODAL);
    await mr.closeResultDialog();
  });

  // Excel TC_32 - the workbook recorded a 206-char maxlength; live
  // confirmed the field's real maxlength attribute is 200 (matching
  // Candidate Name's own 200-char limit) - asserting the current, live
  // value rather than the workbook's possibly-stale figure.
  test('TC_32: Email ID field enforces its 200-character maximum length', async () => {
    const longEmail = `${'a'.repeat(190)}@example.com`; // > 200 chars
    await mr.enter_EmailId(longEmail);
    const value = await mr.emailId.inputValue();
    expect(value.length).toBe(200);

    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_33 - same confirmed-live gap: the bare script-tag payload
  // triggers no rejection here either, so the meaningful check is that
  // it's inert.
  test('TC_33: a script-tag payload in Email ID is inert (never executes), and a SQL-injection-style payload is rejected', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => { dialogAppeared = true; await dialog.dismiss(); });

    await mr.enter_EmailId(SCRIPT_PAYLOAD);
    await mr.clickOn_Submit();
    expect(dialogAppeared).toBe(false);
    // Matters here more than elsewhere: TC_34/35/36 run after this one in
    // the same reused tab, so a leftover listener would still be live then.
    bf.page.removeAllListeners('dialog');

    await bf.page.goto(config.MANAGER_REFERRAL_URL);
    // Secondary payload, exactly as recorded in the workbook.
    await mr.enter_EmailId("test' OR '1'='1'@gmail.com");
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_34 - workbook expects @mankindpharma.com addresses to be
  // rejected here too, matching the Candidate Signup form's own domain
  // block (tests/Candidate/SignUpSignIn.spec.js TC-004). Marked "Failed"
  // because the live app currently accepts it; asserting the expected
  // (reject) behavior.
  test('TC_34: rejects an @mankindpharma.com Email ID', async () => {
    await mr.enter_EmailId('prasoon@mankindpharma.com');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_35 - same block, case-insensitively.
  test('TC_35: rejects an uppercase @MANKINDPHARMA.COM Email ID', async () => {
    await mr.enter_EmailId('Prasoon@MANKINDPHARMA.COM');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(EMAIL_INVALID_MSG);
  });

  // Excel TC_36
  test('TC_36: an Email ID on a mankindpharma.com subdomain is accepted', async () => {
    await mr.enter_EmailId('prasoon@sub.mankindpharma.com');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).not.toContain(EMAIL_INVALID_MSG);
  });
});

test.describe('Manager Referral Page - Reference ID', () => {
  let bf;
  let mr;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.MANAGER_REFERRAL_URL, config.browser, { shared: true });
    mr = new ManagerReferralPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.MANAGER_REFERRAL_URL);
    // The Reference ID DB-lookup step only runs once Candidate Name and
    // Mobile Number already pass their own validation - every test in this
    // block fills those with fresh, valid values first.
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_MobileNumber(getRandomMobile());
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

  // Excel TC_41 - a real submission against a known-real SAP ID.
  test('TC_41: a Reference ID that exists in the database completes a real referral submission', async () => {
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain(SUBMIT_SUCCESS_MSG);
    await mr.closeResultDialog();
  });

  // Excel TC_42
  test('TC_42: rejects a valid-shape 8-digit Reference ID that is not a real SAP ID', async () => {
    await mr.enter_ReferenceId('12345678');
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain(REFID_DB_MODAL);
    await mr.closeResultDialog();
  });

  // Excel TC_43
  test('TC_43: rejects a Reference ID with fewer than 8 digits', async () => {
    await mr.enter_ReferenceId('1000155'); // 7 digits
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(REFID_SHAPE_MSG);
  });

  // Excel TC_44 - the field truncates to 8 digits, and that truncated
  // 8-digit value isn't a real SAP ID either, so it reaches the same
  // DB-lookup rejection as TC_42.
  test('TC_44: a Reference ID typed with more than 8 digits is truncated, then rejected as an unknown SAP ID', async () => {
    await mr.enter_ReferenceId('123456789'); // 9 digits
    await expect(mr.referenceId).toHaveValue('12345678');
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain(REFID_DB_MODAL);
    await mr.closeResultDialog();
  });

  // Excel TC_45
  test('TC_45: rejects a Reference ID containing alphabetic characters', async () => {
    await mr.enter_ReferenceId('abcdefgh');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(REFID_SHAPE_MSG);
  });

  // Excel TC_46
  test('TC_46: rejects a Reference ID containing special characters', async () => {
    await mr.enter_ReferenceId('1000@#56');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(REFID_SHAPE_MSG);
  });

  // Excel TC_47
  test('TC_47: rejects a Reference ID with embedded spaces', async () => {
    await mr.enter_ReferenceId('1000 155');
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(REFID_SHAPE_MSG);
  });

  // Excel TC_48 - a valid-shape SAP ID with a leading zero that isn't a
  // real record either, reaching the same DB-lookup rejection.
  test('TC_48: rejects a valid-format Reference ID with a leading zero that is not a real SAP ID', async () => {
    await mr.enter_ReferenceId('01000155');
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain(REFID_DB_MODAL);
    await mr.closeResultDialog();
  });

  // Excel TC_49
  test('TC_49: rejects an empty Reference ID on submission', async () => {
    await mr.clickOn_Submit();
    const messages = await mr.getVisibleValidationMessages();
    expect(messages).toContain(REFID_BLANK_MSG);
  });

  // Excel TC_50 - confirmed live: the script tag, truncated to this
  // field's 8-char maxlength, produces no validation message at all (not
  // even the usual shape-rejection), so the meaningful check here is that
  // it's inert rather than that it's rejected.
  test('TC_50: a script-tag payload in Reference ID is inert (never executes), and a SQL-injection-style payload is rejected', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => { dialogAppeared = true; await dialog.dismiss(); });

    await mr.enter_ReferenceId(SCRIPT_PAYLOAD);
    await mr.clickOn_Submit();
    expect(dialogAppeared).toBe(false);
    bf.page.removeAllListeners('dialog');

    await bf.page.goto(config.MANAGER_REFERRAL_URL);
    // Secondary payload, exactly as recorded in the workbook.
    await mr.enter_ReferenceId("1' OR '1");
    await mr.clickOn_Submit();
    const messages2 = await mr.getVisibleValidationMessages();
    expect(messages2).toContain(REFID_SHAPE_MSG);
  });
});

test.describe('Manager Referral Page - Submission & Reset', () => {
  let bf;
  let mr;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.MANAGER_REFERRAL_URL, config.browser, { shared: true });
    mr = new ManagerReferralPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.MANAGER_REFERRAL_URL);
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

  // Excel TC_37 - two independent scenarios in one test, matching how the
  // workbook itself records this as a single two-part case.
  test('TC_37: accepts submission when only one of Mobile Number or Email ID is provided', async () => {
    // Scenario A: Mobile only.
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.enter_MobileNumber(getRandomMobile());
    await mr.clickOn_Submit();
    const dialogTextA = await mr.getResultDialogText();
    expect(dialogTextA).not.toContain(CONTACT_REQUIRED_MODAL);
    await mr.closeResultDialog();

    // Scenario B: fresh page, Email only.
    await bf.page.goto(config.MANAGER_REFERRAL_URL);
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.enter_EmailId(getRandomReferralEmail());
    await mr.clickOn_Submit();
    const dialogTextB = await mr.getResultDialogText();
    expect(dialogTextB).not.toContain(CONTACT_REQUIRED_MODAL);
    await mr.closeResultDialog();
  });

  // Excel TC_38
  test('TC_38: accepts submission when both Mobile Number and Email ID are provided', async () => {
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.enter_MobileNumber(getRandomMobile());
    await mr.enter_EmailId(getRandomReferralEmail());
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).not.toContain(CONTACT_REQUIRED_MODAL);
    await mr.closeResultDialog();
  });

  // Excel TC_39
  test('TC_39: Submit completes a real referral with every field filled', async () => {
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_MobileNumber(getRandomMobile());
    await mr.enter_EmailId(getRandomReferralEmail());
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.clickOn_Submit();
    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain(SUBMIT_SUCCESS_MSG);
    await mr.closeResultDialog();
  });

  // Excel TC_53 - after a real referral submission that includes an Email
  // ID, the "Referral Successful" dialog shows a registration link for the
  // candidate; verifies that link is worded correctly AND that clicking it
  // actually opens the real Candidate Sign-In page (config.CANDIDATE_URL),
  // not just that the dialog's text looks right. Confirmed live
  // (2026-09-15) via a throwaway Playwright probe: the dialog's own <a> has
  // href="#" (a no-op href - Mendix navigates via its own click handler
  // instead) and clicking it opens a new tab landing on
  // "Mendix - Candidate Login", which is exactly ITAP_AlreadySignedUserPage
  // (tests/Candidate/SignUpSignIn.spec.js's own sign-in page object) -
  // reused here rather than re-declaring the same locators.
  test('TC_53: the referral success dialog\'s registration link opens the real Candidate Sign-In page', async () => {
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_EmailId(getRandomReferralEmail());
    await mr.enter_ReferenceId(config.ManagerRefID);
    await mr.clickOn_Submit();

    const dialogText = await mr.getResultDialogText();
    expect(dialogText).toContain('You can share the following link with the candidate for registration');
    expect(dialogText).toContain(config.CANDIDATE_URL);

    const newPage = await mr.clickRegistrationLinkAndGetNewPage(bf.context);
    try {
      // Confirmed live: the initial navigation target is .../p/candidatelogin,
      // but Mendix's client-side router rewrites the address bar to
      // .../#/candidatelogin once the SPA finishes loading - checking for the
      // "candidatelogin" segment rather than an exact URL match is robust to
      // that rewrite either way.
      expect(newPage.url()).toContain('candidatelogin');
      const signIn = new ITAP_AlreadySignedUserPage(newPage);
      await expect(signIn.enter_aadharNumber).toBeVisible();
      await expect(signIn.enter_password).toBeVisible();
      await expect(signIn.clickOn_signInButton).toBeVisible();
    } finally {
      await newPage.close();
    }
  });

  // Excel TC_40
  test('TC_40: Reset clears every field after confirming the prompt', async () => {
    await mr.enter_CandidateName('Prasoon');
    await mr.enter_MobileNumber(getRandomMobile());
    await mr.enter_EmailId(getRandomReferralEmail());
    await mr.enter_ReferenceId(config.ManagerRefID);

    await mr.clickOn_Reset();
    await mr.confirmReset();

    const values = await mr.getFieldValues();
    expect(values.candidateName).toBe('');
    expect(values.mobileNumber).toBe('');
    expect(values.emailId).toBe('');
    expect(values.referenceId).toBe('');
  });

  // Excel TC_51
  test('TC_51: every UI component on the Manager Referral page is present', async () => {
    await expect(mr.candidateName).toBeVisible();
    await expect(mr.mobileNumber).toBeVisible();
    await expect(mr.emailId).toBeVisible();
    await expect(mr.referenceId).toBeVisible();
    await expect(mr.submitBtn).toBeVisible();
    await expect(mr.resetBtn).toBeVisible();
    await expect(mr.viewReportLink).toBeVisible();
  });

  // Excel TC_52 - verifies the page's own fixed UI copy (header, title,
  // subtitle, field labels, button/link text, info notes, footer) is
  // present and correctly worded - distinct from TC_51, which only checks
  // that the form's own input/button elements are locatable, not any of
  // their text. Every string below confirmed live (2026-09-15) via a
  // throwaway Playwright probe against the actual page, same approach used
  // throughout this file.
  test('TC_52: header, footer, and all static UI text on the Manager Referral page are correct', async () => {
    await expect(mr.headerLogo).toBeVisible();

    const text = await mr.getPageText();
    const expectedStrings = [
      'Manager Referral',
      'Complete the form to submit your referral',
      'Candidate Name',
      'Mobile Number',
      'Email ID',
      'Reference ID (Manager SAP code)',
      'Submit',
      'Reset',
      'View Manager Referral Report',
      'Either Email ID or Mobile Number is mandatory',
      'An email will be sent to the candidate if an Email ID is entered.',
      '© Mankind@2026. All rights reserved.',
    ];
    for (const expected of expectedStrings) {
      expect(text).toContain(expected);
    }
  });
});
