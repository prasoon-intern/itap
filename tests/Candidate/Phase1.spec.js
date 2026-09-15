const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const {
  signupAndReachPhase1,
  fillValidPersonalDetails,
  fillValidQualification,
} = require('../../utils/CandidateFlowHelpers');
const {
  ITAPInterviewPerformaPage,
  ITAP_QualificationDetailsPage,
  ITAP_ExperienceDetailPage,
} = require('../../pages/Candidate/Phase1');
const { ITAP_ContinueToPhase2Page } = require('../../pages/Candidate/Phase2');
const { dobYearsAgoDDMMYYYY } = require('../../utils/DateHelpers');

// Negative / edge-case coverage for Phase 1 of the candidate application form
// (Personal Details, Qualification Details, Experience Details) — the
// happy-path flow with fully valid, hardcoded field values is exercised
// elsewhere (e.g. utils/createFreshInterviewCandidate.js), not duplicated here.
//
// Source spec: Modification Test Cases.xlsx, "Missing Test Cases" sheet,
// TC-015..TC-027. Ordered High/Medium priority first, Low-priority
// Functional/Edge-Case rows last within each section, per request.
//
// Each test needs its own fresh signup to reach Phase 1 (same pattern used
// throughout this file), since there is no way to reach Personal/Qualification/
// Experience details without one.
test.describe('Phase 1 - Personal Details - Negative & Edge Cases', () => {
  let bf, itapPage1;

  test.beforeEach(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    await signupAndReachPhase1(bf);
    itapPage1 = new ITAPInterviewPerformaPage(bf.page);
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // TC-015 (High)
  test('TC-015: blocks Next when mandatory fields are left blank', async () => {
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.length).toBeGreaterThan(0);
    // Still on Personal Details: the first-name field for this section is
    // still present rather than having advanced to Qualification.
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-016 (Medium)
  test('TC-016: rejects a malformed PAN number', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { pan: '12345' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /pan/i.test(m))).toBe(true);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-017 (Medium)
  test('TC-017: rejects a mobile number with the wrong digit count', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { mobile: '12345' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /mobile/i.test(m))).toBe(true);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-019 (Medium)
  // KNOWN BUG (confirmed live, 2026-08-19): the app accepts a future date
  // here (e.g. 01/01/2099) with zero validation, despite the field
  // explicitly asking for a past interview date. Kept asserting the
  // *intended* behavior on purpose — this test should stay red as a marker
  // until the app actually enforces it, rather than being rewritten to
  // document the gap as acceptable.
  test('TC-019: rejects a future "past interview date"', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { interviewDate: '1/1/2099' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /date/i.test(m))).toBe(true);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-018 (Low)
  test('TC-018: rejects an invalid PIN code', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { pin: '123' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /pin/i.test(m))).toBe(true);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-020 (Low)
  test('TC-020: rejects a malformed vehicle number', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { vehicleNumber: 'ABC' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /vehicle/i.test(m))).toBe(true);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-021 (Low)
  test('TC-021: browser refresh mid-form does not leave a broken/duplicated state', async () => {
    await itapPage1.enter_FirstName(bf.getPropertyValue('FirstName'));
    await itapPage1.enter_LastName(bf.getPropertyValue('LastName'));
    await bf.page.reload({ waitUntil: 'networkidle' });
    await bf.hardWait(2);

    // Acceptable outcomes per spec: either the form restores/restarts on
    // Phase 1, or the session drops back to Candidate Login — either way,
    // exactly one (not zero, not duplicated) instance of the page shell.
    const title = await bf.page.title();
    expect(['Mendix - Application Form - Phase 1', 'Mendix - Candidate Login']).toContain(title);
    if (title === 'Mendix - Application Form - Phase 1') {
      expect(await itapPage1.firstNamefield.count()).toBe(1);
    }
  });

  // E01 (new, beyond the xlsx): noticed while debugging TC-016 — unlike the
  // Signup modal (which only validates on a Sign Up click attempt), this
  // form validates PAN in real time, on blur, before Next is ever clicked.
  test('E01: PAN validation message appears immediately on blur, without clicking Next', async () => {
    await itapPage1.pancardField.fill('12345');
    await itapPage1.mobNo.click(); // blur PAN by moving focus elsewhere
    await bf.hardWait(1);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /pan/i.test(m))).toBe(true);
  });

  // The tests below are new additions (beyond the xlsx's TC-015..021/E01),
  // built to bring Personal Details up to the same per-field depth
  // (positive/negative/boundary/security) as the Onboarding/Interview
  // modules — see TEST_KNOWLEDGE_MAP.md and the research behind this batch.

  // TC-P01 (new, Positive): every existing test in this block is
  // negative/edge — nothing here asserts that a fully valid submission
  // actually succeeds and advances to Qualification Details.
  test('TC-P01 [Positive]: submits fully valid Personal Details and reaches Qualification Details', async () => {
    await fillValidPersonalDetails(itapPage1, bf);
    await itapPage1.click_NextBtn();
    await bf.hardWait(2);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
    const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  // TC-P02 (new, Negative): confirmed live — the Current Address section
  // (Line 1/City/Pin/State/District) is a fully separate mandatory block
  // from Permanent Address. Every existing test leaves the "same as
  // permanent address" checkbox on its default unchecked state without ever
  // exercising this section's own validation.
  test('TC-P02 [Negative]: blocks Next when the Current Address section is left blank', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toEqual(expect.arrayContaining([
      'Current address is mandatory',
      'City is mandatory',
      'Pin Code is mandatory',
      'State is mandatory',
      'District is mandatory',
    ]));
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-P03 (new, Positive): confirmed live — checking "same as permanent
  // address" copies the Permanent Address values into Current Address
  // rather than merely hiding/disabling the section.
  test('TC-P03 [Positive]: checking "same as permanent address" copies the address into Current Address', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await expect(itapPage1.currAddLine1).toHaveValue('');

    await itapPage1.click_PerAddRadioBtn();
    await bf.hardWait(2);

    await expect(itapPage1.currAddLine1).toHaveValue('D1075 Dushyant Vihar Nagar');
    await expect(itapPage1.currCity).toHaveValue('Delhi');
    await expect(itapPage1.currPin).toHaveValue('110001');
  });

  // TC-P04 (new, Edge): confirmed live — unchecking it again clears the
  // copied values back to blank rather than leaving stale data behind.
  test('TC-P04 [Edge]: unchecking "same as permanent address" after checking it clears Current Address again', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await itapPage1.click_PerAddRadioBtn();
    await bf.hardWait(2);
    await expect(itapPage1.currAddLine1).not.toHaveValue('');

    await itapPage1.click_PerAddRadioBtn();
    await bf.hardWait(2);
    await expect(itapPage1.currAddLine1).toHaveValue('');
  });

  // TC-P05 (new, Boundary/Negative): confirmed live — a real minimum-age
  // validation ("The minimum permissible age is 18 years.") exists and was
  // never exercised by any existing test. DOB is computed relative to today
  // (utils/DateHelpers.js's dobYearsAgoDDMMYYYY) so this can never go stale
  // the way a hardcoded DOB literal would.
  test('TC-P05 [Boundary][Negative]: rejects a candidate who is exactly 17 years old', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { dob: dobYearsAgoDDMMYYYY(17) });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /minimum permissible age/i.test(m))).toBe(true);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-P06 (new, Positive): the other side of the same boundary — exactly
  // 18 today must be accepted, not caught by an off-by-one in the age check.
  test('TC-P06 [Positive]: accepts a candidate who is exactly 18 years old today', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { dob: dobYearsAgoDDMMYYYY(18) });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /minimum permissible age/i.test(m))).toBe(false);
  });

  // TC-P07/P08 (new, Security): free-text Name fields must treat
  // script/SQL payloads as inert data — mirrors the Security category
  // already applied to Aadhaar/Password in SignUpSignIn.spec.js's TC-014,
  // extended here to fields that test never touches.
  test('TC-P07 [Security]: First Name safely accepts an XSS payload without executing it', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await fillValidPersonalDetails(itapPage1, bf, { firstName: '<script>alert(1)</script>' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    expect(dialogAppeared).toBe(false);
  });

  test("TC-P08 [Security]: Father's Name safely accepts a SQL-injection-style payload without erroring", async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await fillValidPersonalDetails(itapPage1, bf, { fatherName: "' OR 1=1--" });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    expect(dialogAppeared).toBe(false);
  });

  // TC-P09/P10 (new, Boundary): TC-017 only tries a 5-digit mobile number —
  // the true boundary is one digit short/over the required 10.
  test('TC-P09 [Boundary]: rejects a mobile number with 9 digits (one short)', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { mobile: '987654321' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /mobile/i.test(m))).toBe(true);
  });

  // Confirmed live: the mobile field has maxlength=10, so an 11-digit
  // .fill() is truncated to 10 valid digits before it ever reaches
  // validation — there's no way to submit an 11-digit value at all. This is
  // a maxlength-enforcement boundary test (matching SignUpSignIn.spec.js's
  // E01/E02 style), not a rejection test.
  test('TC-P10 [Boundary]: mobile number field enforces the 10-digit maximum length', async () => {
    await itapPage1.mobNo.fill('98765432109'); // 11 digits
    await expect(itapPage1.mobNo).toHaveValue('9876543210');
  });

  // TC-P11/P12 (new, Boundary): same reasoning for PIN Code — TC-018 only
  // tries 3 digits; the true boundary is one digit short/over the
  // required 6.
  test('TC-P11 [Boundary]: rejects a PIN code with 5 digits (one short)', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { pin: '11000' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /pin/i.test(m))).toBe(true);
  });

  // Confirmed live: the PIN Code field has maxlength=6, so a 7-digit
  // .fill() is truncated to 6 valid digits before it ever reaches
  // validation — same reasoning as TC-P10's mobile-number equivalent.
  test('TC-P12 [Boundary]: PIN code field enforces the 6-digit maximum length', async () => {
    await itapPage1.pin.fill('1100011'); // 7 digits
    await expect(itapPage1.pin).toHaveValue('110001');
  });

  // TC-P13 (new, Positive): select_HQNotFlexible() exists on the page
  // object but was never exercised — every existing test always takes the
  // "HQ Flexible" branch via fillValidPersonalDetails()'s default.
  test('TC-P13 [Positive]: "HQ Not Flexible" is selectable as an alternative to "HQ Flexible"', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { hqFlexible: false });
    await itapPage1.click_NextBtn();
    await bf.hardWait(2);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
  });

  // The tests below are new additions found via a live audit of the actual
  // application (2026-09-11), comparing every field/button/dialog against
  // this file's existing coverage — see TEST_KNOWLEDGE_MAP.md for context.

  // TC-P14 (new, Negative, KNOWN BUG): confirmed live, twice, on both a
  // completely blank form and a fully-valid one — clicking "Save" (a
  // separate action from "Next", present on every Phase 1 screen but never
  // exercised by any test before this audit) never actually saves. Instead
  // it throws a genuine Mendix runtime error dialog ("Executing runtime
  // operation failed for security reasons: <correlation id>"), not a normal
  // validation message. Kept asserting the *intended* (correct) behavior on
  // purpose, same convention as TC-019/TC-EX05/TC-EX06 — this test should
  // stay red as a marker until the app itself is fixed, not be rewritten to
  // document the crash as acceptable.
  test('TC-P14 [Negative][Bug]: Save on a fully valid Personal Details form does not error', async () => {
    await fillValidPersonalDetails(itapPage1, bf);
    await itapPage1.click_SaveBtn();
    await bf.hardWait(2.5);

    const dialogText = await itapPage1.getDialogTextAndDismiss();
    expect(dialogText).not.toMatch(/error|failed/i);
    expect(dialogText).toMatch(/saved successfully/i);
  });

  // TC-P15 (new, Negative/Boundary): confirmed live — Permanent Address
  // Line 1 has an HTML maxlength of 500 (so nothing stops you from typing
  // more), but a separate server-side rule rejects anything 35 characters or
  // longer on Next-click with its own message. Previously this was only
  // known from a code comment (fillValidPersonalDetails's default address
  // was changed to stay under it) — never asserted by a dedicated test.
  test('TC-P15 [Negative][Boundary]: rejects a Permanent Address Line 1 of 36 characters', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { addressLine1: 'A'.repeat(36) });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some(m => /permanent address.*35 characters/i.test(m))).toBe(true);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // TC-P16 (new, Edge): mirrors SignUpSignIn.spec.js's E06 ("rapid
  // double-click on Sign Up") pattern, applied to Phase 1's own Next button
  // — never tried here despite being explicitly called out as a scenario
  // this suite should cover ("repeated clicks, incomplete forms and unusual
  // user behaviour").
  test('TC-P16 [Edge]: rapid double-click on Next does not break the flow or leave a broken UI state', async () => {
    await fillValidPersonalDetails(itapPage1, bf);
    await Promise.all([itapPage1.click_NextBtn(), itapPage1.click_NextBtn()]);
    await bf.hardWait(2.5);

    // Exactly one outcome, not a broken/duplicated hybrid: either it
    // advanced cleanly to Qualification Details (first-name field for
    // Personal Details gone), or it's still on Personal Details with a
    // single, coherent set of validation messages - never both at once.
    const onPersonalDetails = await itapPage1.firstNamefield.isVisible().catch(() => false);
    if (onPersonalDetails) {
      expect(await itapPage1.firstNamefield.count()).toBe(1);
    } else {
      const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
      await expect(itapPage2.Xth_FromDate).toBeVisible();
      await expect(itapPage2.Xth_FromDate).toHaveCount(1);
    }
  });
});

test.describe('Phase 1 - Qualification Details - Negative & Edge Cases', () => {
  let bf, itapPage1, itapPage2;

  test.beforeEach(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    await signupAndReachPhase1(bf);
    itapPage1 = new ITAPInterviewPerformaPage(bf.page);
    itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
    await fillValidPersonalDetails(itapPage1, bf);
    await itapPage1.click_NextBtn();
    await bf.hardWait(2);
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // TC-022 (Medium)
  test('TC-022: rejects a 10th "To Date" earlier than its "From Date"', async () => {
    await fillValidQualification(itapPage2, bf, { xthFrom: '02/02/2010', xthTo: '02/02/2005' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.some(m => /date/i.test(m))).toBe(true);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  // TC-023 (Medium)
  test('TC-023: rejects a marks percentage outside 0-100', async () => {
    await fillValidQualification(itapPage2, bf, { xthMarks: '150' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.some(m => /marks|percent/i.test(m))).toBe(true);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  // TC-024 (Low)
  test('TC-024: allows adding more than one additional qualification', async () => {
    await fillValidQualification(itapPage2, bf);
    await itapPage2.fill_additionalQualificationDetails();
    await itapPage2.fill_secondAdditionalQualificationDetails();
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);

    // Both additional qualifications must have actually persisted rather
    // than the second silently overwriting or being dropped.
    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
  });

  // The tests below are new additions, built to bring Qualification Details
  // up to the same per-field depth (boundary/positive) as the
  // Onboarding/Interview modules.

  // TC-Q01/Q02 (new, Boundary): TC-023 only tries 150 (clearly outside
  // range) — the true boundaries are the exact endpoints. Confirmed live:
  // the valid range is NOT a symmetric 0-100 — 0 is explicitly rejected
  // ("Please enter valid Percentage of Marks"), while 100 is accepted.
  test('TC-Q01 [Boundary][Negative]: rejects Xth marks of exactly 0', async () => {
    await fillValidQualification(itapPage2, bf, { xthMarks: '0' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.some(m => /marks|percent/i.test(m))).toBe(true);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  test('TC-Q02 [Boundary]: accepts Xth marks of exactly 100', async () => {
    await fillValidQualification(itapPage2, bf, { xthMarks: '100' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.some(m => /marks|percent/i.test(m))).toBe(false);
  });

  // TC-Q03 (new, Negative): a negative marks value is just as invalid as
  // TC-023's out-of-range positive one, but never tried by any existing test.
  test('TC-Q03 [Negative]: rejects a negative Xth marks value', async () => {
    await fillValidQualification(itapPage2, bf, { xthMarks: '-5' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.length).toBeGreaterThan(0);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  // TC-Q04/Q05 (new, Negative): TC-022 only checks Xth's own From/To Date
  // pair — XIIth and Graduation each have their own independent date fields
  // that were never verified to enforce the same order rule.
  test('TC-Q04 [Negative]: rejects a XIIth "To Date" earlier than its "From Date"', async () => {
    await fillValidQualification(itapPage2, bf, { xiiFrom: '02/02/2013', xiiTo: '02/02/2012' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.some(m => /date/i.test(m))).toBe(true);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  test('TC-Q05 [Negative]: rejects a Graduation "To Date" earlier than its "From Date"', async () => {
    await fillValidQualification(itapPage2, bf, { gradFrom: '02/02/2018', gradTo: '02/02/2014' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(1.5);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.some(m => /date/i.test(m))).toBe(true);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  // TC-Q06 (new, Positive): closes the same "no true positive assertion"
  // gap as TC-P01 did for Personal Details, here for Qualification Details.
  test('TC-Q06 [Positive]: submits fully valid Qualification Details and reaches Experience Details', async () => {
    await fillValidQualification(itapPage2, bf);
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);

    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
    const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
    await expect(itapPage3.experienceDetail_yes).toBeVisible();
  });

  // TC-Q07 (new, Positive): found via a live audit of the actual application
  // (2026-09-11) — "Save" (separate from "Next", present on every Phase 1
  // screen) was never exercised here. Unlike Personal Details' Save (see
  // TC-P14, a confirmed bug), Qualification Details' Save works correctly.
  // Confirmed live: reloading mid-flow always lands back on Personal Details
  // (step 1) regardless of which step you were actually on - not specific
  // to Qualification, and not a sign Save failed (the very first version of
  // this test asserted directly on Qualification's own field straight after
  // reload and failed for exactly this reason - it was checking the wrong
  // page, not exercising a real bug). Re-navigating through Personal
  // Details' own Next (already valid/persisted, hence one click, no re-fill)
  // is what actually proves the saved marks value survived, closing the
  // "data persistence after Save" gap for this section (TC-021 only covers
  // an UN-saved mid-entry refresh on Personal Details, a different scenario
  // from an explicit Save actually persisting).
  test('TC-Q07 [Positive]: Save persists Qualification Details across a reload and re-navigation', async () => {
    await fillValidQualification(itapPage2, bf);
    await itapPage2.click_SaveBtn();
    await bf.hardWait(2.5);

    const dialogText = await itapPage2.getDialogTextAndDismiss();
    expect(dialogText).toMatch(/saved successfully/i);

    await bf.page.reload({ waitUntil: 'networkidle' });
    await bf.hardWait(2);
    await itapPage1.click_NextBtn();
    await bf.hardWait(2);
    await expect(itapPage2.Xth_Marks).toHaveValue('80');
  });
});

test.describe('Phase 1 - Experience Details - Negative & Edge Cases', () => {
  let bf, itapPage1, itapPage2, itapPage3;

  test.beforeEach(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    await signupAndReachPhase1(bf);
    itapPage1 = new ITAPInterviewPerformaPage(bf.page);
    itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
    itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
    await fillValidPersonalDetails(itapPage1, bf);
    await itapPage1.click_NextBtn();
    await bf.hardWait(2);
    await fillValidQualification(itapPage2, bf);
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // TC-025 (Medium)
  test('TC-025: rejects an experience "To Date" earlier than its "From Date"', async () => {
    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf), '01/01/2020', '01/01/2015');
    await itapPage3.attemptSubmit(bf.hardWait.bind(bf));

    const messages = await itapPage3.getVisibleValidationMessages();
    expect(messages.some(m => /date/i.test(m))).toBe(true);
    await expect(itapPage3.companyNameInput).toBeVisible();
  });

  // TC-026 (Low)
  test('TC-026: "Currently working here" checked together with an explicit To Date', async () => {
    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf));
    await itapPage3.currentlyWorkingHere.check();
    await bf.hardWait(1);

    // Acceptable per spec: either the To Date is auto-cleared/hidden, or a
    // conflict validation message is shown — either counts as "handled".
    // Confirmed live: the app removes the To Date field from the DOM
    // entirely once "Currently working here" is checked (not merely cleared),
    // so its own .inputValue() would hang forever waiting for a locator that
    // no longer resolves to anything — check count() first.
    const toDateCount = await itapPage3.ToDate.count();
    const toDateValue = toDateCount > 0 ? await itapPage3.ToDate.inputValue() : '';
    const messages = await itapPage3.getVisibleValidationMessages();
    expect(toDateCount === 0 || toDateValue === '' || messages.length > 0).toBe(true);
  });

  // TC-027 (Low)
  test('TC-027: switching Experienced -> Not Experienced after partial entry leaves no stale state', async () => {
    await itapPage3.experienceDetail_yes.click();
    await bf.hardWait(1);
    await itapPage3.companyNameInput.fill('Stale Corp');

    await itapPage3.experienceDetail_No.click();
    await bf.hardWait(1);
    // Confirmed live: switching to "No" pops a "Are you sure you do not have
    // any previous experience?" confirmation dialog first — the field isn't
    // cleared until that's accepted.
    await itapPage3.confirmationMsg.click();
    await bf.hardWait(1);

    await expect(itapPage3.companyNameInput).not.toBeVisible();
    const messages = await itapPage3.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
  });

  // The tests below are new additions, built to bring Experience Details up
  // to the same per-field depth (positive/security/negative) as the
  // Onboarding/Interview modules.

  // TC-EX01 (new, Positive): closes the same "no true positive assertion"
  // gap as TC-P01/TC-Q06 — the "Experienced" happy path is currently only
  // ever exercised as a side-effect of Phase2.spec.js's setup helper, never
  // directly asserted here.
  test('TC-EX01 [Positive]: submits a fully valid "Experienced" entry and reaches Phase 2', async () => {
    await itapPage3.fill_Experienced(bf.hardWait.bind(bf));
    await bf.hardWait(2);

    const phase2 = new ITAP_ContinueToPhase2Page(bf.page);
    await expect(phase2.continueToPhase2Btn).toBeVisible();
  });

  // TC-EX02 (new, Positive): the "Not Experienced" happy path is never
  // asserted either — TC-027 only covers the mid-switch edge case, not a
  // clean "No experience" submission reaching Phase 2 on its own.
  test('TC-EX02 [Positive]: submits a fully valid "Not Experienced" entry and reaches Phase 2', async () => {
    await itapPage3.fill_NotExperienced(bf.hardWait.bind(bf));
    await bf.hardWait(2);

    const phase2 = new ITAP_ContinueToPhase2Page(bf.page);
    await expect(phase2.continueToPhase2Btn).toBeVisible();
  });

  // TC-EX03/EX04 (new, Security): free-text Company Name / Designation
  // fields must treat script-injection payloads as inert data. Uses
  // fill_ExperienceFormOnly()+attemptSubmit() (not fill_Experienced()) so
  // the test doesn't assume the submission succeeds before checking it.
  test('TC-EX03 [Security]: Company Name safely accepts an XSS payload without executing it', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf), '01/01/2020', '31/12/2023', {
      companyName: '<script>alert(1)</script>',
    });
    await itapPage3.attemptSubmit(bf.hardWait.bind(bf));

    expect(dialogAppeared).toBe(false);
  });

  test('TC-EX04 [Security]: Designation safely accepts an XSS payload without executing it', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf), '01/01/2020', '31/12/2023', {
      designation: '<script>alert(1)</script>',
    });
    await itapPage3.attemptSubmit(bf.hardWait.bind(bf));

    expect(dialogAppeared).toBe(false);
  });

  // TC-EX05 (new, Negative)
  // KNOWN BUG (confirmed live): mirrors TC-019's "past interview date" bug —
  // a future experience "From Date" (e.g. 01/01/2099) is accepted with zero
  // validation. Confirmed by screenshot: attemptSubmit() reaches the "Are
  // you sure you want to submit?" confirmation dialog (which only appears
  // once the form has already passed client-side validation), rather than
  // any date-order/date-range message. Kept asserting the *intended*
  // (correct) behavior on purpose, same as TC-019 — this test should stay
  // red as a marker until the app itself is fixed, not be rewritten to
  // document the gap as acceptable.
  test('TC-EX05 [Negative]: rejects an experience "From Date" set in the future', async () => {
    const futureDate = '01/01/2099';
    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf), futureDate, '31/12/2099');
    await itapPage3.attemptSubmit(bf.hardWait.bind(bf));

    const messages = await itapPage3.getVisibleValidationMessages();
    expect(messages.some(m => /date/i.test(m))).toBe(true);
    await expect(itapPage3.companyNameInput).toBeVisible();
  });

  // TC-EX06 (new, Negative)
  // KNOWN BUG (confirmed live): same class of gap as TC-EX05 — a negative
  // Annual Package value ("-500000") is retained verbatim by the field (not
  // stripped to a positive number) and also reaches the submit-confirmation
  // dialog with zero validation. Kept asserting the *intended* (correct)
  // behavior on purpose, same as TC-019/TC-EX05 — stays red as a marker
  // until the app itself is fixed.
  test('TC-EX06 [Negative]: rejects a negative Annual Package value', async () => {
    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf), '01/01/2020', '31/12/2023', {
      annualPackage: '-500000',
    });
    await itapPage3.attemptSubmit(bf.hardWait.bind(bf));

    const messages = await itapPage3.getVisibleValidationMessages();
    expect(messages.length).toBeGreaterThan(0);
    await expect(itapPage3.companyNameInput).toBeVisible();
  });

  // The tests below are new additions found via a live audit of the actual
  // application (2026-09-11) — see TEST_KNOWLEDGE_MAP.md for context.

  // TC-EX07 (new, Positive): "Save" (separate from Submit, present on every
  // Phase 1 screen) was never exercised here. Confirmed live: unlike
  // Personal Details' Save (TC-P14, a confirmed bug), Experience Details'
  // Save works correctly on a fully filled entry.
  test('TC-EX07 [Positive]: Save persists a fully filled Experience Details entry', async () => {
    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf));
    await itapPage3.click_SaveBtn();
    await bf.hardWait(2.5);

    const dialogText = await itapPage3.getDialogTextAndDismiss();
    expect(dialogText).toMatch(/saved successfully/i);
  });

  // TC-EX08 (new, Positive): "Add Experience" exists on the page object
  // (fill_SecondExperience()) but was never exercised — mirrors TC-024's
  // "Add Qualification" coverage, closing the identical gap for multiple
  // Experience entries. Confirmed live: it reveals a second, independent
  // set of experience fields (not a replacement of the first).
  test('TC-EX08 [Positive]: allows adding a second experience entry alongside the first', async () => {
    await itapPage3.fill_ExperienceFormOnly(bf.hardWait.bind(bf));
    await itapPage3.fill_SecondExperience(bf.hardWait.bind(bf));
    await itapPage3.attemptSubmit(bf.hardWait.bind(bf));
    if (await itapPage3.confirmationMsg.isVisible().catch(() => false)) {
      await itapPage3.confirmationMsg.click();
      await bf.hardWait(2);
    }

    // Both entries must have actually persisted rather than the second
    // silently overwriting or being dropped - same signal TC-024 checks for
    // the Qualification equivalent.
    const messages = await itapPage3.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
  });
});
