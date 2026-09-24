// utils/CandidateFlowHelpers.js
// Shared helpers for driving a fresh candidate signup through Phase 1
// (Personal Details + Qualification Details) and into Phase 2 (Other
// Details + Document Upload). Reused by tests/Candidate/Phase1.spec.js and
// tests/Candidate/Phase2.spec.js so the field timing only lives in one place.
//
// The waits between steps are not decorative: Mendix's reactive widgets (HQ
// reference selector, HQ Flexible radio, state/district selectors) need
// settle time after each interaction. Omitting them entirely (confirmed
// live) makes the next locator's own auto-wait swallow the full remaining
// test timeout instead of finding the element, since the element simply
// isn't rendered yet.
//
// fillValidPersonalDetails() below no longer uses fixed hardWait() sleeps
// for this - it waits on the real signal (the DOM going quiet) via
// utils/MendixSettle.js's settle(). Measured live 2026-09-18: the fixed
// sleeps in that one function totalled ~52s, paid by 32 of the 51 Phase 1
// test cases. Every OTHER helper in this file still uses hardWait() exactly
// as before - Phase 2's specs depend on them and were not re-verified as
// part of that change.
const path = require('path');
const { ITAP_LoginPage, ITAP_AlreadySignedUserPage } = require('../pages/Candidate/SignUpSignIn');
const { ITAPInterviewPerformaPage, ITAP_QualificationDetailsPage, ITAP_ExperienceDetailPage } = require('../pages/Candidate/Phase1');
const { ITAP_ContinueToPhase2Page } = require('../pages/Candidate/Phase2');
const config = require('../config');
const { settle, settleAsHardWait } = require('./MendixSettle');

function getRandomAadhar() {
  const first = Math.floor(1 + Math.random() * 9).toString();
  const rest = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
  return `${first}${rest}`;
}

async function signupAndReachPhase1(bf) {
  const lp = new ITAP_LoginPage(bf.page);
  await lp.scrollToFirst();
  await lp.clickOn_createNewOne();
  await bf.hardWait(1);
  await lp.enterAadhaarNumber(getRandomAadhar());
  await lp.enter_emailId(config.PersonalEmailId);
  await lp.enter_newPassword(config.NewPassword);
  await lp.enter_confirmPassword(config.ConfirmPassword);
  await lp.enter_managerRefID(config.ManagerRefID);
  await lp.clickOn_checkBox1();
  await lp.attemptSignUp();
  await lp.validateHomePageTitle();
}

// SIGNS IN (not up) as an already-registered candidate and lands on Phase 1
// — a much shorter flow than signupAndReachPhase1() above, for tests that
// don't need a genuinely fresh/untouched account. Safe to call repeatedly
// against the same pooled candidate (see utils/Phase1TestCandidates.js's own
// comment for the live-confirmed safety reasoning: a Next click blocked by
// validation never persists any data server-side) — NOT safe for a test that
// completes a full, valid submission, which needs a real fresh account via
// signupAndReachPhase1() instead. Follows the exact same fresh-
// BrowserFactory-per-test pattern as signupAndReachPhase1() (no
// {shared: true}) — only the sign-up-vs-sign-in step itself differs.
async function signInAndReachPhase1(bf, candidate) {
  const login = new ITAP_AlreadySignedUserPage(bf.page);
  await login.enter_AadharNumber(candidate.aadhaar);
  await login.enter_Password(candidate.password);
  await login.clickOn_radioButton();
  await login.clickOn_SignInButton();
  await login.validateSignInSuccess();
}

// Fills every Personal Details field with known-valid data, except whatever
// is overridden — isolates the one field under test from unrelated
// "required field missing" noise on the other fields. Does not click Next.
//
// overrides.lastName / .skipHQPreference / .skipGender / .skipMaritalStatus /
// .fatherOcc / .fatherIncome / .motherName / .motherOcc / .motherIncome /
// .city / .skipState / .skipDistrict are new (2026-09-17), added for the
// Candidate Application Form (Phase 1) 51-test-case suite's per-field
// mandatory/negative coverage — every existing override key keeps its exact
// previous behavior.
async function fillValidPersonalDetails(itapPage1, bf, overrides = {}) {
  // Was `overrides.firstName || default` — a falsy-string bug: passing ''
  // (the whole point of the "First Name is mandatory" negative test) fell
  // through to the default instead of actually leaving the field blank.
  await itapPage1.enter_FirstName(overrides.firstName !== undefined ? overrides.firstName : bf.getPropertyValue('FirstName'));
  await itapPage1.enter_MiddleName(bf.getPropertyValue('MiddleName'));
  await itapPage1.enter_LastName(overrides.lastName !== undefined ? overrides.lastName : bf.getPropertyValue('LastName'));
  await settle(bf);
  await itapPage1.select_Role(bf.getPropertyValue('Role'));
  // overrides.skipHQPreference === true: leaves the HQ Preference reference
  // selector unselected, for the "HQ Preference is mandatory" negative test
  // — every other call site never sets this and keeps selecting it as before.
  if (overrides.skipHQPreference !== true) {
    await itapPage1.select_HQ(bf.getPropertyValue('HQPreference'));
  }
  await settle(bf);
  // overrides.hqFlexible === false: TC-P0x exercises the "HQ Not Flexible"
  // radio, which every other call site never touches (defaults preserve
  // that existing behavior exactly).
  if (overrides.hqFlexible === false) {
    await itapPage1.select_HQNotFlexible();
  } else {
    await itapPage1.select_HQFlexible();
  }
  await settle(bf);
  await itapPage1.fill_ContactDetails(overrides.pan, overrides.mobile);
  await settle(bf);
  // overrides.skipGender === true: leaves Gender unselected, for the
  // "Gender is mandatory" negative test.
  if (overrides.skipGender !== true) {
    await itapPage1.select_Gender();
  }
  await settle(bf);
  await itapPage1.fill_PersonalDetails(overrides.dob, overrides.skipMaritalStatus !== true);
  await settle(bf);
  await itapPage1.fill_ParentDetails(
    overrides.fatherName,
    overrides.fatherOcc,
    overrides.fatherIncome,
    overrides.motherName,
    overrides.motherOcc,
    overrides.motherIncome,
  );
  await settle(bf);
  await itapPage1.fill_Address(overrides.addressLine1, overrides.city, overrides.pin);
  await settle(bf);
  // overrides.skipState === true: leaves State (and therefore District too
  // — District has no real options until a State is chosen) unselected, for
  // the "State is mandatory" negative test. overrides.skipDistrict === true
  // (with State still selected): leaves only District unselected, for the
  // "District is mandatory" negative test.
  await itapPage1.select_StateDistrict(settleAsHardWait(bf), overrides.skipState !== true, overrides.skipDistrict !== true);
  await settle(bf);
  // overrides.sameAsPermanentAddress === false: leaves the Current Address
  // section blank/unchecked instead of auto-copying the Permanent Address
  // into it, so a caller can inspect that section on its own (its own
  // mandatory-field validation, or the copy-on-check/clear-on-uncheck
  // behavior) — every other call site never sets this and keeps the
  // original unconditional-check behavior exactly.
  if (overrides.sameAsPermanentAddress !== false) {
    await itapPage1.click_PerAddRadioBtn();
    await settle(bf);
  }
  await itapPage1.select_vehicleNum_yes(overrides.vehicleNumber);
  await settle(bf);
  if (overrides.interviewDate) {
    await itapPage1.select_InterviewDate(overrides.interviewDate);
  } else {
    await itapPage1.select_No_InterviewDate();
  }
  await settle(bf);
}

// Fills every Qualification Details field with known-valid data, except
// whatever is overridden. Does not click Next.
//
// overrides.skipXth / .skipXII === true are new (2026-09-22), added for the
// Qualification Details 41-test-case suite (TC_51-91): leaves that whole
// section untouched (both are optional - see Phase1.spec.js's own comment on
// why 10th/12th being left blank TOGETHER is safe, but partially filling one
// while leaving the other blank triggers a cross-field "Enter To and From
// dates for 10th and 12th" validation message - confirmed live 2026-09-22).
// Every other override key is passed straight through to the page object's
// own fill_XthDetails/fill_XIIthDetails/fill_graduationDetails, whose
// signatures already default to the same valid values this function
// previously hardcoded via `overrides.xthFrom` etc. being undefined.
async function fillValidQualification(itapPage2, bf, overrides = {}) {
  if (overrides.skipXth !== true) {
    await itapPage2.fill_XthDetails(overrides.xthFrom, overrides.xthTo, overrides.xthMarks, overrides.xthSpecialization);
    await bf.hardWait(2);
  } else {
    // See clear_XthDetails()'s own comment: actively blanks the section
    // instead of just not touching it, since the pooled candidate can carry
    // in stale data from an earlier test.
    await itapPage2.clear_XthDetails();
    await bf.hardWait(2);
  }
  if (overrides.skipXII !== true) {
    await itapPage2.fill_XIIthDetails(overrides.xiiFrom, overrides.xiiTo, overrides.xiiMarks, overrides.xiiSpecialization);
    await bf.hardWait(2);
  } else {
    await itapPage2.clear_XIIthDetails();
    await bf.hardWait(2);
  }
  // overrides.gradOmit is new (2026-09-23), added for the Graduation
  // mandatory-field negative tests (TC_66-TC_70): fills Graduation validly
  // except for the one named field, which is actively cleared (see
  // fill_graduationDetailsOmitting()'s own comment for why clearing rather
  // than skipping is required against the pooled candidate). Left undefined
  // — as every pre-existing caller does — this branch is never taken and
  // behavior is byte-for-byte what it was before.
  if (overrides.gradOmit) {
    await itapPage2.fill_graduationDetailsOmitting(overrides.gradOmit, {
      fromDate: overrides.gradFrom, toDate: overrides.gradTo, marks: overrides.gradMarks,
      course: overrides.gradCourse, type: overrides.gradType,
      specialization: overrides.gradSpecialization,
    });
  } else {
    await itapPage2.fill_graduationDetails(
      overrides.gradFrom, overrides.gradTo, overrides.gradMarks,
      overrides.gradCourse, overrides.gradType, overrides.gradSpecialization,
    );
  }
  await bf.hardWait(2);
}

// ---- Phase 2 (Other Details + Document Upload) flow helpers ----
// Promoted from tests/Candidate/Phase2.spec.js's local functions (originally
// added for TC-028..032) so the new describe.serial blocks that need to reach
// Other Details / Document Upload from a single shared beforeAll can reuse
// the exact same flow logic instead of re-implementing it, mirroring how
// utils/createClearedOnboardingCandidate.js builds on
// utils/createFreshInterviewCandidate.js rather than duplicating it.
const filesDir = path.join('upload-files');

// Slot order matches the "experience === yes" branch in
// utils/createFreshInterviewCandidate.js.
const VALID_DOC_SLOTS = [
  'Aadhar.jpg',      // 1
  'Pancard.jpg',     // 2
  'samplepic.jpg',   // 3 photo
  'cheque.jpg',      // 4
  'uan.jpg',         // 5
  '10.jpg',          // 6
  '12.jpg',          // 7
  'bsc.jpg',         // 8 highest qualification
  'experience.jpg',  // 9
  'Aadhar.jpg',       // 10 father aadhar
  'samplepic.jpg',    // 11 father photo
  'Aadhar.jpg',       // 12 mother aadhar
  'samplepic.jpg',    // 13 mother photo
];

function uploadSlot(bf, index) {
  return bf.page.locator(`(//input[@type='file'])[${index}]`);
}

// Uploads every document slot with its normally-valid fixture, except:
//  - overrides[index] = 'filename.ext' to substitute a specific bad file
//  - skipIndices = [index, ...] to leave a mandatory slot empty entirely
//
// Confirmed live: re-uploading a DIFFERENT file into a slot that already has
// one causes later, higher-numbered (//input[@type='file'])[N] lookups to
// time out (the widget keeps a per-document file-history list — visibly
// showing 2+ accumulated entries in the UI, matching the "Max 2 files per
// document" policy — and something about that accumulation breaks the flat
// index scheme for slots that come after it). Skipping a slot that already
// holds a file (rather than blindly re-uploading over it) avoids triggering
// this entirely; every existing caller runs on a freshly-reached, never-
// touched upload page, so this is a no-op for them.
async function uploadAllDocuments(bf, { overrides = {}, skipIndices = [] } = {}) {
  for (let i = 1; i <= VALID_DOC_SLOTS.length; i++) {
    if (skipIndices.includes(i)) continue;
    const alreadyFilled = await uploadSlot(bf, i).evaluate(el => el.files.length > 0).catch(() => false);
    if (alreadyFilled) continue;
    const fileName = overrides[i] || VALID_DOC_SLOTS[i - 1];
    await uploadSlot(bf, i).setInputFiles(path.join(filesDir, fileName));
    await bf.hardWait(1);
  }
}

// Does NOT click through the "Are you sure you want to submit?" Yes/No
// confirmation dialog that appears when a submission is genuinely about to
// succeed (confirmed live — see TC-DU09) — every existing negative test in
// this file (TC-028..032, TC-DU05/06/07) relies on this function stopping
// here so it can assert the submission was blocked, without the risk of
// this shared helper accidentally clicking a real submission through on
// their behalf. TC-DU09 (the one true happy-path submission test) handles
// that confirmation dialog itself, locally, precisely so this shared helper
// stays safe for every negative caller.
async function checkTermsAndSubmit(bf) {
  const checkBox = bf.page.locator("//*[contains(@id,'CandidatePhase2_UploadDocument.checkBox1')]");
  await checkBox.scrollIntoViewIfNeeded();
  await checkBox.check();
  await bf.hardWait(1);

  const submitBtn = bf.page.locator("//*[contains(@data-button-id,'CandidatePhase2_UploadDocument.actionButton13')]");
  await submitBtn.click();
  await bf.hardWait(2);
}

async function getVisibleValidationMessages(bf) {
  const texts = await bf.page.locator('.mx-validation-message').allTextContents();
  return [...new Set(texts.map(t => t.trim()).filter(Boolean))];
}

// Drives signup -> Phase 1 (Personal + Qualification + Experience, all
// happy-path/valid) -> the Phase 2 "Other Details" page itself, stopping
// with every Other Details field still blank. Split out from
// reachPhase2OtherDetails() below so the new "Other Details - Negative &
// Edge Cases" describe.serial block (which needs to test the blank-submit
// state first, then progressively fill fields across its own tests) can
// reach the page without reachPhase2OtherDetails()'s own always-fill-
// everything behavior.
async function reachOtherDetailsPage(bf) {
  await signupAndReachPhase1(bf);

  const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
  await fillValidPersonalDetails(itapPage1, bf);
  await itapPage1.click_NextBtn();
  await bf.hardWait(2);

  const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
  await fillValidQualification(itapPage2, bf);
  await itapPage2.click_NextBtn();
  await bf.hardWait(2);

  const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
  await itapPage3.fill_Experienced(bf.hardWait.bind(bf));
  await bf.hardWait(2);

  const itapPhase2 = new ITAP_ContinueToPhase2Page(bf.page);
  await itapPhase2.Extract_itap_number();
  await bf.hardWait(1);
  await itapPhase2.click_continueToPhase2Btn();
  await bf.hardWait(2);

  return itapPhase2;
}

// Fills every Other Details field with known-valid data (does not click
// Next). Split out so new negative tests can fill some fields but not
// others, isolating the one field under test the same way
// fillValidPersonalDetails()/fillValidQualification() already do for
// Phase 1.
async function fillValidOtherDetails(itapPhase2, bf, { uanNumber } = {}) {
  await itapPhase2.otherDetails();
  await itapPhase2.dependantDetails(bf.hardWait.bind(bf));
  await itapPhase2.uanDetails(uanNumber);
  await itapPhase2.pfmemeber_toggle();
  await itapPhase2.emergencyContact();
}

// Drives all the way to a fully-valid, filled-in Other Details page (does
// not click Next). Lets callers override the UAN before deciding whether to
// proceed or expect rejection. Unchanged behavior from before the
// reachOtherDetailsPage()/fillValidOtherDetails() split above — existing
// callers (Phase2.spec.js's TC-031) still get the exact same result.
async function reachPhase2OtherDetails(bf, { uanNumber } = {}) {
  const itapPhase2 = await reachOtherDetailsPage(bf);
  await fillValidOtherDetails(itapPhase2, bf, { uanNumber });
  return itapPhase2;
}

async function reachPhase2Uploads(bf) {
  const itapPhase2 = await reachPhase2OtherDetails(bf);
  await itapPhase2.clickNextBtn();
  await bf.hardWait(2);
  return itapPhase2;
}

module.exports = {
  getRandomAadhar,
  signupAndReachPhase1,
  signInAndReachPhase1,
  fillValidPersonalDetails,
  fillValidQualification,
  VALID_DOC_SLOTS,
  uploadSlot,
  uploadAllDocuments,
  reachOtherDetailsPage,
  fillValidOtherDetails,
  checkTermsAndSubmit,
  getVisibleValidationMessages,
  reachPhase2OtherDetails,
  reachPhase2Uploads,
};
