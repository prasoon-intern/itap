const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const { signupAndReachPhase1, signInAndReachPhase1, fillValidPersonalDetails, fillValidQualification } = require('../../utils/CandidateFlowHelpers');
// ITAP_ExperienceDetailPage is used only by TC_87 (Next renders Experience
// Details) - added 2026-09-23 with the TC_71-TC_91 batch.
const { ITAPInterviewPerformaPage, ITAP_QualificationDetailsPage, ITAP_ExperienceDetailPage } = require('../../pages/Candidate/Phase1');
const { dobYearsAgoDDMMYYYY, futureDateDDMMYYYY } = require('../../utils/DateHelpers');
const { candidate1, experienceCandidate1 } = require('../../utils/Phase1TestCandidates');
// Used by the TC_61-70 fast-path session helper below (and their own
// post-interaction waits) instead of fixed hardWait() sleeps.
const { settle } = require('../../utils/MendixSettle');

// Built from Test Cases/Candidate Application Form.xlsx, sheet "Phase1"
// (50 rows, Excel IDs TC_01..TC_50), covering the "Application Form -
// Phase 1" page's 1.1 Basic Info, 1.2 Personal Details (incl. Communication
// Address), and 1.3 General Details sections. This is the FIRST automation
// pass for this module — every test below was run live against the real app
// (2026-09-17) to confirm its assertions, using
// utils/CandidateFlowHelpers.js's fillValidPersonalDetails() (extended here
// with several new optional overrides — see that file's own comments) so
// each test can isolate exactly one field/behavior while every other
// mandatory field stays validly filled.
//
// Each test does its own fresh BrowserFactory (no {shared: true}). Most
// tests reach Phase 1 via signInAndReachPhase1() against a small, dedicated
// pool of already-registered accounts (utils/Phase1TestCandidates.js) rather
// than a fresh signup each time — verified live (2026-09-17) to be safe: a
// Next click blocked by validation (the shape every mandatory-field/format
// negative test here uses) does not persist any data server-side, so the
// same pooled account can safely be reused across many such tests without
// leaking state between them (see Phase1TestCandidates.js's own comment for
// the full verification). Only tests that complete a full, valid submission
// and then inspect real persisted state (TC_37, TC_39) use a genuine fresh
// signupAndReachPhase1() instead, since those DO write real data to the
// account and must not collide with each other or with a pooled test.
//
// Known, confirmed-live defects (Excel Status already "Failed" for these,
// kept asserting the CORRECT/expected behavior on purpose so the test stays
// red as a marker until the app itself is fixed — same convention already
// used for Manager Referral's TC_02/TC_19/TC_20/TC_34/TC_35):
//   - TC_03: Mother's Net Earning / Month placeholder reads "net worth"
//     instead of "net earning" (inconsistent with Father's). A second,
//     dedicated placeholder test also covered this until 2026-09-18, when
//     it was removed as a duplicate (its Excel row was deleted too).
//   (TC_29/TC_47 were previously listed here as a State-dropdown defect.
//   They are NOT defects: the user confirmed 2026-09-18 from screenshots of
//   the live dropdown that its 26 entries are exactly what the app is meant
//   to offer. Both now assert that exact list — see EXPECTED_STATES below.)
//   - TC_41/TC_42: PAN Card Number / Date of Birth, when left completely
//     blank, do NOT show the Excel-specified "<Field> is mandatory" message
//     — they show a different, more specific validation message instead
//     ("PAN Card Number is not valid" / "The minimum permissible age is 18
//     years."). Kept asserting the Excel-specified exact text on purpose
//     (matches this project's "match the spec text precisely" convention),
//     which genuinely fails against the live text — a real spec/app
//     mismatch, not a paraphrased pass. Re-confirmed live 2026-09-18 and
//     ruled a wording DEFECT (not a spec change), so both stay red until
//     the app's own message is corrected.
//   - TC_102: "From" (Experience Details) loses its mandatory-field
//     validation when "Currently working here?" is UNCHECKED. Probed live
//     2026-09-24 on two fresh accounts, one per branch: with the box CHECKED
//     a blank From correctly gives "Please enter From date"; with it
//     UNCHECKED there is no validation message at all and the app throws a
//     Mendix runtime error instead ("An error occurred, please contact your
//     system administrator.", HTTP 560 from /xas/). So the rule exists but is
//     only wired into one branch. These tests run the unchecked branch, which
//     is why they hit it. Left asserting the correct behavior so it stays red
//     until fixed.
//   - TC_109: Experience Details accepts FUTURE From/To dates. An employment
//     period lying entirely in the future (From 24/03/2027, To 24/09/2027 on a
//     2026-09-24 run) is taken as valid - no validation message, no runtime
//     error, straight to the submit confirmation. Confirmed live 2026-09-24
//     across 3 consecutive identical runs. Not a case of the dates being
//     unvalidated generally: the ordering rule between them IS enforced ("To
//     Date cannot be earlier than From Date", TC_108), so the app does look at
//     them, it just never compares them to today. Left asserting the correct
//     behavior so it stays red until fixed.
//
// TC_40 was previously in that same group, but its wording was resolved the
// other way (2026-09-18): the live "Please enter 10 digit mobile number" was
// adopted as the correct expectation, the Excel Expected Result updated to
// match, and the assertion below changed accordingly — so TC_40 is now a
// genuine pass rather than a known-failing marker.

const DELHI_DISTRICTS = [
  'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi',
  'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi',
];
// The State dropdown's authoritative option list, for BOTH the Permanent
// and Current Address blocks. Confirmed by the user 2026-09-18 (screenshots
// of the live dropdown): the app is only ever meant to offer these 26
// entries — it is NOT meant to list all 28 Indian states + 8 union
// territories, and the absence of Sikkim/Manipur/Meghalaya/Mizoram/
// Nagaland/Tripura/Arunachal/Andaman/Lakshadweep/Puducherry/Ladakh is
// intended, not a defect. "JAMMU" and "KASHMIR" being two separate entries
// is likewise intended. This supersedes the earlier reading of the short
// list as a bug.
//
// Asserted exactly (order included) so that an entry being added, removed,
// renamed or reordered later fails loudly rather than passing silently.
const EXPECTED_STATES = [
  'A.P.', 'ASSAM', 'BIHAR', 'CHANDIGARH', 'CHATTISGARH',
  'DAMAN & DEEP', 'DELHI', 'GOA', 'GUJARAT', 'HARYANA',
  'HIMACHAL PRADESH', 'JAMMU', 'JHARKHAND', 'KARNATAKA',
  'KASHMIR', 'KERALA', 'MAHARASHTRA', 'M.P.', 'ORISSA',
  'PUNJAB', 'RAJASTHAN', 'TAMIL NADU', 'TELANGANA',
  'U.P.', 'UTTARAKHAND', 'WEST BENGAL',
];

// For the large majority of tests: reach Phase 1 by signing IN as the
// pooled candidate (utils/Phase1TestCandidates.js) rather than signing up
// fresh - much faster, and confirmed safe (see this file's header comment).
async function newPooledPhase1Session() {
  const bf = new BrowserFactory();
  await bf.launchBrowser(config.CANDIDATE_URL);
  await signInAndReachPhase1(bf, candidate1);
  const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
  return { bf, itapPage1 };
}

// Only for tests that complete a full, valid submission and then inspect
// real persisted state (TC_37, TC_39) - these must not touch the pooled
// candidate's account, so each gets its own brand-new signup instead.
async function newFreshPhase1Session() {
  const bf = new BrowserFactory();
  await bf.launchBrowser(config.CANDIDATE_URL);
  await signupAndReachPhase1(bf);
  const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
  return { bf, itapPage1 };
}

// ---- Qualification Details (TC_51-91) session helpers ----
// Reaching Qualification Details always means completing Personal Details
// with valid data first and clicking Next - unlike most of TC_01-50, this is
// true even for tests that only care about a Qualification Details field,
// since that's the only way to reach the page under test at all. Confirmed
// live (2026-09-22) safe to do repeatedly against the SAME pooled candidate:
// a real bug was found and fixed along the way (see
// pages/Candidate/Phase1.js's click_PerAddRadioBtn() comment) where a second
// full Personal Details submission against the same account was silently
// UNCHECKING "Same as Permanent" (already checked from the first submission)
// instead of leaving it checked - now idempotent, so this is safe to reuse
// exactly like newPooledPhase1Session() above.
// Confirmed live (2026-09-22): the well-documented "Mendix click sometimes
// doesn't register" issue (see e.g. fill_additionalQualificationDetails()'s
// own comment in pages/Candidate/Phase1.js) occasionally hits
// fillValidPersonalDetails()'s HQ Preference/HQ Flexible selection too - the
// dropdown is left open instead of closing, and the resulting Next click
// then just leaves the candidate stuck on Personal Details. Retries the
// whole fill-and-Next sequence (a fresh, clean pass each time - no partial
// state to worry about, since a still-open Personal Details page is safe to
// re-fill) up to 3 times, verifying arrival by the Qualification Details
// page's own "10th"/"Graduation" text rather than trusting the click alone.
async function fillPersonalDetailsAndReachQualification(itapPage1, bf) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await fillValidPersonalDetails(itapPage1, bf);
    await itapPage1.click_NextBtn();
    await bf.hardWait(2.5);
    const bodyText = await bf.page.locator('body').innerText().catch(() => '');
    if (bodyText.includes('Graduation') && bodyText.includes('10th')) {
      return new ITAP_QualificationDetailsPage(bf.page);
    }
  }
  throw new Error('fillPersonalDetailsAndReachQualification(): did not reach Qualification Details after 3 attempts.');
}

async function newPooledQualificationSession() {
  const { bf, itapPage1 } = await newPooledPhase1Session();
  const itapPage2 = await fillPersonalDetailsAndReachQualification(itapPage1, bf);
  return { bf, itapPage2 };
}

// FAST PATH to Qualification Details — added 2026-09-23 alongside (NOT in
// place of) newPooledQualificationSession() above, which TC_51-TC_60 keep
// using unchanged.
//
// newPooledQualificationSession() re-fills all 15+ Personal Details fields
// (several of them slow, re-rendering Mendix dropdowns) on every single
// test purely to get a successful Next click. That refill is by far the
// biggest per-test cost in this section and it is unnecessary, because the
// pooled candidate has ALREADY validly completed Personal Details.
//
// Verified live 2026-09-23, before this was relied on:
//   - Signing in as the pooled candidate lands on Personal Details with the
//     previous submission's data still populated (First Name "Discovery",
//     Last Name "18") — i.e. Personal Details was genuinely completed via a
//     successful Next at some earlier point, not via the (broken) Save.
//   - Clicking the "2. Qualification Details" step circle from there jumps
//     straight to Qualification Details (page shows "10th"/"Course*"),
//     no refill needed.
//   - A direct Next on the prefilled page ALSO succeeds with zero
//     validation messages — used below as the fallback.
//
// Measured live: ~14s sign-in-to-Qualification versus roughly a minute for
// the full-refill path.
//
// IMPORTANT (and the reason the by-label locator exists — see
// pages/Candidate/Phase1.js's stepQualificationDetailsCircleByLabel
// comment): the wizard's fixed mx-name-containerNN classes differ between
// the fresh-sign-in Personal Details render and the post-Next Qualification
// render, so the existing class-based stepQualificationDetailsCircle points
// at the WRONG (inactive) step here and clicking it silently does nothing.
//
// Falls back to a direct Next, and then to the original full-refill helper,
// so a pooled candidate whose Personal Details ever gets wiped still works
// — just more slowly. Arrival is always verified by the Qualification page's
// own "10th"/"Graduation" text rather than by trusting the click, the same
// way fillPersonalDetailsAndReachQualification() does.
async function newPooledQualificationSessionFast() {
  const { bf, itapPage1 } = await newPooledPhase1Session();

  const arrived = async () => {
    const bodyText = await bf.page.locator('body').innerText().catch(() => '');
    return bodyText.includes('Graduation') && bodyText.includes('10th');
  };

  // 1. Step-circle jump (the fast path proper).
  for (let attempt = 0; attempt < 2; attempt++) {
    await itapPage1.stepQualificationDetailsCircleByLabel.scrollIntoViewIfNeeded().catch(() => {});
    await itapPage1.stepQualificationDetailsCircleByLabel.click({ force: true }).catch(() => {});
    await settle(bf, { timeout: 6000 });
    if (await arrived()) return { bf, itapPage2: new ITAP_QualificationDetailsPage(bf.page) };
  }

  // 2. Direct Next on the already-prefilled Personal Details.
  await itapPage1.click_NextBtn().catch(() => {});
  await settle(bf, { timeout: 6000 });
  if (await arrived()) return { bf, itapPage2: new ITAP_QualificationDetailsPage(bf.page) };

  // 3. Last resort: the original full-refill path.
  const itapPage2 = await fillPersonalDetailsAndReachQualification(itapPage1, bf);
  return { bf, itapPage2 };
}

// For TC_86 (Save-persists-across-refresh), TC_87 (Next renders Experience
// Details), TC_88 (Experience Details gating), TC_89/90/91 (step
// navigation) - these either need a full valid submission or genuinely
// clean state, so each gets its own fresh signup rather than the pooled
// candidate, mirroring newFreshPhase1Session()'s own reasoning.
async function newFreshQualificationSession() {
  const { bf, itapPage1 } = await newFreshPhase1Session();
  const itapPage2 = await fillPersonalDetailsAndReachQualification(itapPage1, bf);
  return { bf, itapPage2 };
}

// Reaches section 3 (Experience Details) on a genuinely fresh account, by
// completing Personal Details and then Qualification Details. Experience
// Details cannot be reached any other way - it is gated behind Qualification
// Details being validly complete (that gating is what TC_88 covers).
async function newFreshExperienceSession() {
  const { bf, itapPage2 } = await newFreshQualificationSession();
  await fillValidQualification(itapPage2, bf);
  const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
  if (messages.length) {
    throw new Error(
      `newFreshExperienceSession(): Qualification Details was rejected, so Experience `
      + `Details was never reached. Messages: ${JSON.stringify(messages)}`,
    );
  }
  await settle(bf, { timeout: 8000 });
  return { bf, itapPage3: new ITAP_ExperienceDetailPage(bf.page) };
}

// ---- Experience Details (TC_92-TC_105) FAST PATH ----
// Added 2026-09-24 alongside (NOT in place of) newFreshExperienceSession()
// above, which TC_96 and TC_106 keep using unchanged.
//
// newFreshExperienceSession() costs ~1.1 min per test: a brand-new signup,
// a full 15+-field Personal Details fill, and a full Qualification Details
// fill, purely to get back to a page the pooled account has already been
// through. The user confirmed (2026-09-24) the much cheaper route this
// implements, and it was then verified live end-to-end: a candidate that has
// already completed Qualification Details can, on any later sign-in, jump
// straight back to Experience Details through the step indicator without
// re-creating or re-filling anything. Measured live: ~14s from launch to
// section 3, against ~1.1 min for the full rebuild.
//
// It is a TWO-HOP jump - Personal Details -> Qualification Details ->
// Experience Details. Jumping straight from Personal Details to the
// Experience circle is BLOCKED (confirmed live: it pops a Mendix
// "Information" dialog reading "Fill all Qualification details" and stays
// put), which is exactly the capping behavior TC_90 covers. The Experience
// circle is even rendered `wizard-inactive` on the fresh-sign-in Personal
// Details render, and only becomes active once Qualification Details is
// open.
//
// The by-label step-circle locators are used rather than the class-based
// ones for the reason already documented on
// stepQualificationDetailsCircleByLabel in pages/Candidate/Phase1.js: the
// fixed mx-name-containerNN numbers differ between renders (confirmed again
// here - Personal/Qualification/Experience are container36/52/41 on the
// fresh-sign-in and post-hop pages but container39/51/53 on the page reached
// by a real Next), so a class-based click lands on the wrong step.
//
// Arrival is verified by each page's own text rather than by trusting a
// click, and each hop gets a real poll (not a bare settle()) - settle()
// returns as soon as the DOM goes quiet, which on this wizard can happen
// BEFORE Mendix has actually swapped sections in, and hopping again that
// early is what made the first live attempt fail.

// Polls `predicate` until it is true or `timeoutMs` elapses. Deliberately
// not settle(): settle() answers "has the DOM stopped changing", this
// answers "has the section I asked for actually arrived".
async function waitForCondition(predicate, timeoutMs = 20000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

// Signs in as the dedicated Experience pooled candidate
// (utils/Phase1TestCandidates.js's experienceCandidate1) and hops to
// Qualification Details - the first half of the fast path, and the entry
// point TC_92 needs on its own (it must click Next on Qualification Details
// itself). Falls back to a direct Next on the prefilled Personal Details
// page if the step-circle click doesn't take.
async function reachQualificationAsExperienceCandidate() {
  const bf = new BrowserFactory();
  await bf.launchBrowser(config.CANDIDATE_URL);
  await signInAndReachPhase1(bf, experienceCandidate1);
  const itapPage1 = new ITAPInterviewPerformaPage(bf.page);

  const onQualification = async () =>
    (await bf.page.locator('body').innerText().catch(() => '')).includes('Add Qualification');

  for (let attempt = 0; attempt < 2; attempt++) {
    await itapPage1.stepQualificationDetailsCircleByLabel.scrollIntoViewIfNeeded().catch(() => {});
    await itapPage1.stepQualificationDetailsCircleByLabel.click({ force: true }).catch(() => {});
    if (await waitForCondition(onQualification, 15000)) {
      await settle(bf, { timeout: 6000 });
      return { bf, itapPage1, itapPage2: new ITAP_QualificationDetailsPage(bf.page) };
    }
  }

  await itapPage1.click_NextBtn().catch(() => {});
  if (await waitForCondition(onQualification, 15000)) {
    await settle(bf, { timeout: 6000 });
    return { bf, itapPage1, itapPage2: new ITAP_QualificationDetailsPage(bf.page) };
  }

  await bf.closeBrowser().catch(() => {});
  throw new Error('reachQualificationAsExperienceCandidate(): never reached Qualification Details.');
}

// The full fast path: sign in as the pooled Experience candidate and land on
// section 3. SAFE FOR THE POOLED ACCOUNT only because no test using it ever
// completes a submission - see submitAndCancelIfConfirmed() in
// pages/Candidate/Phase1.js and utils/Phase1TestCandidates.js's own comment.
async function newPooledExperienceSession() {
  const { bf, itapPage1, itapPage2 } = await reachQualificationAsExperienceCandidate();

  const onExperience = async () =>
    (await bf.page.locator('body').innerText().catch(() => '')).includes('3.1 Work Experience');

  for (let attempt = 0; attempt < 2; attempt++) {
    await itapPage1.stepExperienceDetailsCircleByLabel.scrollIntoViewIfNeeded().catch(() => {});
    await itapPage1.stepExperienceDetailsCircleByLabel.click({ force: true }).catch(() => {});
    if (await waitForCondition(onExperience, 15000)) {
      await settle(bf, { timeout: 6000 });
      return { bf, itapPage1, itapPage3: new ITAP_ExperienceDetailPage(bf.page) };
    }
  }

  // Fallback: Qualification Details is already validly filled on this
  // account, so a plain Next also gets there - just a little slower.
  await itapPage2.click_NextBtn().catch(() => {});
  if (await waitForCondition(onExperience, 15000)) {
    await settle(bf, { timeout: 6000 });
    return { bf, itapPage1, itapPage3: new ITAP_ExperienceDetailPage(bf.page) };
  }

  await bf.closeBrowser().catch(() => {});
  throw new Error('newPooledExperienceSession(): never reached Experience Details.');
}

test.describe('Phase 1 - Page Shell & Navigation', () => {
  let bf, itapPage1;

  test.beforeEach(async () => {
    ({ bf, itapPage1 } = await newPooledPhase1Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_01
  test('TC_01: Verify header, footer, and step indicator on the Application Form - Phase 1 page', async () => {
    await expect(itapPage1.headerLogo).toBeVisible();
    await expect(bf.page).toHaveTitle(/Application Form - Phase 1/);
    await expect(itapPage1.accountIcon).toBeVisible();
    await expect(itapPage1.signOutBtn).toBeVisible();
    await expect(itapPage1.stepPersonalDetailsLabel).toBeVisible();
    await expect(itapPage1.stepQualificationDetailsLabel).toBeVisible();
    await expect(itapPage1.stepExperienceDetailsLabel).toBeVisible();

    const text = await bf.page.locator('body').innerText();
    expect(text).toContain('© Mankind@2026. All rights reserved.');
    expect(text).toContain('Helpline No. : NEHA NEGI- 01147476647 , ARCHIT GUPTA - 01147476622');
  });

  // Excel TC_05
  test('TC_05: Verify Qualification Details and Experience Details steps remain inaccessible until Personal Details is completed', async () => {
    await itapPage1.stepQualificationDetailsLabel.click({ force: true }).catch(() => {});
    await bf.hardWait(1);
    await expect(itapPage1.firstNamefield).toBeVisible();

    await itapPage1.stepExperienceDetailsLabel.click({ force: true }).catch(() => {});
    await bf.hardWait(1);
    await expect(itapPage1.firstNamefield).toBeVisible();
  });

  // Excel TC_38
  test('TC_38: Verify the Sign Out button signs the candidate out of the application form', async () => {
    await itapPage1.clickOn_SignOut();
    await bf.hardWait(1.5);
    await expect(bf.page).not.toHaveTitle('Mendix - Application Form - Phase 1');

    await bf.page.goto(config.CANDIDATE_URL);
    await bf.hardWait(1.5);
    await expect(itapPage1.firstNamefield).not.toBeVisible();
  });
});

// Kept as its own describe block (separate from the pooled-account block
// above): both tests here complete a full, valid submission / persist real
// data, so each needs a genuine fresh signupAndReachPhase1() rather than the
// pooled candidate.
test.describe('Phase 1 - Page Shell & Navigation (full valid submission)', () => {
  let bf, itapPage1;

  test.beforeEach(async () => {
    ({ bf, itapPage1 } = await newFreshPhase1Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_37
  test('TC_37: Verify clicking Next renders Qualification Details once Phase 1 (Basic Info, Personal Details, General Details) is fully and validly completed', async () => {
    await fillValidPersonalDetails(itapPage1, bf);
    await itapPage1.click_NextBtn();
    await bf.hardWait(2);

    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
    const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
  });

  // Excel TC_39
  test('TC_39: Verify the Save button persists entered data across a page refresh', async () => {
    await itapPage1.enter_FirstName(bf.getPropertyValue('FirstName'));
    await itapPage1.enter_LastName(bf.getPropertyValue('LastName'));
    await bf.hardWait(1);

    await itapPage1.click_SaveBtn();
    await bf.hardWait(2.5);
    const dialogText = await itapPage1.getDialogTextAndDismiss();
    expect(dialogText).toMatch(/saved successfully/i);

    await bf.page.reload({ waitUntil: 'networkidle' });
    await bf.hardWait(2);
    await expect(itapPage1.firstNamefield).toHaveValue(bf.getPropertyValue('FirstName'));
  });
});

test.describe('Phase 1 - 1.1 Basic Info', () => {
  let bf, itapPage1;

  test.beforeEach(async () => {
    ({ bf, itapPage1 } = await newPooledPhase1Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_02
  test('TC_02: Verify all static UI text in the "1.1 Basic Info" section', async () => {
    const text = await bf.page.locator('body').innerText();
    const expectedStrings = [
      '1.1 Basic Info',
      'First Name (As per Aadhaar)*',
      'Middle Name',
      'Last Name*',
      'Division',
      'Role*',
      'HQ Preference*',
      'HQ Flexible',
      'HQ Not Flexible',
    ];
    for (const s of expectedStrings) expect(text).toContain(s);
  });

  // Excel TC_06
  test('TC_06: Verify the "1.1 Basic Info" section toggle expands and collapses the section correctly', async () => {
    await expect(itapPage1.basicInfoToggleIcon).toHaveClass(/mx-icon-substract/);

    await itapPage1.toggleSection(itapPage1.basicInfoToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage1.firstNamefield).not.toBeVisible();
    await expect(itapPage1.basicInfoToggleIcon).toHaveClass(/mx-icon-add/);

    await itapPage1.toggleSection(itapPage1.basicInfoToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage1.firstNamefield).toBeVisible();
    await expect(itapPage1.basicInfoToggleIcon).toHaveClass(/mx-icon-substract/);
  });

  // Excel TC_07
  test('TC_07: Verify First Name (As per Aadhaar) is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { firstName: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('First Name is mandatory');
  });

  // Excel TC_08
  test('TC_08: Verify Last Name is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { lastName: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Last Name is mandatory');
  });

  // Excel TC_09
  test('TC_09: Verify HQ Preference is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { skipHQPreference: true });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('HQ Preference is mandatory');
  });

  // Excel TC_10
  test('TC_10: Verify the Role dropdown shows the correct options', async () => {
    const options = (await itapPage1.role.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(options).toEqual(['Medical / Sales Representative', 'Manager']);
  });
});

test.describe('Phase 1 - 1.2 Personal Details', () => {
  let bf, itapPage1;

  test.beforeEach(async () => {
    ({ bf, itapPage1 } = await newPooledPhase1Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_03 - known defect (see file header comment): the Mother's Net
  // Earning placeholder reads "net worth" instead of "net earning". Asserts
  // the CORRECT wording on purpose, so this genuinely fails as a marker.
  test('TC_03: Verify all static UI text in the "1.2 Personal Details" section, including Communication Address', async () => {
    const text = await bf.page.locator('body').innerText();
    const expectedStrings = [
      '1.2 Personal Details',
      'Aadhaar Number*',
      'Pan Card Number*',
      'Mobile Number*',
      'Email ID*',
      'Gender*',
      'Date of Birth*',
      'Marital Status*',
      "Father's Name*",
      'Occupation*',
      'Net Earning / Month*',
      "Mother's Name*",
      'Communication Address',
      'Permanent Address*',
      'Address Line 2',
      'Address Line 3',
      'City*',
      'Pin Code*',
      'State*',
      'District*',
      'Same as Permanent',
      'Current Address*',
    ];
    for (const s of expectedStrings) expect(text).toContain(s);

    await expect(itapPage1.motherIncome).toHaveAttribute('placeholder', "Enter mother's net earning / month");
  });

  // Excel TC_11
  test('TC_11: Verify PAN Card Number rejects an invalid format', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { pan: '12345' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('PAN Card Number is not valid');
  });

  // Excel TC_12
  test('TC_12: Verify Mobile Number requires exactly 10 digits', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { mobile: '98765' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Please enter 10 digit mobile number');
  });

  // Excel TC_13
  test('TC_13: Verify Date of Birth enforces the minimum 18-year age requirement', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { dob: dobYearsAgoDDMMYYYY(17) });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('The minimum permissible age is 18 years.');
  });

  // Excel TC_14
  test('TC_14: Verify the Gender dropdown shows the correct options', async () => {
    await itapPage1.gender.scrollIntoViewIfNeeded();
    await itapPage1.gender.click();
    await bf.hardWait(0.5);
    const options = await bf.page.locator("[role='option']").allTextContents();
    await bf.page.keyboard.press('Escape');
    expect(options).toEqual(['Female', 'Male']);
  });

  // Excel TC_15
  test('TC_15: Verify the Marital Status dropdown shows the correct options', async () => {
    const options = (await itapPage1.maritalStatus.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(options).toEqual(['Single', 'Married', 'Divorced', 'Widowed', 'Other']);
  });

  // Excel TC_16
  test("TC_16: Verify Father's Name is a mandatory field", async () => {
    await fillValidPersonalDetails(itapPage1, bf, { fatherName: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain("Father's Name is mandatory");
  });

  // Excel TC_17
  test("TC_17: Verify Father's Occupation is a mandatory field", async () => {
    await fillValidPersonalDetails(itapPage1, bf, { fatherOcc: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain("Father's Occupation is mandatory");
  });

  // Excel TC_18
  test("TC_18: Verify Father's Net Earning / Month is a mandatory field", async () => {
    await fillValidPersonalDetails(itapPage1, bf, { fatherIncome: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain("Father's Net Earning is mandatory");
  });

  // Excel TC_19
  test("TC_19: Verify Mother's Name is a mandatory field", async () => {
    await fillValidPersonalDetails(itapPage1, bf, { motherName: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain("Mother's Name is mandatory");
  });

  // Excel TC_20
  test("TC_20: Verify Mother's Occupation is a mandatory field", async () => {
    await fillValidPersonalDetails(itapPage1, bf, { motherOcc: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain("Mother's Occupation is mandatory");
  });

  // Excel TC_21
  test("TC_21: Verify Mother's Net Earning / Month is a mandatory field", async () => {
    await fillValidPersonalDetails(itapPage1, bf, { motherIncome: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain("Mother's Net Earning is mandatory");
  });

  // (The dedicated Mother's Net Earning placeholder test that used to sit
  // here was removed 2026-09-18 along with its Excel row - it duplicated
  // TC_03's static-text check, which still asserts the correct "net
  // earning" wording and still fails against the live "net worth" bug.)

  // Excel TC_31
  test('TC_31: Verify the "1.2 Personal Details" section toggle expands and collapses the section correctly', async () => {
    await expect(itapPage1.personalDetailsToggleIcon).toHaveClass(/mx-icon-substract/);

    await itapPage1.toggleSection(itapPage1.personalDetailsToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage1.pancardField).not.toBeVisible();
    await expect(itapPage1.personalDetailsToggleIcon).toHaveClass(/mx-icon-add/);

    await itapPage1.toggleSection(itapPage1.personalDetailsToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage1.pancardField).toBeVisible();
    await expect(itapPage1.personalDetailsToggleIcon).toHaveClass(/mx-icon-substract/);
  });

  // Excel TC_40 - a blank Mobile Number is correctly blocked, and the live
  // message "Please enter 10 digit mobile number" was adopted (2026-09-18)
  // as the correct expectation; Excel's Expected Result says the same.
  test('TC_40: Verify Mobile Number is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { mobile: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Please enter 10 digit mobile number');
  });

  // Excel TC_41 - see file header: live shows "PAN Card Number is not
  // valid" rather than the Excel-specified "PAN Card Number is mandatory"
  // when blank. Asserting the Excel-specified text on purpose.
  test('TC_41: Verify PAN Card Number is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { pan: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('PAN Card Number is mandatory');
  });

  // Excel TC_42 - see file header: live shows "The minimum permissible age
  // is 18 years." rather than the Excel-specified "Date of Birth is
  // mandatory" when blank. Asserting the Excel-specified text on purpose.
  test('TC_42: Verify Date of Birth is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { dob: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Date of Birth is mandatory');
  });

  // Excel TC_43
  test('TC_43: Verify Gender is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { skipGender: true });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Gender is mandatory');
  });

  // Excel TC_44
  test('TC_44: Verify Marital Status is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { skipMaritalStatus: true });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Marital Status is mandatory');
  });
});

test.describe('Phase 1 - 1.2 Communication Address', () => {
  let bf, itapPage1;

  test.beforeEach(async () => {
    ({ bf, itapPage1 } = await newPooledPhase1Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_22
  test('TC_22: Verify Permanent Address is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { addressLine1: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Permanent address is mandatory');
  });

  // Excel TC_23
  test('TC_23: Verify Permanent Address City is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { city: '' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('City is mandatory');
  });

  // Excel TC_24
  test('TC_24: Verify Permanent Address Pin Code must be a valid format', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { pin: '123' });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Please enter valid pincode');
  });

  // Excel TC_25
  test('TC_25: Verify "Same as Permanent" checkbox copies Permanent Address fields into Current Address', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await expect(itapPage1.currAddLine1).toHaveValue('');

    const permAddr = await itapPage1.perAddLine1.inputValue();
    const permCity = await itapPage1.city.inputValue();
    const permPin = await itapPage1.pin.inputValue();
    const permState = await itapPage1.state.inputValue();
    const permDistrict = await itapPage1.district.inputValue();

    await itapPage1.click_PerAddRadioBtn();
    await bf.hardWait(2);

    await expect(itapPage1.currAddLine1).toHaveValue(permAddr);
    await expect(itapPage1.currCity).toHaveValue(permCity);
    await expect(itapPage1.currPin).toHaveValue(permPin);
    await expect(itapPage1.currState).toHaveValue(permState);
    await expect(itapPage1.currDistrict).toHaveValue(permDistrict);
  });

  // Excel TC_26
  test('TC_26: Verify Current Address is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Current address is mandatory');
  });

  // Excel TC_27
  test('TC_27: Verify Current Address City is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await itapPage1.currAddLine1.fill('Flat No. 204, Green Residency');
    await itapPage1.currPin.fill('136131');
    await itapPage1.currState.selectOption({ label: 'DELHI' });
    await bf.hardWait(2);
    await itapPage1.currDistrict.selectOption({ index: 1 });
    await bf.hardWait(1);
    // City deliberately left blank.
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('City is mandatory');
  });

  // Excel TC_28
  test('TC_28: Verify Current Address Pin Code is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await itapPage1.currAddLine1.fill('Flat No. 204, Green Residency');
    await itapPage1.currCity.fill('Gujarat');
    await itapPage1.currState.selectOption({ label: 'DELHI' });
    await bf.hardWait(2);
    await itapPage1.currDistrict.selectOption({ index: 1 });
    await bf.hardWait(1);
    // Pin Code deliberately left blank.
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('Pin Code is mandatory');
  });

  // Excel TC_29 - NOT a defect (see file header comment): the live State
  // dropdown's 26 entries are exactly what the app is meant to offer.
  // Asserts that exact list, and genuinely passes against it.
  test('TC_29: Verify the State dropdown lists the expected states and union territories', async () => {
    const options = (await itapPage1.state.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(options).toEqual(EXPECTED_STATES);
  });

  // Excel TC_30
  test('TC_30: Verify the District dropdown only populates after State is selected, and lists that state\'s own districts', async () => {
    const beforeOptions = (await itapPage1.district.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(beforeOptions.length).toBe(0);

    await itapPage1.state.selectOption({ label: 'DELHI' });
    await bf.hardWait(2);
    const afterOptions = (await itapPage1.district.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(afterOptions.length).toBeGreaterThan(0);
    for (const d of afterOptions) expect(DELHI_DISTRICTS).toContain(d);
  });

  // Excel TC_45
  test('TC_45: Verify Permanent Address State is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { skipState: true });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('State is mandatory');
  });

  // Excel TC_46
  test('TC_46: Verify Permanent Address District is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { skipDistrict: true });
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('District is mandatory');
  });

  // Excel TC_47 - same expected 26-entry list as TC_29, verified
  // independently on the Current Address block's own dropdown.
  test('TC_47: Verify the State dropdown (Current Address) lists the expected states and union territories', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    const options = (await itapPage1.currState.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(options).toEqual(EXPECTED_STATES);
  });

  // Excel TC_48
  test('TC_48: Verify the District dropdown (Current Address) only populates after State is selected, and lists that state\'s own districts', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    const beforeOptions = (await itapPage1.currDistrict.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(beforeOptions.length).toBe(0);

    await itapPage1.currState.selectOption({ label: 'DELHI' });
    await bf.hardWait(2);
    const afterOptions = (await itapPage1.currDistrict.locator('option').allTextContents())
      .map((o) => o.trim())
      .filter(Boolean);
    expect(afterOptions.length).toBeGreaterThan(0);
    for (const d of afterOptions) expect(DELHI_DISTRICTS).toContain(d);
  });

  // Excel TC_49
  test('TC_49: Verify Current Address State is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await itapPage1.currAddLine1.fill('Flat No. 204, Green Residency');
    await itapPage1.currCity.fill('Gujarat');
    await itapPage1.currPin.fill('136131');
    // State deliberately left blank (District has no options without it).
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('State is mandatory');
  });

  // Excel TC_50
  test('TC_50: Verify Current Address District is a mandatory field', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { sameAsPermanentAddress: false });
    await itapPage1.currAddLine1.fill('Flat No. 204, Green Residency');
    await itapPage1.currCity.fill('Gujarat');
    await itapPage1.currPin.fill('136131');
    await itapPage1.currState.selectOption({ label: 'DELHI' });
    await bf.hardWait(2);
    // District deliberately left blank.
    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages).toContain('District is mandatory');
  });
});

test.describe('Phase 1 - 1.3 General Details', () => {
  let bf, itapPage1;

  test.beforeEach(async () => {
    ({ bf, itapPage1 } = await newPooledPhase1Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_04
  test('TC_04: Verify all static UI text in the "1.3 General Details" section', async () => {
    const text = await bf.page.locator('body').innerText();
    const expectedStrings = [
      '1.3 General Details',
      'Do you have your own vehicle?',
      'Vehicle No.',
      'Have you ever given interview in Mankind Pharma Ltd. in the past?',
      'Interview Date',
    ];
    for (const s of expectedStrings) expect(text).toContain(s);
    await expect(itapPage1.saveBtn).toBeVisible();
    await expect(itapPage1.nextBtn).toBeVisible();
  });

  // Excel TC_32
  test('TC_32: Verify the "1.3 General Details" section toggle expands and collapses the section correctly', async () => {
    await expect(itapPage1.generalDetailsToggleIcon).toHaveClass(/mx-icon-substract/);

    await itapPage1.toggleSection(itapPage1.generalDetailsToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage1.vehicleNumToggleyes).not.toBeVisible();
    await expect(itapPage1.generalDetailsToggleIcon).toHaveClass(/mx-icon-add/);

    await itapPage1.toggleSection(itapPage1.generalDetailsToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage1.vehicleNumToggleyes).toBeVisible();
    await expect(itapPage1.generalDetailsToggleIcon).toHaveClass(/mx-icon-substract/);
  });

  // Excel TC_33
  test('TC_33: Verify Vehicle No. field cannot be typed into when "Do you have your own vehicle?" is set to "No"', async () => {
    await itapPage1.select_vehicleNum_no();
    await bf.hardWait(1);

    const count = await itapPage1.vehicleNum.count();
    if (count === 0) {
      expect(count).toBe(0);
    } else {
      await expect(itapPage1.vehicleNum).toBeDisabled();
    }
  });

  // Excel TC_34
  test('TC_34: Verify Vehicle No. becomes enabled and mandatory when "Do you have your own vehicle?" is set to "Yes"', async () => {
    await fillValidPersonalDetails(itapPage1, bf, { vehicleNumber: '' });
    await expect(itapPage1.vehicleNum).toBeEnabled();

    await itapPage1.click_NextBtn();
    await bf.hardWait(1.5);
    const messages = await itapPage1.getVisibleValidationMessages();
    expect(messages.some((m) => /vehicle/i.test(m))).toBe(true);
  });

  // Excel TC_35
  test('TC_35: Verify Interview Date field cannot be typed into when "Have you ever given interview in Mankind Pharma Ltd. in the past?" is set to "No"', async () => {
    await itapPage1.select_No_InterviewDate();
    await bf.hardWait(1);

    const count = await itapPage1.interviewDate.count();
    if (count === 0) {
      expect(count).toBe(0);
    } else {
      await expect(itapPage1.interviewDate).toBeDisabled();
    }
  });

  // Excel TC_36
  test('TC_36: Verify Interview Date field becomes enabled when "Have you ever given interview in Mankind Pharma Ltd. in the past?" is set to "Yes"', async () => {
    await itapPage1.select_InterviewDate('01/01/2024');
    await bf.hardWait(1);

    await expect(itapPage1.interviewDate).toBeEnabled();
    await expect(itapPage1.interviewDate).toHaveValue('01/01/2024');
  });
});

// Built from the same Excel workbook, sheet "Phase1" rows 52-92 (Excel IDs
// TC_51..TC_91), covering the "2. Qualification Details" section (10th,
// 12th, Graduation, Add/Remove Qualification) plus the 4 step-indicator
// navigation tests (TC_88-91). Second automation pass for this module -
// written 2026-09-22, verified live in batches (see each describe block's
// own notes) rather than all at once, per explicit direction.
//
// Real bug fixed along the way (see pages/Candidate/Phase1.js's
// click_PerAddRadioBtn() comment): reaching Qualification Details always
// requires a genuine, successful Personal Details submission first (unlike
// most of TC_01-50, which rely on a Next click that validation blocks and
// which never persists anything) - repeating that against the SAME pooled
// candidate was silently unchecking "Same as Permanent" on the second and
// later runs. Fixed to be idempotent; newPooledQualificationSession() above
// is safe to reuse across this whole suite as a result.
//
// Confirmed live (2026-09-22), load-bearing for several tests below:
//   - 10th and 12th are each independently optional ONLY when left blank
//     TOGETHER. If either one has ANY data while the other is completely
//     blank, Next is blocked with "Enter To and From dates for 10th and
//     12th" - a cross-field rule the Excel rows don't call out explicitly.
//     Every test below that targets one of 10th/12th's own fields therefore
//     fills the OTHER one validly too, isolating the field under test the
//     same way TC_01-50 isolates one Personal Details field at a time.
//   - The Graduation "Type" element (Snip_Qualification.dropDown3) is a
//     plain native <select class="form-control">, not a custom widget -
//     confirmed via its own tag name.
//   - Exact validation message text confirmed live for the blank-Graduation
//     case: "Select Course" / "Select From Date" / "Select To Date" /
//     "Select Qualification Type" / "Please enter valid Percentage of
//     Marks" (this last one is shared verbatim by 10th/12th/Graduation's own
//     % Of Marks fields, in and out of [2,100] range alike).
//   - "To Date cannot be earlier or same as From Date" is shared verbatim
//     across 10th/12th/Graduation's own From/To pairs.
//   - Cross-section chronological messages: "12th start date can not be
//     prior to 10th end date." and "Start date can not be prior to 12th end
//     date." (the latter for Graduation's From vs 12th's To).
//   - There is NO future-date restriction on 10th/12th/Graduation dates at
//     all - confirmed live by filling 10th/12th/Graduation entirely with
//     internally-consistent FUTURE dates (up to 7 years out) and getting
//     zero validation messages. TC_59/TC_64/TC_77 (each expects a future
//     date to be rejected, per the Excel spec) are kept asserting the
//     EXCEL-SPECIFIED behavior on purpose, matching this project's "assert
//     the correct/spec'd behavior, stay red as a marker" convention for
//     confirmed live defects (see TC_03/TC_41/TC_42 in this file's own
//     header) - each will be confirmed live and Excel updated per batch.

test.describe('Phase 1 - 2. Qualification Details - Page Shell & Entry', () => {
  // Excel TC_51 - needs a genuinely fresh account: this is the entry-point
  // test for the whole section, verifying Next from a fully-valid Personal
  // Details actually renders Qualification Details.
  test('TC_51: Verify clicking Next on Personal Details renders the Qualification Details section', async () => {
    const { bf, itapPage1 } = await newFreshPhase1Session();
    try {
      await fillValidPersonalDetails(itapPage1, bf);
      await itapPage1.click_NextBtn();
      await bf.hardWait(2.5);

      const messages = await itapPage1.getVisibleValidationMessages();
      expect(messages.length).toBe(0);

      // Step indicator: step 1 completed (checkmark), step 2 current (no
      // checkmark, same active styling) - see Phase1.js's stepXCircle
      // locator comments for how "completed" vs "current" is told apart.
      await expect(itapPage1.stepPersonalDetailsCircle.locator('img')).toBeVisible();
      await expect(itapPage1.stepQualificationDetailsCircle.locator('img')).toHaveCount(0);

      const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
      await expect(itapPage2.Xth_FromDate).toBeVisible();
      await expect(itapPage2.graduation_course).toBeVisible();
    } finally {
      await bf.closeBrowser();
    }
  });
});

test.describe('Phase 1 - 2. Qualification Details - Page Shell', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_52 - every string below confirmed live (2026-09-22) via a
  // throwaway Playwright probe against the actual Qualification Details page.
  test('TC_52: Verify all static UI text in the Qualification Details section', async () => {
    const text = await bf.page.locator('body').innerText();
    const expectedStrings = [
      '10th', 'From', 'To', 'Specialization', '% Of Marks',
      '12th',
      'Graduation', 'Course*', 'From*', 'To*', 'Type*', 'Distance', 'Regular',
      'Add Qualification', 'Save', 'Next',
    ];
    for (const s of expectedStrings) expect(text).toContain(s);
  });

  // Excel TC_53
  test('TC_53: Verify the step indicator correctly reflects progress on the Qualification Details page', async () => {
    const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
    await expect(itapPage1.stepPersonalDetailsCircle.locator('img')).toBeVisible();
    await expect(itapPage1.stepQualificationDetailsCircle.locator('img')).toHaveCount(0);
    await expect(itapPage1.stepQualificationDetailsCircle).toHaveCSS('background-color', 'rgb(50, 43, 124)');
    await expect(itapPage1.stepExperienceDetailsCircle).toHaveClass(/wizard-inactive/);
  });

  // Excel TC_54
  test('TC_54: Verify the 10th/12th/Graduation section toggles expand and collapse correctly', async () => {
    await expect(itapPage2.tenthToggleIcon).toHaveClass(/mx-icon-substract/);
    await itapPage2.toggleSection(itapPage2.tenthToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage2.Xth_FromDate).not.toBeVisible();
    await expect(itapPage2.tenthToggleIcon).toHaveClass(/mx-icon-add/);
    await itapPage2.toggleSection(itapPage2.tenthToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage2.Xth_FromDate).toBeVisible();
    await expect(itapPage2.tenthToggleIcon).toHaveClass(/mx-icon-substract/);

    await expect(itapPage2.twelfthToggleIcon).toHaveClass(/mx-icon-substract/);
    await itapPage2.toggleSection(itapPage2.twelfthToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage2.XII_FromDate).not.toBeVisible();
    await expect(itapPage2.twelfthToggleIcon).toHaveClass(/mx-icon-add/);
    await itapPage2.toggleSection(itapPage2.twelfthToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage2.XII_FromDate).toBeVisible();
    await expect(itapPage2.twelfthToggleIcon).toHaveClass(/mx-icon-substract/);

    await expect(itapPage2.graduationToggleIcon).toHaveClass(/mx-icon-substract/);
    await itapPage2.toggleSection(itapPage2.graduationToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage2.graduation_course).not.toBeVisible();
    await expect(itapPage2.graduationToggleIcon).toHaveClass(/mx-icon-add/);
    await itapPage2.toggleSection(itapPage2.graduationToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage2.graduation_course).toBeVisible();
    await expect(itapPage2.graduationToggleIcon).toHaveClass(/mx-icon-substract/);
  });
});

test.describe('Phase 1 - 2.1 10th', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_55 - 10th AND 12th left blank together (see this file's header
  // note on the confirmed-live cross-field rule); Graduation filled validly.
  test('TC_55: Verify the 10th section can be left entirely blank', async () => {
    await fillValidQualification(itapPage2, bf, { skipXth: true, skipXII: true });
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
  });

  // Excel TC_56 - two payloads (below and above range) in one test, matching
  // this project's established single-test convention for a shared message
  // (see SignIn.spec.js's TC_11). 12th filled validly to isolate 10th's own
  // % Of Marks field from the cross-field 10th/12th rule.
  test('TC_56: Verify 10th % Of Marks rejects a value outside the valid [2, 100] range', async () => {
    await fillValidQualification(itapPage2, bf, { xthMarks: '1' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
    let messages = await itapPage2.getVisibleValidationMessages();
    expect(messages).toContain('Please enter valid Percentage of Marks');

    await itapPage2.Xth_Marks.fill('101');
    await bf.page.keyboard.press('Tab');
    await bf.hardWait(1);
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
    messages = await itapPage2.getVisibleValidationMessages();
    expect(messages).toContain('Please enter valid Percentage of Marks');
  });

  // Excel TC_57
  test('TC_57: Verify 10th % Of Marks accepts a valid decimal value', async () => {
    await fillValidQualification(itapPage2, bf, { xthMarks: '78.00' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
  });

  // Excel TC_58
  test('TC_58: Verify 10th "To" date must be after "From" date', async () => {
    await fillValidQualification(itapPage2, bf, { xthFrom: '02/02/2011', xthTo: '02/02/2010' });
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages).toContain('To Date cannot be earlier or same as From Date');
  });

  // Excel TC_59 - confirmed live (2026-09-22, see this file's header note):
  // the app has NO future-date restriction on 10th's dates at all. Kept
  // asserting the Excel-specified rejection on purpose, as a marker, the
  // same way TC_03/TC_41/TC_42 do for their own confirmed-live defects.
  test('TC_59: Verify 10th dates cannot be set in the future', async () => {
    const future1 = futureDateDDMMYYYY(12);
    await fillValidQualification(itapPage2, bf, {
      xthFrom: '02/02/2010', xthTo: future1,
      xiiFrom: futureDateDDMMYYYY(13), xiiTo: futureDateDDMMYYYY(20),
      gradFrom: futureDateDDMMYYYY(21), gradTo: futureDateDDMMYYYY(30),
    });
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.length).toBeGreaterThan(0);
  });
});

test.describe('Phase 1 - 2.2 12th', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_60 - see TC_55's own comment; 12th AND 10th left blank together.
  test('TC_60: Verify the 12th section can be left entirely blank', async () => {
    await fillValidQualification(itapPage2, bf, { skipXth: true, skipXII: true });
    await itapPage2.click_NextBtn();
    await bf.hardWait(2);
    const messages = await itapPage2.getVisibleValidationMessages();
    expect(messages.length).toBe(0);
  });
});

// Clicks Qualification Details' Next and returns the resulting validation
// messages, waiting on the REAL signal rather than a fixed sleep.
//
// Added 2026-09-23. settle() on its own is NOT sufficient after this
// particular click, and the reason is worth recording: Mendix validates
// Qualification Details SERVER-side, so between the click and the response
// the DOM is completely quiet — settle() sees that quiescence as "done" and
// returns after its ~550ms floor, before any validation message exists.
// (Observed live: an assertion right after settle() saw zero messages, while
// the identical flow with a 3s sleep saw "Select Course".) The TC_51-TC_60
// block papers over this with bf.hardWait(2), which is both slower than it
// needs to be and not actually guaranteed.
//
// Instead, race the two genuine outcomes of the click: either a validation
// message renders, or the submission was accepted and the page left
// Qualification Details (the "Add Qualification" button disappears). Then
// settle() to let the resulting re-render finish. Bounded and non-throwing —
// on timeout the caller's own assertion reports the real problem.
async function clickNextAndGetValidationMessages(itapPage2, bf) {
  await itapPage2.click_NextBtn();
  await bf.page
    .waitForFunction(
      () => !!document.querySelector('.mx-validation-message')
        || !document.body.innerText.includes('Add Qualification'),
      undefined,
      { timeout: 10000, polling: 150 },
    )
    .catch(() => {});
  await settle(bf);
  return itapPage2.getVisibleValidationMessages();
}

// ---- Batch 2: TC_61-TC_70 (Excel rows 62-71) ----
// Written and verified live 2026-09-23. Unlike TC_51-TC_60 above, these use
// newPooledQualificationSessionFast() — the step-circle jump — instead of
// re-filling all of Personal Details on every test (see that helper's own
// comment for the live verification behind it). Everything else follows the
// exact same conventions as the TC_51-TC_60 block: the OTHER of 10th/12th is
// always filled validly so the confirmed-live cross-field "Enter To and From
// dates for 10th and 12th" rule can't add noise, and each test isolates
// exactly one field/behavior.

test.describe('Phase 1 - 2.2 12th (fields)', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSessionFast());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_61 - mirrors TC_56's shape for 10th: two payloads (below and
  // above range) in one test, since both share one validation message.
  test('TC_61: Verify 12th % Of Marks rejects a value outside the valid [2, 100] range', async () => {
    await fillValidQualification(itapPage2, bf, { xiiMarks: '1' });
    let messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Please enter valid Percentage of Marks');

    await itapPage2.XII_Marks.fill('101');
    await bf.page.keyboard.press('Tab');
    await settle(bf);
    messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Please enter valid Percentage of Marks');
  });

  // Excel TC_62
  test('TC_62: Verify 12th % Of Marks accepts a valid decimal value', async () => {
    await fillValidQualification(itapPage2, bf, { xiiMarks: '85.50' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBe(0);
  });

  // Excel TC_63 - "To" earlier than "From". 12th's From is kept comfortably
  // after 10th's To (02/02/2011) so the separate cross-section chronological
  // rule (TC_65) can't fire instead and mask the one being tested.
  test('TC_63: Verify 12th "To" date must be after "From" date', async () => {
    await fillValidQualification(itapPage2, bf, { xiiFrom: '02/02/2013', xiiTo: '02/02/2012' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('To Date cannot be earlier or same as From Date');
  });

  // Excel TC_64 - same shape as TC_59 (10th future dates). Per this file's
  // header note, the app appears to have NO future-date restriction on
  // Qualification dates at all; asserting the EXCEL-SPECIFIED rejection on
  // purpose so this stays red as a marker if that's confirmed again here.
  // 10th stays in the past and Graduation is pushed further out than 12th so
  // the only rule that could possibly fire is the future-date one.
  test('TC_64: Verify 12th dates cannot be set in the future', async () => {
    await fillValidQualification(itapPage2, bf, {
      xthFrom: '02/02/2010', xthTo: '02/02/2011',
      xiiFrom: futureDateDDMMYYYY(12), xiiTo: futureDateDDMMYYYY(20),
      gradFrom: futureDateDDMMYYYY(21), gradTo: futureDateDDMMYYYY(30),
    });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBeGreaterThan(0);
  });

  // Excel TC_65 - cross-section chronology: 12th's From set BEFORE 10th's To.
  // The expected message text comes from this file's header note (confirmed
  // live 2026-09-22 while mapping this section).
  //
  // Graduation is pushed out to 2015-2019 on purpose. With the default
  // gradFrom of 02/02/2014 this test first failed for the wrong reason: that
  // equals the 12th "To" date used here, which tripped Graduation's OWN
  // chronological rule ("Start date can not be prior to 12th end date.") and
  // masked the 10th-vs-12th rule actually under test. Keeping Graduation
  // clear of 12th's range isolates the one rule being asserted.
  test('TC_65: Verify 12th\'s "From" date must be chronologically after 10th\'s "To" date', async () => {
    await fillValidQualification(itapPage2, bf, {
      xthFrom: '02/02/2010', xthTo: '02/02/2013',
      xiiFrom: '02/02/2011', xiiTo: '02/02/2014',
      gradFrom: '02/02/2015', gradTo: '02/02/2019',
    });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('12th start date can not be prior to 10th end date.');
  });

  // Excel TC_119 - educational-plausibility rule: 11th and 12th together take
  // two years, so 12th cannot COMPLETE less than 2 years after 10th completed
  // (10th done 2019 => 12th no earlier than 2021). Distinct from TC_65, which
  // is about start-date ordering rather than the minimum span between them.
  //
  // Data is chosen so no OTHER rule can fire and mask this one: 12th's To
  // (2020) is later than 10th's To (2019), so the confirmed end-date-vs-end-date
  // check behind TC_65 stays quiet; Graduation sits well clear at 2022-2024;
  // every date is in the past; both To-after-From pairs are valid.
  //
  // Asserts only that SOME validation message appears, not a specific string:
  // if this rule doesn't exist yet there is no wording to assert, and inventing
  // expected text would make a failure unreadable.
  test('TC_119: Verify 12th\'s completion date is at least 2 years after 10th\'s completion date', async () => {
    await fillValidQualification(itapPage2, bf, {
      xthFrom: '02/02/2018', xthTo: '02/02/2019',
      xiiFrom: '02/02/2019', xiiTo: '02/02/2020', // only a 1-year gap - too short
      gradFrom: '02/02/2022', gradTo: '02/02/2024',
    });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBeGreaterThan(0);
  });
});

test.describe('Phase 1 - 2.3 Graduation (mandatory fields)', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSessionFast());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_66-TC_70 all follow one shape: 10th and 12th filled validly,
  // Graduation filled validly EXCEPT the single field under test, which is
  // actively cleared (see fill_graduationDetailsOmitting()'s comment on why
  // clearing rather than skipping is required against the pooled candidate).

  // Excel TC_66
  test('TC_66: Verify Graduation Course is a mandatory field', async () => {
    await fillValidQualification(itapPage2, bf, { gradOmit: 'course' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Select Course');
  });

  // Excel TC_67
  test('TC_67: Verify Graduation "From" date is a mandatory field', async () => {
    await fillValidQualification(itapPage2, bf, { gradOmit: 'from' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Select From Date');
  });

  // Excel TC_68
  test('TC_68: Verify Graduation "To" date is a mandatory field', async () => {
    await fillValidQualification(itapPage2, bf, { gradOmit: 'to' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Select To Date');
  });

  // Excel TC_69
  test('TC_69: Verify Graduation Type is a mandatory field', async () => {
    await fillValidQualification(itapPage2, bf, { gradOmit: 'type' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Select Qualification Type');
  });

  // Excel TC_70 - shares the same message as the out-of-range % Of Marks
  // cases (confirmed live 2026-09-22, see this file's header note).
  test('TC_70: Verify Graduation % Of Marks is a mandatory field', async () => {
    await fillValidQualification(itapPage2, bf, { gradOmit: 'marks' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Please enter valid Percentage of Marks');
  });
});

// ---- Batch 3: TC_71-TC_91 (Excel rows 72-92) ----
// WRITTEN 2026-09-23 WITHOUT A LIVE RUN. Chrome is blocked at OS level by a
// corporate group policy (browserType.launch: spawn UNKNOWN), so unlike
// TC_01-TC_70/TC_119 above, NONE of the tests below have been executed
// against the real app yet. Their Excel rows all stay "Pending" - no result
// has been recorded for any of them. Every place where the app's real
// behavior or exact message wording could not be derived from an
// already-confirmed fact is either asserted behaviourally (a message
// appeared / the form did or didn't advance) or carries an explicit
// "NEEDS LIVE CONFIRMATION" comment naming the string to check. Nothing here
// asserts an invented message text.
//
// Session choice follows the same rule as the batches above: TC_71-TC_85 use
// the pooled fast path (newPooledQualificationSessionFast()), while
// TC_86-TC_91 use newFreshQualificationSession() because they complete real
// submissions or test multi-section navigation and so need genuinely clean,
// uncontaminated account state.

// The Graduation Course dropdown's authoritative option list, from
// user-provided screenshots (2026-09-22).
//
// This list is COMPLETE. An earlier reading of the screenshots suspected an
// uncaptured alphabetical gap between "Master of Labour Studies" and "Master
// of Veterinary Science"; the user confirmed (2026-09-23) those two entries
// are adjacent, with nothing between them. So this is asserted with strict
// ordered equality, the same way EXPECTED_STATES above is for the State
// dropdown - any entry added, removed, renamed or reordered later fails
// loudly instead of passing silently.
const EXPECTED_GRADUATION_COURSES = [
  'AMIE', 'B.A.', 'B.A. (Hons.)', 'B.Com.', 'B.Com. (Hons.)', 'B.Ed.', 'B.Lib.',
  'B.Pharma', 'B.Sc.', 'B.Sc.(Engg.)', 'B.Sc.(Hons.)', 'B.Tech.', 'B.Tech.(Hons)',
  'Bach. In Public Relations', 'Bach. of Social Work (BSW)',
  'Bachelor of Business Mgmt.', 'Bachelor of Business Studies',
  'Bachelor of Hotel Management', 'Bachelor of Literature',
  'Bachelor of Rural Std. or Sci.', 'Bachelor of Veterinary Science',
  'BBA', 'BBE', 'BCA', 'BE', 'BE(Hons.)', 'Below 10th', 'CA', 'Certificate',
  'CFA', 'Commercial Practice', 'Computer Programming', 'Computer Science',
  'CS', 'Diploma', 'Diploma in Pharmacy', 'Exec.Dev.Program',
  'Fellowship Program', 'Foundation Course', 'ICWA', 'ITI',
  'Linguistics / Language', 'LL.B.', 'LL.B.(A)', 'LL.M.', 'M.COM', 'M.Lib.',
  'M.Pharma', 'M.Phil.', 'M.Sc.', 'M.Tech.', 'MA', 'Master in IT (MIT)',
  'Master of Finance & Control', 'Master of Labour Studies',
  'Master of Veterinary Science', 'MBA', 'MBBS', 'MBE', 'MCA', 'ME',
  // 'Ph.D' has NO trailing period - confirmed live and by the user 2026-09-24.
  // It briefly read 'Ph.D.' here because the original transcription absorbed a
  // sentence-ending period from the prose it was copied out of; that produced a
  // false TC_72 failure against a correct app.
  'MSW (Master of Social Work)', 'Others', 'PG Diploma', 'Ph.D',
];

test.describe('Phase 1 - 2.3 Graduation (fields, dropdowns & dates)', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSessionFast());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_71 - Specialization is the one optional field in an otherwise
  // fully-mandatory Graduation section. The field is ACTIVELY blanked rather
  // than merely left untouched, for the reason documented on
  // fill_graduationDetailsOmitting(): Qualification Details fields persist
  // per-field against the pooled candidate, so an earlier test's
  // Specialization value would otherwise still be sitting there and the
  // "left blank" condition would never actually be exercised.
  test('TC_71: Verify Graduation Specialization is optional', async () => {
    await fillValidQualification(itapPage2, bf);
    await itapPage2.graduation_Specialization.fill('');
    await bf.page.keyboard.press('Tab');
    await settle(bf);

    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBe(0);
  });

  // Excel TC_72 - strict ordered equality, since the option list is now
  // confirmed complete (see EXPECTED_GRADUATION_COURSES above).
  //
  // LIVE RESULT (2026-09-23): FAILS, and the failure is real, not a helper
  // artefact. Virtualisation was ruled out - the popup renders all 65
  // options up front (see getGraduationCourseOptions()'s own note) - and the
  // read itself was a genuine helper bug that has since been fixed (it used
  // to return an empty array when a re-render tore the popup down mid-read).
  // With that fixed, the live list is 65 entries in exactly this order with
  // exactly ONE difference: the final entry renders as "Ph.D" - no trailing
  // period - where the user-confirmed expected list has "Ph.D.". Every other
  // entry matches character for character.
  //
  // Left asserting "Ph.D." on purpose, per this project's convention for a
  // confirmed discrepancy: TC_72's Expected Result explicitly says none of
  // the entries should be misspelled, so a missing period is exactly what
  // this test exists to catch. Awaiting the user's ruling on whether the app
  // label or the Excel expectation is the thing to correct.
  test('TC_72: Verify the Graduation Course dropdown shows the correct list of options', async () => {
    const options = await itapPage2.getGraduationCourseOptions();
    expect(options).toEqual(EXPECTED_GRADUATION_COURSES);
  });

  // Excel TC_73 - strict equality IS appropriate here: the two options were
  // confirmed from a user-provided screenshot (2026-09-22) and independently
  // by the live probe behind fill_graduationDetailsOmitting()'s comment,
  // which found the native <select>'s options to be ['', 'Distance',
  // 'Regular'] (the blank placeholder is filtered out by
  // getGraduationTypeOptions(), matching TC_10/TC_15's own convention).
  test('TC_73: Verify the Graduation Type dropdown shows exactly "Distance" and "Regular"', async () => {
    const options = await itapPage2.getGraduationTypeOptions();
    expect(options).toEqual(['Distance', 'Regular']);
  });

  // Excel TC_74 - mirrors TC_56/TC_61's shape (below-range then above-range
  // in one test, since both share one message). The message text is NOT a
  // guess: it is the same string TC_70 confirmed live for Graduation's own
  // % Of Marks field.
  test('TC_74: Verify Graduation % Of Marks rejects a value outside the valid [2, 100] range', async () => {
    await fillValidQualification(itapPage2, bf, { gradMarks: '1' });
    let messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Please enter valid Percentage of Marks');

    await itapPage2.graduation_Marks.fill('101');
    await bf.page.keyboard.press('Tab');
    await settle(bf);
    messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Please enter valid Percentage of Marks');
  });

  // Excel TC_75
  test('TC_75: Verify Graduation % Of Marks accepts a valid decimal value', async () => {
    await fillValidQualification(itapPage2, bf, { gradMarks: '78.00' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBe(0);
  });

  // Excel TC_76 - Graduation's "From" is kept well clear of 12th's "To"
  // (default 02/02/2013) so the separate cross-section rule exercised by
  // TC_78 can't fire and mask the one under test.
  //
  // WORDING NOW CONFIRMED LIVE (2026-09-23). Graduation does reuse the exact
  // same string 10th and 12th already use (TC_58/TC_63):
  // "To Date cannot be earlier or same as From Date" - observed as the one
  // and only validation message for From 02/02/2016 / To 02/02/2015. The
  // assertion is tightened from "something was rejected" to that exact text.
  test('TC_76: Verify Graduation "To" date must be after "From" date', async () => {
    await fillValidQualification(itapPage2, bf, { gradFrom: '02/02/2016', gradTo: '02/02/2015' });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('To Date cannot be earlier or same as From Date');
  });

  // Excel TC_77 - EXPECTED TO FAIL LIVE, on purpose. TC_59 and TC_64 both
  // already confirmed the app applies NO future-date validation to
  // Qualification dates at all, so this will very likely go straight through.
  // Per this project's established convention (see the file header on
  // TC_03/TC_41/TC_42), the CORRECT behavior is asserted anyway so the test
  // stays red as a genuine defect marker until the app is fixed.
  //
  // Only Graduation's "To" is pushed into the future (its "From" can
  // legitimately be a future date for an ongoing degree, per the Excel
  // description), and 10th/12th stay validly in the past so nothing else can
  // fire.
  test('TC_77: Verify Graduation "To" date cannot be set in the future', async () => {
    await fillValidQualification(itapPage2, bf, {
      xthFrom: '02/02/2010', xthTo: '02/02/2011',
      xiiFrom: '02/02/2012', xiiTo: '02/02/2013',
      gradFrom: '02/02/2016', gradTo: futureDateDDMMYYYY(12),
    });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBeGreaterThan(0);
  });

  // Excel TC_78 - the exact message here IS confirmed: TC_65 tripped this
  // very rule accidentally while testing something else and recorded its
  // wording ("Start date can not be prior to 12th end date.").
  //
  // The data deliberately isolates a GENUINE start-date violation. TC_65
  // found that the analogous 10th->12th rule is keyed off the wrong field
  // (it compares END dates rather than start-vs-end), and this rule may carry
  // the same bug, so:
  //   - Graduation's From (2014) IS earlier than 12th's To (2016)  -> the
  //     rule as SPECIFIED must fire;
  //   - Graduation's To (2018) is LATER than 12th's To (2016)      -> an
  //     end-vs-end comparison would NOT fire.
  // So if this test passes, the rule is genuinely checking the start date;
  // if it fails, the same end-date bug TC_65 found is present here too.
  test('TC_78: Verify Graduation\'s "From" date must be chronologically after 12th\'s "To" date', async () => {
    await fillValidQualification(itapPage2, bf, {
      xthFrom: '02/02/2008', xthTo: '02/02/2010',
      xiiFrom: '02/02/2012', xiiTo: '02/02/2016',
      gradFrom: '02/02/2014', gradTo: '02/02/2018',
    });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Start date can not be prior to 12th end date.');
  });
});

test.describe('Phase 1 - 2.4 Additional Qualification', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSessionFast());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_79 - block presence is asserted by the Course-combobox COUNT
  // growing, not by the additionalQualificationHeader locator: that h6
  // locator matched zero elements in a live probe (2026-09-23) even while
  // Add Qualification clicks were succeeding, so it is treated as suspect
  // (see pages/Candidate/Phase1.js's qualificationCourseInputs comment).
  //
  // The final "mandatory pattern" assertion encodes the Excel Expected
  // Result (a new block carries the same Course/From/To/Type/% Of Marks
  // requirements) and has NOT been confirmed live - it is asserted
  // behaviourally (the submission is blocked) rather than against any
  // specific message text.
  test('TC_79: Verify "+ Add Qualification" adds an Additional Qualification block with the same field requirements as Graduation', async () => {
    await fillValidQualification(itapPage2, bf);

    const before = await itapPage2.qualificationBlockCount();
    const after = await itapPage2.clickAddQualification();
    expect(after).toBe(before + 1);

    // The block just added is the (after - 1)th ADDITIONAL block (block
    // count = 1 Graduation + N additional).
    const fields = itapPage2.additionalQualificationFields(after - 1);
    await expect(fields.course).toBeVisible();
    await expect(fields.fromDate).toBeVisible();
    await expect(fields.toDate).toBeVisible();
    await expect(fields.type).toBeVisible();
    await expect(fields.marks).toBeVisible();
    await expect(fields.specialization).toBeVisible();

    // Same mandatory pattern as Graduation: a completely empty block must
    // block the submission even though Graduation itself is valid.
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBeGreaterThan(0);
  });

  // Excel TC_80 - REWRITTEN 2026-09-24 after the user ruled that unlimited
  // qualifications is the CORRECT behavior, not a defect.
  //
  // History worth keeping, because this row flip-flopped twice on bad
  // evidence: a 2026-09-22 throwaway probe reported the Add button "becoming
  // disabled after 9 additional clicks", and that number was then written into
  // the Excel Expected Result as though it were a requirement. It never was -
  // nobody had specified a cap. The probe had actually hit a different
  // behavior entirely: "Add Qualification" refuses to add while any block on
  // the page is still blank, firing validation on that block's own mandatory
  // fields instead (see addFilledQualificationBlocksUntil()). A
  // click-repeatedly loop that ignores validation messages therefore stalls at
  // 2 blocks and looks exactly like a cap. Once each block is actually FILLED,
  // adding keeps working - probed to 21 total blocks with the button never
  // disabling.
  //
  // So this now asserts what the app actually should do: keep allowing
  // additions. 11 total blocks is used as the bar simply because it clears the
  // old claimed limit of 10 with room to spare; each add+fill cycle is slow,
  // so there is no value in pushing to 21 every run.
  test('TC_80: Verify "+ Add Qualification" allows qualifications to be added without a fixed limit', async () => {
    test.setTimeout(600000);

    const reached = await itapPage2.addFilledQualificationBlocksUntil(11);

    expect(reached).toBe(11);
    expect(await itapPage2.qualificationBlockCount()).toBe(11);
    // The control must still be live, not disabled, after all those additions.
    expect(await itapPage2.isAddQualificationDisabled()).toBe(false);
  });

  // Excel TC_81 - locator now CONFIRMED LIVE (2026-09-23). The previously
  // unverified best-effort union matched zero elements for a simple reason:
  // the delete control is not a <button> at all, it is an <img role="button">
  // pointing at a delete_*.svg. See qualificationRemoveButtons in
  // pages/Candidate/Phase1.js for the exact markup.
  //
  // The removal FLOW is likewise confirmed live (not just from the user's
  // screenshot): clicking delete opens a "Confirmation" dialog reading "Are
  // you sure you want to delete this record?" with Yes/No, which must be
  // accepted before the block goes away - removeLastAdditionalQualification()
  // handles that. Also confirmed: the delete icon renders ONLY on Additional
  // Qualification blocks (count 0 with Graduation alone), so Graduation can
  // never be removed by accident.
  test('TC_81: Verify each Additional Qualification block has a way to remove it', async () => {
    const before = await itapPage2.qualificationBlockCount();
    const added = await itapPage2.clickAddQualification();
    expect(added).toBe(before + 1);

    const after = await itapPage2.removeLastAdditionalQualification();
    expect(after).toBe(before);
    // Graduation itself must be untouched by the removal.
    await expect(itapPage2.graduation_course).toBeVisible();
  });

  // Excel TC_82 - REWRITTEN 2026-09-24. Its original premise was "the button
  // was disabled at the cap, does removing a block re-enable it" - but the
  // user ruled that no cap should exist (see TC_80), so that state can never
  // occur and the question is moot. Rather than retire the row, it now covers
  // the part that remains genuinely worth testing: that add still works after
  // a removal, i.e. removing a block doesn't leave the section in a state
  // where nothing more can be added.
  //
  // Distinct from TC_81, which only proves a block CAN be removed; this checks
  // what the section can still do afterwards.
  test('TC_82: Verify a new qualification can still be added after removing one', async () => {
    test.setTimeout(600000);

    // Start from a filled Graduation plus two filled additional blocks, so
    // there is something to remove without touching Graduation itself.
    const start = await itapPage2.addFilledQualificationBlocksUntil(3);
    expect(start).toBe(3);

    const afterRemoval = await itapPage2.removeLastAdditionalQualification();
    expect(afterRemoval).toBe(2);
    await settle(bf);

    // The control must still be usable, and must actually add another block.
    expect(await itapPage2.isAddQualificationDisabled()).toBe(false);
    const afterReAdd = await itapPage2.addFilledQualificationBlocksUntil(3);
    expect(afterReAdd).toBe(3);
  });

  // Excel TC_83 - Graduation is filled validly and ONLY the additional
  // block's Course is left blank, so any validation message that appears can
  // only belong to the additional block.
  //
  // WORDING NOW CONFIRMED LIVE (2026-09-23): the additional block's blank
  // Course produces exactly 'Select Course' - the same string TC_66 confirmed
  // for Graduation's own Course field, as expected from the shared
  // Snip_Qualification snippet. Observed as the sole validation message while
  // Graduation itself was validly filled, which is also the positive proof
  // this test wants: the message can only belong to the additional block.
  // Assertion tightened from "something was rejected" to that exact text.
  test('TC_83: Verify each Additional Qualification block\'s mandatory fields are validated independently', async () => {
    test.setTimeout(240000);

    await fillValidQualification(itapPage2, bf);

    const count = await itapPage2.clickAddQualification();
    expect(count).toBeGreaterThan(1);
    await itapPage2.fill_nthAdditionalQualification(count - 1, { omit: 'course' });
    await settle(bf);

    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toContain('Select Course');
  });
});

test.describe('Phase 1 - 2. Qualification Details - Security', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    ({ bf, itapPage2 } = await newPooledQualificationSessionFast());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_84 - mirrors the Sign In module's own script-injection check.
  // Asserts the OUTCOME (no JS dialog, no script element carrying the
  // payload, no Mendix runtime-error dialog) rather than any particular
  // stored value: the Excel Expected Result explicitly allows the payload to
  // be either stored as-is OR rejected, so asserting the field's exact value
  // back would over-specify.
  test('TC_84: Verify the 10th Specialization field against script injection input', async () => {
    const payload = '<script>alert(1)</script>';
    let dialogSeen = false;
    bf.page.on('dialog', async (d) => {
      dialogSeen = true;
      await d.dismiss().catch(() => {});
    });

    await fillValidQualification(itapPage2, bf, { xthSpecialization: payload });
    await clickNextAndGetValidationMessages(itapPage2, bf);

    expect(dialogSeen).toBe(false);
    const executedAsScript = await bf.page.evaluate(() =>
      Array.from(document.querySelectorAll('script')).some((s) => (s.textContent || '').includes('alert(1)')),
    );
    expect(executedAsScript).toBe(false);
    expect(await bf.page.locator('.mx-dialog').count()).toBe(0);
  });

  // Excel TC_85 - the payload must behave as inert text: no runtime-error
  // dialog, no Mendix error page. Deliberately does NOT assert "zero
  // validation messages": whether a free-text Specialization field also
  // applies a character/format rule to quotes is unknown, and asserting it
  // doesn't would be a guess. What IS asserted is the part the Excel
  // Expected Result actually cares about - no unexpected application
  // behavior.
  test('TC_85: Verify the Graduation Specialization field against SQL injection input', async () => {
    const payload = "' OR '1'='1";
    await fillValidQualification(itapPage2, bf, { gradSpecialization: payload });
    await clickNextAndGetValidationMessages(itapPage2, bf);

    expect(await bf.page.locator('.mx-dialog').count()).toBe(0);
    const bodyText = await bf.page.locator('body').innerText().catch(() => '');
    expect(bodyText).not.toMatch(/Executing runtime operation failed|An error has occurred|Unexpected error/i);
  });
});

// TC_86-TC_91 all need genuinely clean account state - they either complete a
// real submission or walk the wizard back and forth across sections - so each
// gets its own fresh signup via newFreshQualificationSession(), exactly the
// way TC_37/TC_39/TC_51 already do rather than sharing the pooled candidate.
test.describe('Phase 1 - 2. Qualification Details - Save & Step Navigation (fresh account)', () => {
  let bf, itapPage2;

  test.beforeEach(async () => {
    // A fresh signup plus a full Personal Details fill is a long way in
    // before the test body even starts; the default 120s budget covers the
    // TC_01-70 pooled tests but not these. Same convention already used in
    // Phase2.spec.js/Interview specs.
    test.setTimeout(300000);
    ({ bf, itapPage2 } = await newFreshQualificationSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_86 - Save WORKS on Qualification Details. Confirmed by the user
  // (screenshot, 2026-09-23): it opens an "Information" dialog reading
  // "Changes have been saved successfully" with an OK button, which is what
  // the /saved successfully/i assertion below matches.
  //
  // Worth noting the contrast: Save is BROKEN on Personal Details (TC_39 -
  // "Executing runtime operation failed for security reasons"). So that defect
  // is specific to Personal Details, not the Save feature as a whole - useful
  // for whoever fixes TC_39.
  test('TC_86: Verify the Save button persists Qualification Details data across a page refresh', async () => {
    await fillValidQualification(itapPage2, bf);

    await itapPage2.click_SaveBtn();
    await settle(bf, { timeout: 6000 });
    const dialogText = await itapPage2.getDialogTextAndDismiss();
    expect(dialogText).toMatch(/saved successfully/i);

    await bf.page.reload({ waitUntil: 'networkidle' });
    await bf.hardWait(2);

    // Which section the wizard reopens on after a refresh has not been
    // observed; if it lands back on Personal Details, jump forward via the
    // step circle (the same by-label locator newPooledQualificationSessionFast()
    // relies on).
    const onQualification = async () =>
      (await bf.page.locator('body').innerText().catch(() => '')).includes('Add Qualification');
    if (!(await onQualification())) {
      const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
      await itapPage1.stepQualificationDetailsCircleByLabel.click({ force: true }).catch(() => {});
      await settle(bf, { timeout: 6000 });
    }

    await expect(itapPage2.Xth_FromDate).toHaveValue('02/02/2010');
    await expect(itapPage2.XII_FromDate).toHaveValue('02/02/2012');
    await expect(itapPage2.graduation_FromDate).toHaveValue('02/02/2014');
    // Marks may be re-rendered with decimal places (e.g. "90.00"), so this
    // matches the value rather than an exact string.
    await expect(itapPage2.graduation_Marks).toHaveValue(/^90(\.0+)?$/);
  });

  // Excel TC_87 - 10th/12th deliberately left blank (both together, per the
  // confirmed-live cross-field rule noted in this file's header) to prove
  // Graduation alone is enough to unlock Experience Details.
  test('TC_87: Verify clicking Next on Qualification Details renders Experience Details once Graduation is validly complete', async () => {
    await fillValidQualification(itapPage2, bf, { skipXth: true, skipXII: true });
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBe(0);

    const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
    await expect(itapPage3.experienceDetail_yes).toBeVisible();
  });

  // Excel TC_88 - one step further than TC_05's Personal -> Qualification
  // gating. The fresh account arrives at Qualification Details with every
  // Graduation field still blank, so the section is genuinely incomplete;
  // both the step CIRCLE and its LABEL are clicked, matching TC_05's shape.
  test('TC_88: Verify Experience Details remains inaccessible until Qualification Details is completed', async () => {
    const itapPage1 = new ITAPInterviewPerformaPage(bf.page);

    await itapPage1.stepExperienceDetailsCircleByLabel.click({ force: true }).catch(() => {});
    await settle(bf);
    await expect(itapPage2.graduation_course).toBeVisible();

    await itapPage1.stepExperienceDetailsLabel.click({ force: true }).catch(() => {});
    await settle(bf);
    await expect(itapPage2.graduation_course).toBeVisible();
  });

  // Excel TC_89 - Personal Details is already completed at this point (the
  // session helper completed it to reach Qualification Details), so its step
  // circle must navigate straight back to it.
  test('TC_89: Verify a completed step can be navigated back to directly by clicking its step-indicator circle', async () => {
    const itapPage1 = new ITAPInterviewPerformaPage(bf.page);

    await itapPage1.stepPersonalDetailsCircleByLabel.click({ force: true });
    await settle(bf, { timeout: 6000 });

    await expect(itapPage1.firstNamefield).toBeVisible();
    await expect(itapPage1.firstNamefield).toHaveValue(bf.getPropertyValue('FirstName'));
  });

  // Excel TC_90 - follows the Excel steps exactly: complete Qualification
  // Details (which necessarily lands on Experience Details), go back to
  // Personal Details, jump forward to Qualification Details (must open),
  // then click Experience Details (must NOT open).
  //
  // AMBIGUITY WORTH RESOLVING LIVE: completing Qualification Details
  // inherently RENDERS Experience Details once - there is no way to complete
  // step 2 without arriving at step 3. So "Experience Details has not been
  // completed" and "Experience Details has never been reached" are not the
  // same thing here, and the app may legitimately treat step 3 as reachable
  // afterwards. This test encodes the Excel Expected Result (blocked); if it
  // fails live, the Excel row may need rewording rather than the app needing
  // a fix.
  test('TC_90: Verify forward navigation via the step indicator is capped at the highest section ever completed', async () => {
    const itapPage1 = new ITAPInterviewPerformaPage(bf.page);

    await fillValidQualification(itapPage2, bf);
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBe(0);

    await itapPage1.stepPersonalDetailsCircleByLabel.click({ force: true });
    await settle(bf, { timeout: 6000 });
    await expect(itapPage1.firstNamefield).toBeVisible();

    await itapPage1.stepQualificationDetailsCircleByLabel.click({ force: true });
    await settle(bf, { timeout: 6000 });
    await expect(itapPage2.graduation_course).toBeVisible();

    await itapPage1.stepExperienceDetailsCircleByLabel.click({ force: true }).catch(() => {});
    await settle(bf, { timeout: 6000 });
    await expect(itapPage2.graduation_course).toBeVisible();
  });

  // Excel TC_91 - Next (not Save) is used to leave the edited Personal
  // Details section, since Save is the confirmed-broken feature TC_39/TC_86
  // cover; using it here would make this test fail for an unrelated reason.
  test('TC_91: Verify navigating back to an earlier completed section and editing it does not clear data already entered in later completed sections', async () => {
    const itapPage1 = new ITAPInterviewPerformaPage(bf.page);

    await fillValidQualification(itapPage2, bf);
    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages.length).toBe(0);

    await itapPage1.stepPersonalDetailsCircleByLabel.click({ force: true });
    await settle(bf, { timeout: 6000 });
    await expect(itapPage1.firstNamefield).toBeVisible();

    const editedFirstName = 'EditedName';
    await itapPage1.enter_FirstName(editedFirstName);
    await settle(bf);
    await itapPage1.click_NextBtn();
    await settle(bf, { timeout: 8000 });

    const onQualification = async () =>
      (await bf.page.locator('body').innerText().catch(() => '')).includes('Add Qualification');
    if (!(await onQualification())) {
      await itapPage1.stepQualificationDetailsCircleByLabel.click({ force: true }).catch(() => {});
      await settle(bf, { timeout: 6000 });
    }

    // Every Qualification Details value entered before the edit must still be
    // exactly as it was.
    await expect(itapPage2.Xth_FromDate).toHaveValue('02/02/2010');
    await expect(itapPage2.Xth_ToDate).toHaveValue('02/02/2011');
    await expect(itapPage2.XII_FromDate).toHaveValue('02/02/2012');
    await expect(itapPage2.XII_ToDate).toHaveValue('02/02/2013');
    await expect(itapPage2.graduation_FromDate).toHaveValue('02/02/2014');
    await expect(itapPage2.graduation_ToDate).toHaveValue('02/02/2018');
    await expect(itapPage2.graduation_Marks).toHaveValue(/^90(\.0+)?$/);
  });
});

// ---- Phase 1, section 3: Experience Details (3.1 Work Experience) ----
// First automation written for this section. Uses newFreshExperienceSession()
// because Experience Details is gated behind a validly-completed Qualification
// Details, so there is no pooled shortcut to it.
test.describe('Phase 1 - 3.1 Work Experience', () => {
  let bf, itapPage3;

  test.beforeEach(async () => {
    test.setTimeout(300000);
    ({ bf, itapPage3 } = await newFreshExperienceSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_106 - REWRITTEN 2026-09-24. This row previously asserted that
  // checking "Currently working here?" should ALSO disable "Reason of
  // Leaving", and was recorded as a confirmed defect (Failed, P2) on that
  // basis. The user reversed that ruling on 2026-09-24 with a screenshot:
  // the two fields are NOT related. Only "To" is tied to the checkbox;
  // "Reason of Leaving" stays enabled and mandatory regardless, which is the
  // intended design. So this now asserts that, and the defect is withdrawn.
  test('TC_106: Verify "Reason of Leaving" stays enabled and mandatory when "Currently working here?" is checked', async () => {
    await itapPage3.experienceDetail_yes.click();
    await settle(bf, { timeout: 6000 });

    await itapPage3.currentlyWorkingHere.check();
    await settle(bf, { timeout: 6000 });

    // "To" IS tied to the checkbox and must go disabled...
    await expect(itapPage3.ToDate).toBeDisabled();
    // ...while "Reason of Leaving" is independent of it and must stay usable.
    await expect(itapPage3.reasonofleaving).toBeEnabled();
    await itapPage3.reasonofleaving.fill('Relocating');
    await expect(itapPage3.reasonofleaving).toHaveValue('Relocating');
  });
});

// ---- Experience Details (TC_92-TC_105), added 2026-09-24 ----
// Everything below reaches section 3 through newPooledExperienceSession()
// (see its own comment) rather than newFreshExperienceSession(), except
// TC_96, which genuinely SUBMITS and therefore must burn a throwaway
// account of its own.
//
// THE SUBMISSION RULE FOR THIS SECTION: the Submit confirmation dialog reads
// "Are you sure you want to submit? Please ensure all the details are
// correct as you will not be able to edit these later." - a real submission
// is irreversible and permanently consumes the candidate account. So no
// pooled test here may ever click "Yes" on it. The mandatory-field negative
// tests (TC_98-TC_104) all go through
// itapPage3.submitAndCancelIfConfirmed(), which clicks "No" if the app ever
// DOES accept the form - that way a test failing (i.e. the field turning out
// not to be mandatory after all) still leaves the pooled account intact for
// every test after it, instead of silently destroying the rest of the batch.

test.describe('Phase 1 - 3. Experience Details - Entry', () => {
  let bf;

  test.afterEach(async () => {
    if (bf) await bf.closeBrowser();
  });

  // Excel TC_92 - the entry test for this section. Overlaps TC_87
  // conceptually (both prove Next on Qualification Details opens Experience
  // Details) but is kept separate on purpose, same precedent as TC_51 for
  // Qualification Details. Unlike TC_87 it does NOT re-fill Qualification
  // Details: the pooled Experience candidate already completed it validly,
  // so this clicks Next against genuinely-complete data, which is exactly
  // what the Excel steps 1-2 describe.
  test('TC_92: Verify clicking Next on Qualification Details renders the Experience Details section', async () => {
    test.setTimeout(300000);
    let itapPage1, itapPage2;
    ({ bf, itapPage1, itapPage2 } = await reachQualificationAsExperienceCandidate());

    const messages = await clickNextAndGetValidationMessages(itapPage2, bf);
    expect(messages).toEqual([]);

    const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
    await expect(itapPage3.workExperienceSection).toBeVisible();
    await expect(itapPage3.experienceDetail_yes).toBeVisible();
    expect(await bf.page.locator('body').innerText()).toContain('3.1 Work Experience');

    // Steps 1 and 2 completed (each circle carries the checkmark <img>),
    // step 3 current (no checkmark, and no longer wizard-inactive).
    await expect(itapPage1.stepPersonalDetailsCircleByLabel.locator('img')).toHaveCount(1);
    await expect(itapPage1.stepQualificationDetailsCircleByLabel.locator('img')).toHaveCount(1);
    await expect(itapPage1.stepExperienceDetailsCircleByLabel.locator('img')).toHaveCount(0);
    await expect(itapPage1.stepExperienceDetailsCircleByLabel).not.toHaveClass(/wizard-inactive/);
  });
});

test.describe('Phase 1 - 3.1 Work Experience (pooled)', () => {
  let bf, itapPage1, itapPage3;

  test.beforeEach(async () => {
    test.setTimeout(300000);
    ({ bf, itapPage1, itapPage3 } = await newPooledExperienceSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_93 - every string below confirmed live (2026-09-24) against the
  // real page. Two things the Excel row could not have known, both confirmed
  // live rather than assumed:
  //   - the field labels (Company*/Annual Package*/.../Reason of Leaving*)
  //     and the "Add Experience" button do NOT exist until "Yes" is
  //     selected. Landing on the section shows only the heading, the
  //     "Are you experienced ?*" question, the confirmation checkbox and
  //     Save/Submit. So this selects Yes before checking the field labels -
  //     there is no state of the app in which they are all visible without
  //     it.
  //   - "Currently working here ?*" renders its mandatory asterisk as a
  //     separate element, so innerText reads "Currently working here ?" then
  //     "*" on the next line. Matched with a regex rather than a literal for
  //     that reason; the label and its asterisk are both genuinely present.
  test('TC_93: Verify all static UI text in the Experience Details section', async () => {
    const beforeYes = await bf.page.locator('body').innerText();
    for (const s of [
      '3.1 Work Experience',
      'Are you experienced ?*',
      'Yes', 'No',
      'I confirm that the details provided by me are accurate to the best of my knowledge. I understand that any false information may lead to strict action.',
      'Save', 'Submit',
    ]) expect(beforeYes).toContain(s);

    await itapPage3.experienceDetail_yes.click();
    await settle(bf, { timeout: 6000 });

    const afterYes = await bf.page.locator('body').innerText();
    for (const s of [
      'Company*', 'Annual Package*', 'Designation*', 'H.Q.*',
      'From*', 'To*', 'Reason of Leaving*', 'Add Experience',
    ]) expect(afterYes).toContain(s);
    expect(afterYes).toMatch(/Currently working here \?\s*\*/);

    await expect(itapPage3.addExperienceBtn).toBeVisible();
    await expect(itapPage3.confirmationRadioBtn).toBeVisible();
    await expect(itapPage3.saveBtn).toBeVisible();
    await expect(itapPage3.submitBtn).toBeVisible();
  });

  // Excel TC_94 - the by-label circle locators are used (not the class-based
  // ones TC_53 uses) because the mx-name-containerNN numbers differ between
  // this page's two renders; see newPooledExperienceSession()'s comment.
  test('TC_94: Verify the step indicator shows Personal Details and Qualification Details as completed on the Experience Details page', async () => {
    await expect(itapPage1.stepPersonalDetailsCircleByLabel.locator('img')).toHaveCount(1);
    await expect(itapPage1.stepQualificationDetailsCircleByLabel.locator('img')).toHaveCount(1);

    await expect(itapPage1.stepExperienceDetailsCircleByLabel.locator('img')).toHaveCount(0);
    await expect(itapPage1.stepExperienceDetailsCircleByLabel).not.toHaveClass(/wizard-inactive/);
    await expect(itapPage1.stepExperienceDetailsCircleByLabel).toHaveCSS('background-color', 'rgb(50, 43, 124)');
  });

  // Excel TC_95 - same collapse/expand pattern (and same mx-icon-substract /
  // mx-icon-add signal) TC_06/TC_31/TC_32/TC_54 already assert elsewhere in
  // Phase 1.
  test('TC_95: Verify the "3.1 Work Experience" section toggle expands and collapses correctly', async () => {
    await expect(itapPage3.workExperienceToggleIcon).toHaveClass(/mx-icon-substract/);
    await expect(itapPage3.experienceDetail_yes).toBeVisible();

    await itapPage3.toggleSection(itapPage3.workExperienceToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage3.experienceDetail_yes).not.toBeVisible();
    await expect(itapPage3.workExperienceToggleIcon).toHaveClass(/mx-icon-add/);

    await itapPage3.toggleSection(itapPage3.workExperienceToggleIcon);
    await bf.hardWait(1);
    await expect(itapPage3.experienceDetail_yes).toBeVisible();
    await expect(itapPage3.workExperienceToggleIcon).toHaveClass(/mx-icon-substract/);
  });

  // Excel TC_97 - starts by selecting "No", which is what actually removes
  // the fields, and only then selects "Yes" to prove they come back.
  //
  // It cannot simply assert "fields absent on arrival, present after Yes":
  // confirmed live (2026-09-24) that the Experience Details section
  // AUTO-COMMITS whatever has been typed into it as soon as Submit is
  // clicked - even when the "Are you sure you want to submit?" confirmation
  // is answered "No". The submission itself is genuinely cancelled (the
  // account is not consumed, no iTAP number is issued, the candidate stays on
  // the form), but the Yes/No choice and the field values come back on the
  // next sign-in. So the pooled candidate arrives at this section with "Yes"
  // already selected and the fields already showing, and the reveal has to be
  // exercised from a deliberately-set "No" state instead of from a lucky one.
  //
  // Switching to "No" when experience data already exists raises a second,
  // distinct confirmation - "Are you sure you do not have any previous
  // experience?" (Yes/No) - before discarding it; see
  // selectNotExperiencedConfirming(). That dialog does not appear on an
  // account with no experience data, which is why TC_96 never meets it.
  test('TC_97: Verify selecting "Yes" for "Are you experienced?" reveals the experience fields', async () => {
    const noDialogText = await itapPage3.selectNotExperiencedConfirming(bf);
    console.log('[TC_97] "switch to No" dialog:', JSON.stringify(noDialogText));
    await settle(bf, { timeout: 6000 });
    await expect(itapPage3.companyNameInput).toHaveCount(0);

    await itapPage3.experienceDetail_yes.click();
    await settle(bf, { timeout: 6000 });

    await expect(itapPage3.companyNameInput).toBeVisible();
    await expect(itapPage3.Annualpackage).toBeVisible();
    await expect(itapPage3.designation).toBeVisible();
    await expect(itapPage3.HQ).toBeVisible();
    await expect(itapPage3.currentlyWorkingHere).toBeVisible();
    await expect(itapPage3.FromDate).toBeVisible();
    await expect(itapPage3.ToDate).toBeVisible();
    await expect(itapPage3.reasonofleaving).toBeVisible();
  });

  // Excel TC_98-TC_104 - the mandatory-field negative tests. Each fills
  // every OTHER field validly (actively clearing the one under test, see
  // fillExperienceFields()) and then attempts Submit through
  // submitAndCancelIfConfirmed(), which cancels rather than completes any
  // submission the app is willing to accept - so a failing assertion here
  // can never consume the pooled account.
  //
  // CONFIRMED-LIVE DEFECT, TC_102 ("From" is mandatory) - and note the
  // precise shape, because a broader earlier reading was wrong.
  //
  // The rule is CONDITIONAL on "Currently working here?". Probed live
  // 2026-09-24 on two fresh accounts, one per branch:
  //   - checkbox CHECKED   -> "Please enter From date", validates correctly.
  //   - checkbox UNCHECKED -> NO validation message at all; the app throws a
  //     Mendix runtime error instead ("An error occurred, please contact your
  //     system administrator.", server returning HTTP 560 from /xas/).
  // These tests deliberately run the UNCHECKED branch (asserted above), which
  // is why they hit the broken path. An earlier version of this comment said
  // the app "has no validation rule for From" - that was too broad; the rule
  // exists, it just isn't wired into the not-currently-working branch.
  //
  // Not an artefact of how this automation clears the field: reproduced
  // identically on a brand-new, never-filled experience block where "From"
  // had never been touched. This test is left
  // asserting the CORRECT behaviour (a mandatory-field validation message) so
  // it stays red as a marker until the app is fixed, the same convention
  // TC_41/TC_42 already use.
  const mandatoryFieldCases = [
    { id: 'TC_98', title: 'Verify Company is a mandatory field', omit: 'company', match: /company/i },
    { id: 'TC_99', title: 'Verify Annual Package is a mandatory field', omit: 'annualPackage', match: /annual\s*package/i },
    { id: 'TC_100', title: 'Verify Designation is a mandatory field', omit: 'designation', match: /designation/i },
    { id: 'TC_101', title: 'Verify H.Q. is a mandatory field', omit: 'hq', match: /h\.?\s*q\.?|head\s*quarter/i },
    { id: 'TC_102', title: 'Verify "From" date is a mandatory field', omit: 'from', match: /from/i },
    { id: 'TC_103', title: 'Verify "To" date is a mandatory field', omit: 'to', match: /\bto\b/i },
    { id: 'TC_104', title: 'Verify Reason of Leaving is a mandatory field when not currently working', omit: 'reason', match: /reason/i },
  ];

  for (const c of mandatoryFieldCases) {
    test(c.id + ': ' + c.title, async () => {
      await itapPage3.experienceDetail_yes.click();
      await settle(bf, { timeout: 6000 });

      // "Currently working here?" is left unchecked throughout - required by
      // TC_103/TC_104's own preconditions, and the default state anyway.
      await expect(itapPage3.currentlyWorkingHere).not.toBeChecked();
      await itapPage3.fillExperienceFields({ omit: c.omit });
      await settle(bf, { timeout: 6000 });

      const result = await itapPage3.submitAndCancelIfConfirmed(bf);
      console.log('[' + c.id + '] confirmed=' + result.confirmed
        + ' messages=' + JSON.stringify(result.messages)
        + ' errorDialog=' + JSON.stringify(result.errorDialogText));

      // An app crash is never an acceptable answer to a blank mandatory
      // field - surfaced explicitly so the failure reads as what it is.
      expect(result.errorDialogText, 'the app threw a runtime error instead of validating').toBeNull();

      // The app must NOT have been willing to submit with this field blank.
      expect(result.confirmed).toBe(false);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages.some((m) => c.match.test(m))).toBe(true);
    });
  }

  // Excel TC_105 - the "To" half of the same checkbox behaviour TC_106
  // covers from the "Reason of Leaving" side. Confirmed live (2026-09-24):
  // checking the box both DISABLES the To field and clears its placeholder,
  // which is why FromDate/ToDate are anchored on their Mendix datePicker ids
  // rather than on a placeholder index.
  test('TC_105: Verify checking "Currently working here?" disables the "To" date field', async () => {
    await itapPage3.experienceDetail_yes.click();
    await settle(bf, { timeout: 6000 });

    await expect(itapPage3.ToDate).toBeEnabled();
    // Cleared first so the "did it accept input?" check below is unambiguous
    // - the pooled candidate can arrive with a To date already populated
    // (see TC_97's comment on this section auto-committing).
    await itapPage3.ToDate.fill('');
    await itapPage3.ToDate.press('Tab');
    await settle(bf, { timeout: 4000 });

    await itapPage3.currentlyWorkingHere.check();
    await settle(bf, { timeout: 6000 });

    await expect(itapPage3.ToDate).toBeDisabled();
    // ...and genuinely refuses input, not merely styled as disabled.
    await expect(itapPage3.ToDate.fill('31/12/2023', { timeout: 5000 })).rejects.toThrow();
    await expect(itapPage3.ToDate).toHaveValue('');
  });
});

// TC_96 is the one test in this batch that completes a REAL, irreversible
// submission, so it gets its own throwaway account via
// newFreshExperienceSession() and must never touch the pooled candidate.
test.describe('Phase 1 - 3.1 Work Experience (fresh account, real submission)', () => {
  let bf, itapPage3;

  test.beforeEach(async () => {
    test.setTimeout(300000);
    ({ bf, itapPage3 } = await newFreshExperienceSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_96
  test('TC_96: Verify selecting "No" for "Are you experienced?" hides the experience fields and only requires the confirmation checkbox before Submit', async () => {
    await itapPage3.experienceDetail_No.click();
    await settle(bf, { timeout: 6000 });

    // No experience-detail field may be present at all.
    await expect(itapPage3.companyNameInput).toHaveCount(0);
    await expect(itapPage3.Annualpackage).toHaveCount(0);
    await expect(itapPage3.designation).toHaveCount(0);
    await expect(itapPage3.HQ).toHaveCount(0);
    await expect(itapPage3.currentlyWorkingHere).toHaveCount(0);
    await expect(itapPage3.FromDate).toHaveCount(0);
    await expect(itapPage3.ToDate).toHaveCount(0);
    await expect(itapPage3.reasonofleaving).toHaveCount(0);

    await itapPage3.confirmationRadioBtn.scrollIntoViewIfNeeded();
    await itapPage3.confirmationRadioBtn.check();
    await bf.hardWait(1);
    await itapPage3.submitBtn.click();
    await bf.hardWait(2.5);

    // The submission is accepted: the irreversible-submit confirmation
    // dialog appears, and confirming it advances the candidate off the
    // Experience Details form entirely.
    await expect(itapPage3.confirmDialog).toHaveCount(1);
    const dialogText = (await itapPage3.confirmDialog.first().innerText()).trim();
    console.log('[TC_96] confirmation dialog:', JSON.stringify(dialogText));
    expect(dialogText).toContain('Are you sure you want to submit?');

    await itapPage3.confirmDialogYes.first().click();
    await bf.hardWait(4);
    await settle(bf, { timeout: 8000 });

    const body = await bf.page.locator('body').innerText();
    console.log('[TC_96] body after submit:', JSON.stringify(body));
    expect(await itapPage3.getVisibleValidationMessages()).toEqual([]);
    expect(body).not.toContain('Are you experienced');
  });
});

// ---- Experience Details (TC_107-TC_118), added 2026-09-24 ----
// The FINAL batch of Phase 1. Everything here reaches section 3 through
// newPooledExperienceSession() except TC_117, which completes a REAL,
// irreversible submission and therefore burns a throwaway account of its own
// via newFreshExperienceSession().
//
// TWO state facts about this section govern the whole batch, both confirmed
// live:
//   1. It AUTO-COMMITS. Field values, the Yes/No choice, the confirmation
//      checkbox AND any extra experience blocks all survive to the next
//      sign-in, even when the submit confirmation is answered "No". So no
//      test here may assume it arrives at a blank form - each sets the state
//      it needs explicitly.
//   2. Because of (1), a test that adds a second experience block and does
//      not remove it leaves the pooled account permanently multi-block, which
//      strict-mode-breaks every earlier test that uses the unindexed
//      companyNameInput/ToDate/... locators (TC_98-TC_105). That is not
//      hypothetical - it happened during this batch's first live probe. Hence
//      resetToSingleExperienceBlock() in the afterEach below, which runs even
//      when a test fails.

// Ensures "Yes" is selected and at least one experience block is rendered.
// Cheap no-op when the auto-committed state already has Yes selected.
async function ensureExperienceYes(itapPage3, bf) {
  if ((await itapPage3.experienceBlockCount()) === 0) {
    await itapPage3.experienceDetail_yes.click();
    await settle(bf, { timeout: 6000 });
  }
}

test.describe('Phase 1 - 3.1 Work Experience (pooled, TC_107-TC_118)', () => {
  let bf, itapPage1, itapPage3;

  test.beforeEach(async () => {
    test.setTimeout(300000);
    ({ bf, itapPage1, itapPage3 } = await newPooledExperienceSession());
  });

  test.afterEach(async () => {
    // Hand the pooled account back in its one-block state no matter how the
    // test ended - see this describe's header comment.
    if (itapPage3) {
      const left = await itapPage3.resetToSingleExperienceBlock(bf).catch(() => null);
      if (left !== null && left !== 1) console.log('[cleanup] experience blocks left:', left);
    }
    await bf.closeBrowser();
  });

  // Excel TC_107 - the reverse of TC_105. TC_105 proves the checkbox disables
  // "To"; this proves the disabling is not one-way.
  test('TC_107: Verify unchecking "Currently working here?" re-enables the "To" date field', async () => {
    await ensureExperienceYes(itapPage3, bf);

    await itapPage3.currentlyWorkingHere.check();
    await settle(bf, { timeout: 6000 });
    await expect(itapPage3.ToDate).toBeDisabled();

    await itapPage3.currentlyWorkingHere.uncheck();
    await settle(bf, { timeout: 6000 });

    await expect(itapPage3.ToDate).toBeEnabled();
    // Enabled in fact, not merely in styling: it must accept a real value.
    await itapPage3.ToDate.fill('31/12/2023');
    await itapPage3.ToDate.press('Tab');
    await expect(itapPage3.ToDate).toHaveValue('31/12/2023');
  });

  // Excel TC_108 - the ordering rule between From and To within one block.
  // Submitted through submitAndCancelIfConfirmed() so that if the app turns
  // out to ACCEPT the backwards range, the submission is cancelled and the
  // pooled account survives.
  test('TC_108: Verify "To" date must be after "From" date', async () => {
    await ensureExperienceYes(itapPage3, bf);
    await expect(itapPage3.currentlyWorkingHere).not.toBeChecked();

    // To (01/01/2020) is three years EARLIER than From (31/12/2023).
    await itapPage3.fillNthExperience(0, { fromDate: '31/12/2023', toDate: '01/01/2020' });
    await settle(bf, { timeout: 6000 });

    const result = await itapPage3.submitAndCancelIfConfirmed(bf);
    console.log('[TC_108] confirmed=' + result.confirmed
      + ' messages=' + JSON.stringify(result.messages)
      + ' errorDialog=' + JSON.stringify(result.errorDialogText));

    expect(result.errorDialogText, 'the app threw a runtime error instead of validating').toBeNull();
    expect(result.confirmed).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  // Excel TC_109 - a future From/To. Dates are computed relative to today
  // (utils/DateHelpers.js) so this can never silently go stale the way a
  // hardcoded future literal would.
  test('TC_109: Verify From/To dates cannot be set in the future', async () => {
    await ensureExperienceYes(itapPage3, bf);
    await expect(itapPage3.currentlyWorkingHere).not.toBeChecked();

    const futureFrom = futureDateDDMMYYYY(6);
    const futureTo = futureDateDDMMYYYY(12);
    await itapPage3.fillNthExperience(0, { fromDate: futureFrom, toDate: futureTo });
    await settle(bf, { timeout: 6000 });

    const result = await itapPage3.submitAndCancelIfConfirmed(bf);
    console.log('[TC_109] from=' + futureFrom + ' to=' + futureTo
      + ' confirmed=' + result.confirmed
      + ' messages=' + JSON.stringify(result.messages)
      + ' errorDialog=' + JSON.stringify(result.errorDialogText));

    expect(result.errorDialogText, 'the app threw a runtime error instead of validating').toBeNull();
    expect(result.confirmed).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  // Excel TC_110 - block 0 is filled FIRST on purpose: "+ Add Experience"
  // refuses to add while any existing block is blank (confirmed live - it
  // fires "Please enter Company Name" instead). Adding from a blank first
  // block would therefore fail for a reason that has nothing to do with what
  // this row is testing.
  test('TC_110: Verify "+ Add Experience" adds a new experience block with the same field requirements', async () => {
    await ensureExperienceYes(itapPage3, bf);
    await itapPage3.fillNthExperience(0, { fromDate: '01/01/2010', toDate: '31/12/2011' });
    await settle(bf, { timeout: 6000 });

    const before = await itapPage3.experienceBlockCount();
    const added = await itapPage3.clickAddExperience();
    console.log('[TC_110] before=' + before + ' after=' + added.count
      + ' messages=' + JSON.stringify(added.messages));
    expect(added.count).toBe(before + 1);

    // The new block carries the same seven fields plus the checkbox.
    const f = itapPage3.experienceFields(added.count - 1);
    await expect(f.company).toBeVisible();
    await expect(f.annualPackage).toBeVisible();
    await expect(f.designation).toBeVisible();
    await expect(f.hq).toBeVisible();
    await expect(f.currentlyWorking).toBeVisible();
    await expect(f.fromDate).toBeVisible();
    await expect(f.toDate).toBeVisible();
    await expect(f.reason).toBeVisible();
    // ...and starts empty, i.e. it is a genuinely new block rather than the
    // first one re-rendered.
    await expect(f.company).toHaveValue('');

    // Same mandatory pattern as the first block: with block 0 fully valid and
    // only the new block blank, Submit must still be blocked.
    const result = await itapPage3.submitAndCancelIfConfirmed(bf);
    console.log('[TC_110] submit with blank 2nd block: confirmed=' + result.confirmed
      + ' messages=' + JSON.stringify(result.messages)
      + ' errorDialog=' + JSON.stringify(result.errorDialogText));
    expect(result.confirmed).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  // Excel TC_111 - the delete control IS the same img.mx-image[role='button']
  // + delete_*.svg pattern the Additional Qualification blocks use (verified
  // live for this section, not assumed), and it opens the same "Are you sure
  // you want to delete this record?" Yes/No dialog. One difference worth
  // noting versus Qualification Details: here EVERY block carries the icon,
  // including the first, whereas Graduation has none.
  test('TC_111: Verify each experience block has a delete icon that removes that specific block', async () => {
    await ensureExperienceYes(itapPage3, bf);
    await itapPage3.fillNthExperience(0, {
      company: 'first employer pvt ltd.', fromDate: '01/01/2010', toDate: '31/12/2011',
    });
    await settle(bf, { timeout: 6000 });

    const added = await itapPage3.clickAddExperience();
    expect(added.count).toBe(2);
    await itapPage3.fillNthExperience(1, {
      company: 'second employer pvt ltd.', fromDate: '01/01/2013', toDate: '31/12/2014',
    });
    await settle(bf, { timeout: 6000 });

    // One delete icon per block.
    expect(await itapPage3.experienceRemoveButtons.count()).toBe(2);

    const after = await itapPage3.removeLastExperienceBlock(bf);
    expect(after).toBe(1);

    // Only the SECOND block went: the first is still there, still intact.
    await expect(itapPage3.experienceFields(0).company).toHaveValue('first employer pvt ltd.');
    await expect(itapPage3.experienceFields(0).hq).toHaveValue('Delhi');
    expect(await itapPage3.experienceBlockCount()).toBe(1);
  });

  // Excel TC_112 - the cap question. Read this before touching it: the row's
  // "maybe there is a maximum" wording came from ANALOGY with Add
  // Qualification, not from any stated requirement, and Add Qualification
  // turned out to have no cap at all (TC_80). The thing that produced the
  // phantom cap there was "+ Add" refusing to add while an existing block is
  // blank, firing that block's validation instead - which looks identical to a
  // cap if you only count blocks. Confirmed live 2026-09-24 that Experience
  // behaves exactly the same way ("Please enter Company Name" on a blank-block
  // add attempt), so each block is FILLED before the next add - see
  // addFilledExperienceBlocksUntil(). 11 blocks clears any plausible cap
  // (Qualification's claimed one was 10) with room to spare.
  test('TC_112: Verify whether there is a cap on the number of experience entries that can be added', async () => {
    test.setTimeout(900000);
    await ensureExperienceYes(itapPage3, bf);

    const result = await itapPage3.addFilledExperienceBlocksUntil(11);
    console.log('[TC_112] count=' + result.count + ' refused=' + result.refused
      + ' messages=' + JSON.stringify(result.messages)
      + ' companies=' + JSON.stringify(result.companies)
      + ' addDisabled=' + await itapPage3.isAddExperienceDisabled());

    expect(result.refused, 'an add was refused even though every block was validly filled').toBe(false);
    expect(result.count).toBe(11);
    expect(await itapPage3.isAddExperienceDisabled()).toBe(false);
  });

  // Excel TC_113 - the confirmation checkbox on its own. Goes through
  // submitAndCancelIfConfirmed({ checkConfirmation: false }), which actively
  // UNCHECKS the box first (this section auto-commits, so it can arrive
  // already ticked) and cancels any submission the app is willing to accept.
  // Both branches of the Excel's "regardless of the Yes/No selection" are
  // covered; neither can consume the account, because a submission that is
  // correctly blocked never happens and one that is wrongly accepted is
  // answered "No".
  test('TC_113: Verify the confirmation checkbox is mandatory before Submit succeeds', async () => {
    // --- Branch 1: "Yes", every experience field validly filled ---
    await ensureExperienceYes(itapPage3, bf);
    await itapPage3.fillNthExperience(0, { fromDate: '01/01/2010', toDate: '31/12/2011' });
    await settle(bf, { timeout: 6000 });

    const yesBranch = await itapPage3.submitAndCancelIfConfirmed(bf, { checkConfirmation: false });
    console.log('[TC_113] Yes-branch confirmed=' + yesBranch.confirmed
      + ' messages=' + JSON.stringify(yesBranch.messages)
      + ' blockingDialog=' + JSON.stringify(yesBranch.blockingDialogText)
      + ' errorDialog=' + JSON.stringify(yesBranch.errorDialogText));
    expect(yesBranch.confirmed, 'Submit was accepted with the confirmation checkbox unchecked').toBe(false);
    expect(yesBranch.errorDialogText).toBeNull();
    // CONFIRMED LIVE 2026-09-24: this one is NOT signalled by an inline
    // .mx-validation-message like the field-level checks - the app raises a
    // modal Information dialog reading "Please accept confirmation to proceed
    // with the application" (OK button only). Either signal counts as
    // "blocked"; the dialog is what actually appears.
    expect(
      yesBranch.messages.length > 0 || /accept confirmation/i.test(yesBranch.blockingDialogText || ''),
      'Submit was blocked but with no message or dialog explaining why',
    ).toBe(true);

    // --- Branch 2: "No" (nothing to fill at all) ---
    await itapPage3.selectNotExperiencedConfirming(bf);
    await settle(bf, { timeout: 6000 });
    expect(await itapPage3.experienceBlockCount()).toBe(0);

    const noBranch = await itapPage3.submitAndCancelIfConfirmed(bf, { checkConfirmation: false });
    console.log('[TC_113] No-branch confirmed=' + noBranch.confirmed
      + ' messages=' + JSON.stringify(noBranch.messages)
      + ' blockingDialog=' + JSON.stringify(noBranch.blockingDialogText)
      + ' errorDialog=' + JSON.stringify(noBranch.errorDialogText));
    expect(noBranch.confirmed, 'Submit was accepted with the confirmation checkbox unchecked').toBe(false);
    expect(noBranch.errorDialogText).toBeNull();
    expect(
      noBranch.messages.length > 0 || /accept confirmation/i.test(noBranch.blockingDialogText || ''),
      'Submit was blocked but with no message or dialog explaining why',
    ).toBe(true);

    // Leave the section back on "Yes" for whatever runs next.
    await itapPage3.experienceDetail_yes.click();
    await settle(bf, { timeout: 6000 });
  });

  // Excel TC_114 - the complement of TC_113: checkbox CHECKED, but a
  // mandatory experience field left blank. "Company" is used as the blank
  // field rather than "From", deliberately: "From" is the one field in this
  // section with a confirmed-live missing-validation defect (TC_102 - it
  // throws a Mendix runtime error instead), which would make this row fail
  // for an unrelated, already-recorded reason.
  test('TC_114: Verify Submit is blocked when mandatory Experience fields are incomplete', async () => {
    await ensureExperienceYes(itapPage3, bf);
    await expect(itapPage3.currentlyWorkingHere).not.toBeChecked();
    await itapPage3.fillNthExperience(0, { omit: 'company', fromDate: '01/01/2010', toDate: '31/12/2011' });
    await settle(bf, { timeout: 6000 });

    const result = await itapPage3.submitAndCancelIfConfirmed(bf, { checkConfirmation: true });
    console.log('[TC_114] confirmed=' + result.confirmed
      + ' messages=' + JSON.stringify(result.messages)
      + ' errorDialog=' + JSON.stringify(result.errorDialogText));

    expect(result.errorDialogText).toBeNull();
    expect(result.confirmed, 'Submit was accepted with a mandatory field blank').toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  // Excel TC_115/TC_116 - the two security rows. Both register a real
  // page-level dialog listener BEFORE typing the payload, so a JavaScript
  // alert() actually firing would be caught rather than silently auto-
  // dismissed by Playwright. Both submit through submitAndCancelIfConfirmed()
  // so the payload goes through the app's real submit path without ever
  // completing a submission against the pooled account.
  test('TC_115: Verify the Company field against script injection input', async () => {
    const jsDialogs = [];
    bf.page.on('dialog', async (d) => { jsDialogs.push(d.message()); await d.dismiss().catch(() => {}); });

    await ensureExperienceYes(itapPage3, bf);
    const payload = '<script>alert(1)</script>';
    await itapPage3.fillNthExperience(0, { company: payload, fromDate: '01/01/2010', toDate: '31/12/2011' });
    await settle(bf, { timeout: 6000 });

    // Stored verbatim as text, not parsed as markup.
    await expect(itapPage3.experienceFields(0).company).toHaveValue(payload);

    const result = await itapPage3.submitAndCancelIfConfirmed(bf);
    await settle(bf, { timeout: 6000 });
    console.log('[TC_115] confirmed=' + result.confirmed
      + ' messages=' + JSON.stringify(result.messages)
      + ' jsDialogs=' + JSON.stringify(jsDialogs));

    expect(jsDialogs, 'a JavaScript dialog fired - the payload executed').toEqual([]);
    // The payload must not have been PARSED into the DOM as a real <script>.
    // (An earlier revision asserted `body script` count === 0, which was
    // simply a wrong expectation on my part and failed live with 8: the
    // Mendix client legitimately ships its own <script> tags in the body.
    // What matters is that none of them carries the payload.)
    const injectedScripts = await bf.page.evaluate(() =>
      Array.from(document.querySelectorAll('script'))
        .filter((s) => (s.textContent || '').includes('alert(1)')).length);
    expect(injectedScripts, 'the payload was parsed into a real <script> element').toBe(0);
    // ...and the page must still be the Experience Details form, not an error.
    expect(await bf.page.locator('body').innerText()).toContain('3.1 Work Experience');
  });

  test('TC_116: Verify the Reason of Leaving field against SQL injection input', async () => {
    const jsDialogs = [];
    bf.page.on('dialog', async (d) => { jsDialogs.push(d.message()); await d.dismiss().catch(() => {}); });

    await ensureExperienceYes(itapPage3, bf);
    await expect(itapPage3.currentlyWorkingHere).not.toBeChecked();
    const payload = "' OR '1'='1";
    await itapPage3.fillNthExperience(0, { reason: payload, fromDate: '01/01/2010', toDate: '31/12/2011' });
    await settle(bf, { timeout: 6000 });

    await expect(itapPage3.experienceFields(0).reason).toHaveValue(payload);

    const result = await itapPage3.submitAndCancelIfConfirmed(bf);
    await settle(bf, { timeout: 6000 });
    console.log('[TC_116] confirmed=' + result.confirmed
      + ' messages=' + JSON.stringify(result.messages)
      + ' errorDialog=' + JSON.stringify(result.errorDialogText)
      + ' jsDialogs=' + JSON.stringify(jsDialogs));

    expect(jsDialogs).toEqual([]);
    // The app must behave normally - no crash/runtime-error dialog, form still
    // rendered, payload still sitting in the field as inert text.
    expect(result.errorDialogText, 'the app threw a runtime error on the payload').toBeNull();
    expect(await bf.page.locator('body').innerText()).toContain('3.1 Work Experience');
    await expect(itapPage3.experienceFields(0).reason).toHaveValue(payload);
  });

  // Excel TC_118 - Save on Experience Details. The outcome was genuinely
  // unknown before this run: Save WORKS on Qualification Details ("Changes
  // have been saved successfully", TC_86) but is BROKEN on Personal Details
  // ("Executing runtime operation failed for security reasons", TC_39), so
  // neither could be assumed for this section. Whatever dialog appears is
  // logged verbatim.
  test('TC_118: Verify the Save button persists Work Experience data across a page refresh', async () => {
    await ensureExperienceYes(itapPage3, bf);
    await itapPage3.fillNthExperience(0, {
      company: 'save probe pvt ltd.', annualPackage: '450000', designation: 'ASM',
      hq: 'Pune', fromDate: '01/01/2012', toDate: '31/12/2014', reason: 'Career Growth',
    });
    await settle(bf, { timeout: 6000 });

    await itapPage3.click_SaveBtn();
    await settle(bf, { timeout: 6000 });
    const dialogText = await itapPage3.getDialogTextAndDismiss().catch(() => null);
    console.log('[TC_118] Save dialog:', JSON.stringify(dialogText));
    await bf.hardWait(1);

    await bf.page.reload({ waitUntil: 'networkidle' });
    await bf.hardWait(2);

    // Which section the wizard reopens on after a refresh is not guaranteed;
    // hop forward through the step circles if it lands earlier (same approach
    // TC_86 uses).
    const onExperience = async () =>
      (await bf.page.locator('body').innerText().catch(() => '')).includes('3.1 Work Experience');
    if (!(await onExperience())) {
      await itapPage1.stepQualificationDetailsCircleByLabel.click({ force: true }).catch(() => {});
      await waitForCondition(async () =>
        (await bf.page.locator('body').innerText().catch(() => '')).includes('Add Qualification'), 15000);
      await itapPage1.stepExperienceDetailsCircleByLabel.click({ force: true }).catch(() => {});
      await waitForCondition(onExperience, 15000);
    }
    await settle(bf, { timeout: 8000 });
    console.log('[TC_118] reached experience after refresh:', await onExperience());

    // Save must have reported success...
    expect(dialogText, 'Save produced no dialog at all').not.toBeNull();
    expect(dialogText).toMatch(/saved successfully/i);
    // ...and the values must survive the refresh.
    const f = itapPage3.experienceFields(0);
    await expect(f.company).toHaveValue('save probe pvt ltd.');
    await expect(f.designation).toHaveValue('ASM');
    await expect(f.hq).toHaveValue('Pune');
    await expect(f.fromDate).toHaveValue('01/01/2012');
    await expect(f.toDate).toHaveValue('31/12/2014');
    await expect(f.reason).toHaveValue('Career Growth');
    await expect(f.annualPackage).toHaveValue(/^450000(\.0+)?$/);
  });
});

// TC_117 completes a REAL, irreversible submission - the Phase 1 -> Phase 2
// transition itself - so it gets its own throwaway account and must never
// touch the pooled candidate. It is the only test in this batch that clicks
// "Yes" on the "Are you sure you want to submit?" dialog.
test.describe('Phase 1 - 3.1 Work Experience (fresh account, TC_117 real submission)', () => {
  let bf, itapPage3;

  test.beforeEach(async () => {
    test.setTimeout(300000);
    ({ bf, itapPage3 } = await newFreshExperienceSession());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_117 - scope is deliberately the TRANSITION only. Phase 2's own
  // content is out of scope while Phase 2 work is deferred, so this asserts
  // that Phase 1's Experience Details form is genuinely left behind and the
  // candidate lands on the post-Phase-1 screen, without exercising anything
  // Phase 2 does.
  test('TC_117: Verify clicking Submit (fully valid) navigates to the Phase 2 Application Form', async () => {
    await itapPage3.experienceDetail_yes.click();
    await settle(bf, { timeout: 6000 });

    await itapPage3.fillNthExperience(0, { fromDate: '01/01/2015', toDate: '31/12/2018' });
    await settle(bf, { timeout: 6000 });

    await itapPage3.confirmationRadioBtn.scrollIntoViewIfNeeded();
    await itapPage3.confirmationRadioBtn.check();
    await bf.hardWait(1);
    await itapPage3.submitBtn.click();
    await bf.hardWait(2.5);

    await expect(itapPage3.confirmDialog).toHaveCount(1);
    const dialogText = (await itapPage3.confirmDialog.first().innerText()).trim();
    console.log('[TC_117] confirmation dialog:', JSON.stringify(dialogText));
    expect(dialogText).toContain('Are you sure you want to submit?');

    await itapPage3.confirmDialogYes.first().click();
    await bf.hardWait(5);
    await settle(bf, { timeout: 10000 });

    const body = await bf.page.locator('body').innerText();
    const title = await bf.page.title();
    console.log('[TC_117] title after submit:', JSON.stringify(title));
    console.log('[TC_117] body after submit:', JSON.stringify(body));

    // Phase 1's Experience Details form is genuinely gone...
    expect(await itapPage3.getVisibleValidationMessages()).toEqual([]);
    expect(body).not.toContain('Are you experienced');
    expect(body).not.toContain('3.1 Work Experience');
    // ...and the candidate has moved on to the Phase 2 entry point.
    expect(body).toMatch(/iTAP Number|Phase 2|Continue/i);
  });
});
