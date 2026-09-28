const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const {
  signInAndReachPhase2, signupAndReachPhase1, fillValidPersonalDetails, fillValidQualification, getRandomAadhar,
} = require('../../utils/CandidateFlowHelpers');
const { ITAP_Phase2OtherDetailsPage, ITAP_Phase2UploadDocumentsPage } = require('../../pages/Candidate/Phase2OtherDetails');
const phase2Candidates = require('../../utils/Phase2TestCandidates');
const { settle } = require('../../utils/MendixSettle');
const { futureDateDDMMYYYY } = require('../../utils/DateHelpers');
// Only used by TC_72 below, to build one dedicated fresh account inline
// (signup -> Phase 1 -> Continue to Phase 2) - the same pattern
// utils/CandidateFlowHelpers.js's own reachOtherDetailsPage() uses, kept
// local to this test rather than changing that shared helper's signature
// (it has no way to inject a caller-known Aadhaar), so nothing shared is
// touched.
const { ITAPInterviewPerformaPage, ITAP_QualificationDetailsPage, ITAP_ExperienceDetailPage } = require('../../pages/Candidate/Phase1');
const { ITAP_ContinueToPhase2Page } = require('../../pages/Candidate/Phase2');
// Only used by TC_76-84 below (real file-upload interactions) - same
// upload-files/ fixture folder utils/CandidateFlowHelpers.js's own
// uploadAllDocuments() already reads from.
const path = require('path');
const UPLOAD_FILES_DIR = path.join(__dirname, '../../utils/upload-files');

// Built from Test Cases/Candidate Application Form.xlsx, sheet "Phase2",
// covering "Application Form - Phase 2". This file was rewritten from
// scratch 2026-09-25 (the previous legacy suite here was set aside by the
// user - "start fresh" - the same call already made for Phase1.spec.js).
//
// Batch 1 (2026-09-25): TC_01-TC_10, section "1. Other Details" /
// "1.1 Other Details" - page shell, static text, read-only carried-over
// fields, Blood Group/Religion mandatory + option lists, and the Date Of
// Marriage enable/disable branch driven by Phase 1's Marital Status.
// Batch 2 (2026-09-25): TC_11-TC_20 - future Date Of Marriage, the 1.1/1.2
// section toggles, and "1.2 Dependent Details" (see that describe's own
// state notes: "Add Member" rows persist and are deleted in afterEach).
// Batch 3 (2026-09-25): TC_21-TC_30 - Relation options, dependent date
// rules, Nominee rules, and Add Member / delete / row cap.
//
// FAST PATH: every test signs in as a pooled account that has already
// submitted Phase 1 (utils/Phase2TestCandidates.js) - that lands directly
// on Phase 2 "1. Other Details" in ~11s, versus ~111s for signup + all of
// Phase 1 + "Continue to Phase 2". The Date Of Marriage branch tests use one
// dedicated account per Phase 1 Marital Status (created once, 2026-09-25).
//
// SAFETY: no test here ever clicks Next with a fully valid Other Details
// form. The Next clicks in TC_04/TC_06/TC_10 always leave Dependent Details,
// UAN and Emergency Contact blank, so the app blocks them on validation and
// the pooled accounts stay on Other Details.
//
// Known, confirmed-live mismatches (kept asserting the Excel expectation on
// purpose so the test stays red until ruled on):
//   - TC_02: "Marital Status" carries NO red mandatory asterisk on Phase 2
//     (Blood Group and Religion do). The field is read-only here and
//     prefilled from Phase 1, so it is open whether the Excel expectation or
//     the app is the one to change - flagged for the user's ruling.
//   - TC_10: for a Married candidate, a blank Date Of Marriage is REJECTED
//     on Next with "Date Of Marriage is mandatory" (3/3 runs), although the
//     label shows no asterisk and the Excel row says it is optional. Either
//     the missing asterisk or the enforced rule is wrong - flagged.
//   - TC_35: in 1.3 UAN Details only "UAN Number" carries the red asterisk.
//     The four PF/Pension questions have none, even once enabled, although
//     each is enforced as mandatory (confirmed 4/4) - a missing-asterisk
//     defect, as ruled by the user.

// Signs in as a pooled Phase 2 account and lands on 1. Other Details.
async function newPooledPhase2Session(candidate = phase2Candidates.single) {
  const bf = new BrowserFactory();
  await bf.launchBrowser(config.CANDIDATE_URL);
  await signInAndReachPhase2(bf, candidate);
  const otherDetails = new ITAP_Phase2OtherDetailsPage(bf.page);
  return { bf, otherDetails };
}

// Phase 1 values the pooled accounts were created with (fillValidPersonalDetails()
// defaults) - what Phase 2's read-only fields must carry over.
const PHASE1_VALUES = {
  name: `${config.FirstName} ${config.MiddleName} ${config.LastName}`,
  mobile: '9876543210',
  email: config.PersonalEmailId,
  pan: 'ATBPV6191F',
};

const EXPECTED_BLOOD_GROUPS = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-', 'Unknown'];
const EXPECTED_RELIGIONS = ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Other'];

const CURRENT_STEP_BG = 'rgb(50, 43, 124)';
const UNREACHED_STEP_BG = 'rgb(213, 226, 231)';

// Tries to change a disabled text input (force-click + type) and returns its
// value afterwards, so the caller can assert nothing was accepted.
async function attemptTyping(bf, locator, text = 'X') {
  await locator.click({ force: true }).catch(() => {});
  await bf.page.keyboard.type(text);
  await settle(bf);
  return locator.inputValue();
}

test.describe('Phase 2 - 1. Other Details - Page Shell', () => {
  let bf, otherDetails;

  test.beforeEach(async () => {
    ({ bf, otherDetails } = await newPooledPhase2Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_01
  test('TC_01: Verify header, footer, and step indicator on the Application Form - Phase 2 page', async () => {
    await expect(bf.page).toHaveTitle(/Application Form - Phase 2/);
    await expect(otherDetails.pageTitle).toHaveText('Application Form - Phase 2');
    await expect(otherDetails.headerLogo).toBeVisible();
    await expect(otherDetails.accountIcon).toBeVisible();
    await expect(otherDetails.signOutBtn).toBeVisible();

    await expect(otherDetails.stepLabel('Other Details')).toBeVisible();
    await expect(otherDetails.stepLabel('Upload Documents')).toBeVisible();
    await expect(otherDetails.stepCircle('Other Details')).toHaveText('1.');
    await expect(otherDetails.stepCircle('Upload Documents')).toHaveText('2.');
    expect(await otherDetails.stepCircleBackground('Other Details')).toBe(CURRENT_STEP_BG);
    expect(await otherDetails.stepCircleBackground('Upload Documents')).toBe(UNREACHED_STEP_BG);

    const text = await bf.page.locator('body').innerText();
    expect(text).toContain('© Mankind@2026. All rights reserved.');
    expect(text).toContain('Helpline No. :');
  });

  // Excel TC_63 - after Sign out, the sign-in page must show, and none of
  // browser Back / reload / re-opening the Phase 2 URL may bring back the
  // authenticated Other Details page.
  test('TC_63: Verify the Sign Out button actually signs the candidate out of Phase 2', async () => {
    const page = bf.page;
    const phase2Url = page.url();
    const aadhaarInput = page.locator("//*[@placeholder='Aadhar Number']");
    const onPhase2 = async () => (await page.title()).includes('Application Form - Phase 2')
      || (await otherDetails.bloodGroup.count()) > 0;
    const expectSignedOut = async (step) => {
      await settle(bf, { timeout: 8000 });
      await expect(aadhaarInput, `${step}: sign-in page shown`).toBeVisible({ timeout: 20000 });
      expect(await onPhase2(), `${step}: no authenticated Phase 2 content`).toBe(false);
      console.log(`TC_63 ${step}:`, JSON.stringify({ url: page.url(), title: await page.title() }));
    };

    // Confirmed live: Sign out first asks "Are you sure you want to log
    // out?" (Yes / No).
    await otherDetails.signOutBtn.click();
    const confirm = otherDetails.dialog.filter({ hasText: 'Are you sure you want to log out?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Yes', exact: true }).click();
    await expectSignedOut('after Sign out');

    await page.goBack().catch(() => {});
    await expectSignedOut('after browser Back');

    await page.reload();
    await expectSignedOut('after reload');

    await page.goto(phase2Url);
    await expectSignedOut(`after opening the Phase 2 URL (${phase2Url})`);
  });
});

test.describe('Phase 2 - 1.1 Other Details', () => {
  let bf, otherDetails;

  test.beforeEach(async () => {
    ({ bf, otherDetails } = await newPooledPhase2Session());
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_02 - known mismatch (see file header): Marital Status has no
  // red asterisk on the live page.
  test('TC_02: Verify all static UI text in the "1.1 Other Details" section', async () => {
    const text = await bf.page.locator('body').innerText();
    expect(text).toContain('1.1 Other Details');

    const mandatory = ['Blood Group', 'Religion', 'Marital Status'];
    const optional = ['Name', 'Mobile Number', 'Email ID', 'PAN Card Number', 'Date Of Marriage'];
    for (const label of [...optional, ...mandatory]) {
      await expect.soft(otherDetails.labelContainer(label), `label "${label}"`).toBeVisible();
    }
    for (const label of optional) {
      await expect.soft(otherDetails.asteriskFor(label), `"${label}" must NOT show a mandatory asterisk`).toHaveCount(0);
    }
    for (const label of mandatory) {
      await expect.soft(otherDetails.asteriskFor(label), `"${label}" must show the red mandatory asterisk`).toHaveCount(1);
    }
  });

  // Excel TC_03
  test('TC_03: Verify Name, Mobile Number, Email ID, PAN Card Number, and Marital Status are read-only and correctly carry over their values from Phase 1', async () => {
    await expect(otherDetails.name).toHaveValue(PHASE1_VALUES.name);
    await expect(otherDetails.mobile).toHaveValue(PHASE1_VALUES.mobile);
    await expect(otherDetails.email).toHaveValue(PHASE1_VALUES.email);
    await expect(otherDetails.pan).toHaveValue(PHASE1_VALUES.pan);
    expect(await otherDetails.getSelectedText(otherDetails.maritalStatus)).toBe(phase2Candidates.single.maritalStatus);

    const textFields = [
      ['Name', otherDetails.name, PHASE1_VALUES.name],
      ['Mobile Number', otherDetails.mobile, PHASE1_VALUES.mobile],
      ['Email ID', otherDetails.email, PHASE1_VALUES.email],
      ['PAN Card Number', otherDetails.pan, PHASE1_VALUES.pan],
    ];
    for (const [label, locator, value] of textFields) {
      await expect(locator, `${label} should be disabled`).toBeDisabled();
      expect(await attemptTyping(bf, locator), `${label} should not accept input`).toBe(value);
    }

    await expect(otherDetails.maritalStatus).toBeDisabled();
    await otherDetails.maritalStatus.click({ force: true }).catch(() => {});
    await bf.page.keyboard.press('ArrowDown');
    await bf.page.keyboard.press('Enter');
    await settle(bf);
    expect(await otherDetails.getSelectedText(otherDetails.maritalStatus)).toBe(phase2Candidates.single.maritalStatus);
  });

  // Excel TC_04
  test('TC_04: Verify Blood Group is a mandatory field', async () => {
    await otherDetails.selectByLabel(otherDetails.religion, 'Hinduism');
    await otherDetails.clearSelect(otherDetails.bloodGroup);
    await settle(bf);

    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    expect(messages).toContain('Blood group is mandatory');
    expect(messages).not.toContain('Religion is mandatory');
    await expect(otherDetails.bloodGroup).toBeVisible();
  });

  // Excel TC_05
  test('TC_05: Verify the Blood Group dropdown shows the correct list of options', async () => {
    expect(await otherDetails.getOptionTexts(otherDetails.bloodGroup)).toEqual(EXPECTED_BLOOD_GROUPS);
  });

  // Excel TC_06
  test('TC_06: Verify Religion is a mandatory field', async () => {
    await otherDetails.selectByLabel(otherDetails.bloodGroup, 'A+');
    await otherDetails.clearSelect(otherDetails.religion);
    await settle(bf);

    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    expect(messages).toContain('Religion is mandatory');
    expect(messages).not.toContain('Blood group is mandatory');
    await expect(otherDetails.religion).toBeVisible();
  });

  // Excel TC_07
  test('TC_07: Verify the Religion dropdown shows the correct list of options', async () => {
    expect(await otherDetails.getOptionTexts(otherDetails.religion)).toEqual(EXPECTED_RELIGIONS);
  });

  // Excel TC_12
  test('TC_12: Verify the "1.1 Other Details" section toggle expands and collapses correctly', async () => {
    await expect(otherDetails.otherDetailsToggleIcon).toHaveClass(/mx-icon-substract/);
    await expect(otherDetails.bloodGroup).toBeVisible();

    await otherDetails.toggleSection(otherDetails.otherDetailsToggleIcon);
    await settle(bf);
    await expect(otherDetails.bloodGroup).not.toBeVisible();
    await expect(otherDetails.name).not.toBeVisible();
    await expect(otherDetails.otherDetailsToggleIcon).toHaveClass(/mx-icon-add/);

    await otherDetails.toggleSection(otherDetails.otherDetailsToggleIcon);
    await settle(bf);
    await expect(otherDetails.bloodGroup).toBeVisible();
    await expect(otherDetails.name).toBeVisible();
    await expect(otherDetails.otherDetailsToggleIcon).toHaveClass(/mx-icon-substract/);
  });
});

// Date Of Marriage branch: each test signs in as the dedicated account for
// the Phase 1 Marital Status it needs (utils/Phase2TestCandidates.js).
test.describe('Phase 2 - 1.1 Other Details - Date Of Marriage', () => {
  // Excel TC_08 - one sign-in per non-Married Marital Status, so it gets a
  // longer budget than the 2-minute default.
  test('TC_08: Verify Date Of Marriage stays disabled for every Marital Status other than "Married"', async () => {
    test.setTimeout(300000);
    for (const key of ['single', 'divorced', 'widowed', 'other']) {
      const candidate = phase2Candidates[key];
      await test.step(`Marital Status "${candidate.maritalStatus}"`, async () => {
        const { bf, otherDetails } = await newPooledPhase2Session(candidate);
        try {
          expect.soft(await otherDetails.getSelectedText(otherDetails.maritalStatus)).toBe(candidate.maritalStatus);
          await expect.soft(otherDetails.dateOfMarriage, `${candidate.maritalStatus}: Date Of Marriage disabled`).toBeDisabled();
          expect.soft(await attemptTyping(bf, otherDetails.dateOfMarriage, '15/02/2020'), `${candidate.maritalStatus}: Date Of Marriage accepted no input`).toBe('');
        } finally {
          await bf.closeBrowser();
        }
      });
    }
  });

  test.describe('Married candidate', () => {
    let bf, otherDetails;

    test.beforeEach(async () => {
      ({ bf, otherDetails } = await newPooledPhase2Session(phase2Candidates.married));
    });

    test.afterEach(async () => {
      await bf.closeBrowser();
    });

    // Excel TC_09
    test('TC_09: Verify Date Of Marriage becomes enabled ONLY when Marital Status (from Phase 1) is "Married"', async () => {
      expect(await otherDetails.getSelectedText(otherDetails.maritalStatus)).toBe('Married');
      await expect(otherDetails.dateOfMarriage).toBeEnabled();

      await otherDetails.dateOfMarriage.scrollIntoViewIfNeeded();
      await otherDetails.dateOfMarriage.fill('15/02/2020');
      await otherDetails.dateOfMarriage.press('Tab');
      await settle(bf);
      await expect(otherDetails.dateOfMarriage).toHaveValue('15/02/2020');
      const messages = await otherDetails.getVisibleValidationMessages();
      expect(messages.filter((m) => /marriage|date/i.test(m))).toEqual([]);
    });

    // Excel TC_10 - "does not block proceeding" is checked as: after Next,
    // no validation message is raised for Date Of Marriage (or for the
    // filled Blood Group/Religion). The Next is still blocked by the blank
    // Dependent/UAN/Emergency Contact sections on purpose - completing them
    // would advance this pooled account out of Other Details (see header).
    test('TC_10: Verify Date Of Marriage is optional even when enabled', async () => {
      await expect(otherDetails.dateOfMarriage).toBeEnabled();
      await otherDetails.dateOfMarriage.fill('');
      await otherDetails.dateOfMarriage.press('Tab');
      await otherDetails.selectByLabel(otherDetails.bloodGroup, 'A+');
      await otherDetails.selectByLabel(otherDetails.religion, 'Hinduism');
      await settle(bf);

      const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      console.log('TC_10 validation messages after Next:', JSON.stringify(messages));
      expect(messages.filter((m) => /marriage/i.test(m))).toEqual([]);
      expect(messages).not.toContain('Blood group is mandatory');
      expect(messages).not.toContain('Religion is mandatory');
      await expect(otherDetails.dateOfMarriage).toHaveValue('');
    });

    // Excel TC_11 - same "inspect the messages after a blocked Next" shape
    // as TC_10; the message has to sit on the Date Of Marriage field itself
    // and must be something other than the plain mandatory message.
    test('TC_11: Verify Date Of Marriage does not accept a future date', async () => {
      const future = futureDateDDMMYYYY(6);
      await expect(otherDetails.dateOfMarriage).toBeEnabled();
      await otherDetails.fillDate(otherDetails.dateOfMarriage, future);
      await otherDetails.selectByLabel(otherDetails.bloodGroup, 'A+');
      await otherDetails.selectByLabel(otherDetails.religion, 'Hinduism');
      await settle(bf);

      const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      const domMessages = await otherDetails.fieldValidationMessages(otherDetails.dateOfMarriage);
      console.log(`TC_11 future date ${future} -> field messages:`, JSON.stringify(domMessages), 'all:', JSON.stringify(messages));
      expect(domMessages.filter((m) => m !== 'Date Of Marriage is mandatory').length).toBeGreaterThan(0);
    });
  });
});

// ---- 1.2 Dependent Details (TC_13-TC_20) ----
// State notes, confirmed live 2026-09-25 on the pooled accounts:
//   - Father/Mother rows always exist; their Relation selects are disabled
//     and their Names come prefilled from Phase 1's parent details
//     ("Amandeep Singh" / "Kashish Kaur"). DOB/Demise/Nominee start blank.
//   - Values typed into a row, and a Next blocked by validation, do NOT
//     persist to the next sign-in.
//   - "Add Member" DOES persist a new (blank) row immediately. afterEach
//     therefore deletes every added row (deleteAddedDependents()) before
//     closing, and TC_15 also clears any leftovers first so it checks the
//     real default state.
test.describe('Phase 2 - 1.2 Dependent Details', () => {
  let bf, otherDetails;

  test.beforeEach(async () => {
    ({ bf, otherDetails } = await newPooledPhase2Session());
  });

  test.afterEach(async () => {
    try {
      await otherDetails.deleteAddedDependents(settle, bf);
    } finally {
      await bf.closeBrowser();
    }
  });

  // Excel TC_13 - the Excel's "+ Add Member" is read as the button's
  // name; the live button text is just "Add Member" (same reading Phase 1
  // uses for "+ Add Qualification").
  test('TC_13: Verify all static UI text in the "1.2 Dependent Details" section', async () => {
    await expect(otherDetails.dependentDetailsSection.locator('.mx-groupbox-header')).toHaveText('1.2 Dependent Details');

    const headers = [
      [1, 'Name', true],
      [2, 'Relation', true],
      [3, 'Date of Birth', true],
      [4, 'Date of Demise (if applicable)', false],
      [5, 'Nominee', true],
    ];
    for (const [n, text, mandatory] of headers) {
      const label = otherDetails.dependentHeaderLabel(n);
      await expect.soft(label, `header ${n}`).toBeVisible();
      // "Date of Demise" wraps onto 2 lines in the markup - compare
      // whitespace-normalised.
      expect.soft((await label.innerText()).replace(/\s+/g, ' ').trim(), `header ${n} text`).toBe(text);
      await expect.soft(otherDetails.dependentHeaderAsterisk(n), `"${text}" asterisk`).toHaveCount(mandatory ? 1 : 0);
    }
    await expect(otherDetails.addMemberBtn).toBeVisible();
    await expect(otherDetails.addMemberBtn).toHaveText('Add Member');
  });

  // Excel TC_14
  test('TC_14: Verify the "1.2 Dependent Details" section toggle expands and collapses correctly', async () => {
    await expect(otherDetails.dependentDetailsToggleIcon).toHaveClass(/mx-icon-substract/);
    await expect(otherDetails.dependentNames.first()).toBeVisible();

    await otherDetails.toggleSection(otherDetails.dependentDetailsToggleIcon);
    await settle(bf);
    await expect(otherDetails.dependentNames.first()).not.toBeVisible();
    await expect(otherDetails.addMemberBtn).not.toBeVisible();
    await expect(otherDetails.dependentDetailsToggleIcon).toHaveClass(/mx-icon-add/);

    await otherDetails.toggleSection(otherDetails.dependentDetailsToggleIcon);
    await settle(bf);
    await expect(otherDetails.dependentNames.first()).toBeVisible();
    await expect(otherDetails.addMemberBtn).toBeVisible();
    await expect(otherDetails.dependentDetailsToggleIcon).toHaveClass(/mx-icon-substract/);
  });

  // Excel TC_15 - asserts the Expected Result (two rows, Father then
  // Mother). NB the row's description also says Name/DOB start blank; live,
  // Name is prefilled from Phase 1's parent details (DOB is blank) - see
  // the describe's state notes.
  test('TC_15: Verify Father and Mother rows exist by default in Dependent Details', async () => {
    await otherDetails.deleteAddedDependents(settle, bf);
    await expect(otherDetails.dependentNames).toHaveCount(2);
    await expect(otherDetails.dependentRelations).toHaveCount(2);
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(0))).toBe('Father');
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(1))).toBe('Mother');
    console.log('TC_15 row state:', JSON.stringify({
      names: [await otherDetails.dependentNames.nth(0).inputValue(), await otherDetails.dependentNames.nth(1).inputValue()],
      dobs: [await otherDetails.dependentDOBs.nth(0).inputValue(), await otherDetails.dependentDOBs.nth(1).inputValue()],
      relationDisabled: [await otherDetails.dependentRelations.nth(0).isDisabled(), await otherDetails.dependentRelations.nth(1).isDisabled()],
    }));
  });

  // Excel TC_16
  test('TC_16: Verify the delete icon is disabled or hidden for the Father and Mother rows', async () => {
    await expect(otherDetails.dependentNames).toHaveCount(2);
    await expect(otherDetails.deletableTrashIcons).toHaveCount(0);
    await expect(otherDetails.lockedTrashIcons).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(otherDetails.lockedTrashIcons.nth(i)).toHaveClass(/disabled/);
      await otherDetails.lockedTrashIcons.nth(i).click({ force: true });
      await settle(bf);
      await expect(otherDetails.dialog, 'no delete confirmation should open').toHaveCount(0);
      await expect(otherDetails.dependentNames).toHaveCount(2);
    }
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(0))).toBe('Father');
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(1))).toBe('Mother');
  });

  // Excel TC_17 - Father's Relation is preset (and disabled), so only DOB
  // needs filling alongside the blanked Name. The message is checked on the
  // Father Name field itself: Emergency Contact raises an identically
  // worded "Name is mandatory" of its own.
  test('TC_17: Verify Name is a mandatory field for a dependent', async () => {
    const fatherName = otherDetails.dependentNames.nth(0);
    await fatherName.fill('');
    await fatherName.press('Tab');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await settle(bf);

    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    expect(await otherDetails.fieldValidationMessages(fatherName)).toContain('Name is mandatory');
    expect(await otherDetails.fieldValidationMessages(otherDetails.dependentDOBs.nth(0))).toEqual([]);
  });

  // Excel TC_18 - needs a new row via Add Member (Father/Mother Relations
  // are preset and disabled). afterEach deletes that row again.
  test('TC_18: Verify Relation is a mandatory field for a dependent', async () => {
    await otherDetails.addMemberBtn.click();
    await settle(bf, { timeout: 6000 });
    await expect(otherDetails.dependentNames).toHaveCount(3);

    const row = 2;
    await otherDetails.dependentNames.nth(row).fill('Test Dependent');
    await otherDetails.dependentNames.nth(row).press('Tab');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(row), '15/08/2000');
    await otherDetails.clearSelect(otherDetails.dependentRelations.nth(row));
    await settle(bf);

    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const relationMessages = await otherDetails.fieldValidationMessages(otherDetails.dependentRelations.nth(row));
    console.log('TC_18 new-row Relation messages:', JSON.stringify(relationMessages));
    expect(relationMessages).toContain('Relation is mandatory');
    expect(await otherDetails.fieldValidationMessages(otherDetails.dependentNames.nth(row))).toEqual([]);
    expect(await otherDetails.fieldValidationMessages(otherDetails.dependentDOBs.nth(row))).toEqual([]);
  });

  // Excel TC_19 - Father's DOB is filled too, so the only dependent DOB
  // left blank is Mother's.
  test('TC_19: Verify Date of Birth is a mandatory field for a dependent', async () => {
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    const motherDOB = otherDetails.dependentDOBs.nth(1);
    await motherDOB.fill('');
    await motherDOB.press('Tab');
    await settle(bf);
    await expect(otherDetails.dependentNames.nth(1)).not.toHaveValue('');

    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    expect(await otherDetails.fieldValidationMessages(motherDOB)).toContain('Date of Birth is mandatory');
    expect(await otherDetails.fieldValidationMessages(otherDetails.dependentDOBs.nth(0))).toEqual([]);
  });

  // Excel TC_20 - "does not block proceeding" checked the TC_10 way: after
  // Next, neither Date of Demise field carries a validation message (the
  // Next itself is still blocked by the blank UAN / Emergency Contact
  // sections, on purpose).
  test('TC_20: Verify Date of Demise (if applicable) is optional', async () => {
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await otherDetails.dependentNominees.nth(0).check();
    await settle(bf);

    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const sectionMessages = await otherDetails.dependentDetailsSection.locator('.mx-validation-message').allInnerTexts();
    console.log('TC_20 all messages:', JSON.stringify(messages), 'dependent-section messages:', JSON.stringify(sectionMessages));
    for (let i = 0; i < 2; i++) {
      await expect(otherDetails.dependentDemises.nth(i)).toHaveValue('');
      expect(await otherDetails.fieldValidationMessages(otherDetails.dependentDemises.nth(i))).toEqual([]);
    }
    expect(messages.filter((m) => /demise/i.test(m))).toEqual([]);
  });

  // ---- Batch 3 (TC_21-TC_30), confirmed live 2026-09-25 ----
  // Dependent-row date/nominee messages observed live, all rendered on the
  // row's own field (so fieldValidationMessages() is used throughout):
  //   future DOB            -> "Date of Birth should be less than today" (on Next)
  //   future Date of Demise -> "Date of Death should be less than today" (on blur)
  //   Demise <= DOB         -> "Date of Death should be greater than Date of Birth" (on blur)
  //   Nominee + Demise      -> "Relative cannot be nominee as DOD is provided" (on Next,
  //                            shown on the Date of Demise field)
  //   no Nominee at all     -> no inline message; Next opens the "Information"
  //                            popup instead (it does NOT open when a Nominee
  //                            is ticked, with every other section equally blank).

  // Excel TC_21
  test('TC_21: Verify the Relation dropdown shows the correct list of options', async () => {
    const row = await otherDetails.addDependent(settle, bf);
    await expect(otherDetails.dependentRelations.nth(row)).toBeEnabled();
    expect(await otherDetails.getOptionTexts(otherDetails.dependentRelations.nth(row))).toEqual([
      'Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Grand Father', 'Grand Mother',
      'Father-In-Law', 'Mother-In-Law', 'Son', 'Daughter', 'Divorced Spouse', 'Guardian',
    ]);
  });

  // Excel TC_22 - Father's DOB set in the future; Mother's valid as a control.
  test('TC_22: Verify Date of Birth cannot be set in the future', async () => {
    const future = futureDateDDMMYYYY(6);
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), future);
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await otherDetails.dependentNominees.nth(1).check();
    await settle(bf);

    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const fatherMsgs = await otherDetails.fieldValidationMessages(otherDetails.dependentDOBs.nth(0));
    console.log(`TC_22 future DOB ${future} -> Father DOB messages:`, JSON.stringify(fatherMsgs));
    expect(fatherMsgs).toContain('Date of Birth should be less than today');
    expect(await otherDetails.fieldValidationMessages(otherDetails.dependentDOBs.nth(1))).toEqual([]);
  });

  // Excel TC_23 - both halves of "earlier than or equal to" are checked, on
  // the Father row (not the Nominee, so the deceased-nominee rule can't mix in).
  test('TC_23: Verify Date of Demise, if filled, must be after Date of Birth', async () => {
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await otherDetails.dependentNominees.nth(1).check();
    const fatherDemise = otherDetails.dependentDemises.nth(0);

    for (const demise of ['15/08/1960', '15/08/1965']) {
      await test.step(`Date of Demise ${demise} vs Date of Birth 15/08/1965`, async () => {
        await otherDetails.fillDate(fatherDemise, demise);
        await settle(bf);
        await otherDetails.clickNextAndGetValidationMessages(settle, bf);
        const msgs = await otherDetails.fieldValidationMessages(fatherDemise);
        console.log(`TC_23 demise ${demise} -> messages:`, JSON.stringify(msgs));
        expect(msgs).toContain('Date of Death should be greater than Date of Birth');
        await otherDetails.dismissDialogs(settle, bf);
      });
    }
  });

  // Excel TC_24
  test('TC_24: Verify Date of Demise cannot be set in the future', async () => {
    const future = futureDateDDMMYYYY(6);
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await otherDetails.dependentNominees.nth(1).check();
    await otherDetails.fillDate(otherDetails.dependentDemises.nth(0), future);
    await settle(bf);

    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const msgs = await otherDetails.fieldValidationMessages(otherDetails.dependentDemises.nth(0));
    console.log(`TC_24 future demise ${future} -> messages:`, JSON.stringify(msgs));
    expect(msgs).toContain('Date of Death should be less than today');
  });

  // Excel TC_25
  test('TC_25: Verify only one dependent can be marked as Nominee at a time', async () => {
    expect(await otherDetails.nomineeStates()).toEqual([false, false]);
    await otherDetails.dependentNominees.nth(0).check();
    await settle(bf);
    expect(await otherDetails.nomineeStates()).toEqual([true, false]);

    await otherDetails.dependentNominees.nth(1).check();
    await settle(bf);
    expect(await otherDetails.nomineeStates()).toEqual([false, true]);
    await expect(otherDetails.dialog).toHaveCount(0);
  });

  // Excel TC_26 - no inline message exists for this rule; the rejection is
  // the "Information" popup. To show the popup is really about the missing
  // Nominee (every Next here is also blocked by the blank UAN / Emergency
  // Contact sections), the same Next is repeated with a Nominee ticked and
  // the popup must then NOT appear.
  test('TC_26: Verify at least one dependent must be marked as Nominee before proceeding', async () => {
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await settle(bf);
    expect(await otherDetails.nomineeStates()).toEqual([false, false]);

    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    await expect(otherDetails.dialog).toBeVisible();
    const popup = await otherDetails.openDialogText();
    console.log('TC_26 no-nominee popup:', JSON.stringify(popup));
    expect(popup).toContain('Please complete all mandatory fields (including Nominee, if not already selected) to proceed');
    await expect(otherDetails.otherDetailsSection).toBeVisible();
    await otherDetails.dismissDialogs(settle, bf);

    await otherDetails.dependentNominees.nth(0).check();
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    await expect(otherDetails.dialog, 'control: popup must not appear once a Nominee is ticked').toHaveCount(0);
  });

  // Excel TC_27 - Mother is both the deceased row and the Nominee.
  test('TC_27: Verify Submit is blocked if the Nominee-marked dependent also has a Date of Demise filled in', async () => {
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await otherDetails.fillDate(otherDetails.dependentDemises.nth(1), '15/08/2020');
    await settle(bf);

    await otherDetails.dependentNominees.nth(1).check();
    await settle(bf);
    await expect(otherDetails.dependentNominees.nth(1), 'Nominee stays checkable on a deceased row').toBeChecked();

    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const msgs = await otherDetails.fieldValidationMessages(otherDetails.dependentDemises.nth(1));
    console.log('TC_27 deceased-nominee messages:', JSON.stringify(msgs), 'all:', JSON.stringify(messages));
    expect(msgs).toContain('Relative cannot be nominee as DOD is provided');
    await expect(otherDetails.otherDetailsSection).toBeVisible();
  });

  // Excel TC_28 - "same mandatory pattern" checked by behaviour: Next on the
  // blank new row must raise Name/Relation/DOB mandatory messages on that
  // row, and none on its Date of Demise.
  test('TC_28: Verify "+ Add Member" adds a new dependent row with the same field requirements', async () => {
    await expect(otherDetails.dependentNames).toHaveCount(2);
    const row = await otherDetails.addDependent(settle, bf);
    await expect(otherDetails.dependentNames).toHaveCount(3);

    await expect(otherDetails.dependentNames.nth(row)).toHaveValue('');
    await expect(otherDetails.dependentNames.nth(row)).toBeEnabled();
    await expect(otherDetails.dependentRelations.nth(row)).toBeEnabled();
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(row))).toBe('');
    await expect(otherDetails.dependentDOBs.nth(row)).toBeEnabled();
    await expect(otherDetails.dependentDemises.nth(row)).toBeEnabled();
    await expect(otherDetails.dependentNominees.nth(row)).toBeEnabled();
    await expect(otherDetails.deletableTrashIcons).toHaveCount(1);

    // Father/Mother filled validly so only the new row can raise messages.
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await otherDetails.dependentNominees.nth(0).check();
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);

    const got = {
      name: await otherDetails.fieldValidationMessages(otherDetails.dependentNames.nth(row)),
      relation: await otherDetails.fieldValidationMessages(otherDetails.dependentRelations.nth(row)),
      dob: await otherDetails.fieldValidationMessages(otherDetails.dependentDOBs.nth(row)),
      demise: await otherDetails.fieldValidationMessages(otherDetails.dependentDemises.nth(row)),
    };
    console.log('TC_28 new-row messages:', JSON.stringify(got));
    expect(got.name).toContain('Name is mandatory');
    expect(got.relation).toContain('Relation is mandatory');
    expect(got.dob).toContain('Date of Birth is mandatory');
    expect(got.demise).toEqual([]);
  });

  // Excel TC_29 - two members are added so "only that row" is meaningful:
  // deleting the first added one must leave Father, Mother AND the second.
  test('TC_29: Verify an added member\'s delete icon removes that specific row', async () => {
    const a = await otherDetails.addDependent(settle, bf);
    await otherDetails.fillDependentRow(a, { name: 'Member A', relation: 'Brother', dob: '15/08/1995' });
    const b = await otherDetails.addDependent(settle, bf);
    await otherDetails.fillDependentRow(b, { name: 'Member B', relation: 'Sister', dob: '15/08/1998' });
    await settle(bf);
    await expect(otherDetails.dependentNames).toHaveCount(4);
    await expect(otherDetails.deletableTrashIcons).toHaveCount(2);

    await otherDetails.deletableTrashIcons.nth(0).scrollIntoViewIfNeeded();
    await otherDetails.deletableTrashIcons.nth(0).click();
    const ok = otherDetails.dialog.last().locator('.mx-dialog-footer button', { hasText: 'OK' });
    await ok.waitFor({ state: 'visible', timeout: 10000 });
    await ok.click();
    await settle(bf, { timeout: 6000 });

    await expect(otherDetails.dependentNames).toHaveCount(3);
    await expect(otherDetails.dependentNames.nth(0)).toHaveValue('Amandeep Singh');
    await expect(otherDetails.dependentNames.nth(1)).toHaveValue('Kashish Kaur');
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(0))).toBe('Father');
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(1))).toBe('Mother');
    await expect(otherDetails.dependentNames.nth(2)).toHaveValue('Member B');
    expect(await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(2))).toBe('Sister');
    await expect(otherDetails.dependentDOBs.nth(2)).toHaveValue('15/08/1998');
    await expect(otherDetails.deletableTrashIcons).toHaveCount(1);
  });

  // Excel TC_30 - each new row is filled validly before the next add, and
  // after every add the button state, row count, dialogs and validation
  // messages are all read, so an "incomplete row" refusal can't pass for a
  // cap. MAX_ROWS bounds the probe (and the cleanup time).
  test('TC_30: Verify whether there is a cap on the number of dependent members that can be added', async () => {
    test.setTimeout(300000);
    const MAX_ROWS = 15;
    const log = [];
    try {
      while ((await otherDetails.dependentNames.count()) < MAX_ROWS) {
        const before = await otherDetails.dependentNames.count();
        const enabled = await otherDetails.addMemberBtn.isEnabled();
        await otherDetails.addMemberBtn.scrollIntoViewIfNeeded();
        await otherDetails.addMemberBtn.click();
        // Wait for the server round trip explicitly (it ran to ~1s on some
        // adds live) - settle() alone can return before the row renders, which
        // once passed for a "refused" add and then broke cleanup mid-render.
        await otherDetails.dependentNames.nth(before).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
        await settle(bf, { timeout: 6000 });
        const after = await otherDetails.dependentNames.count();
        const entry = { before, after, enabled, dialog: await otherDetails.openDialogText(), messages: await otherDetails.getVisibleValidationMessages() };
        log.push(entry);
        if (after <= before) break;
        await otherDetails.fillDependentRow(after - 1, { name: `Member ${after - 2}`, relation: 'Son', dob: '15/08/2010' });
        await settle(bf);
      }
      console.log('TC_30 add log:', JSON.stringify(log));
      const blocked = log.filter((e) => e.after <= e.before || !e.enabled || e.dialog || e.messages.length);
      expect(blocked, 'no add was refused/disabled/messaged while every row was complete').toEqual([]);
      await expect(otherDetails.dependentNames).toHaveCount(MAX_ROWS);
      await expect(otherDetails.addMemberBtn).toBeEnabled();
    } finally {
      // deleteAddedDependents() stops after 10 rows (its own guard) and this
      // test adds 13, so it is repeated here until none are left; afterEach
      // then finds nothing to do.
      for (let pass = 0; pass < 3 && (await otherDetails.deletableTrashIcons.count()) > 0; pass++) {
        await otherDetails.deleteAddedDependents(settle, bf);
      }
    }
  });

  // ---- Batch 4 (TC_31-TC_34), confirmed live 2026-09-25 ----
  // The payload/long-name tests use the Father row's Name: typed values do
  // not persist to the next sign-in, so no Add Member row is needed. Father
  // is ticked as Nominee and both DOBs are filled so the only reason Next is
  // blocked is the blank UAN / Emergency Contact sections (no popup).
  async function fillParentsValidly() {
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
    await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
    await otherDetails.dependentNominees.nth(0).check();
    await settle(bf);
  }

  // Shared body of TC_31/TC_32: type the payload, Next, then check nothing
  // unusual happened - no JS dialog, no Mendix error dialog, still on Phase 2,
  // value kept literally, and the same blocking messages as a normal Next.
  async function injectIntoFatherName(payload) {
    const jsDialogs = [];
    bf.page.on('dialog', async (d) => { jsDialogs.push(`${d.type()}: ${d.message()}`); await d.dismiss(); });
    await otherDetails.fillDependentRow(0, { name: payload });
    await fillParentsValidly();
    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    return {
      jsDialogs,
      messages,
      value: await otherDetails.dependentNames.nth(0).inputValue(),
      nameMessages: await otherDetails.fieldValidationMessages(otherDetails.dependentNames.nth(0)),
      mendixDialog: await otherDetails.openDialogText(),
      title: await bf.page.title(),
    };
  }

  // Excel TC_31
  test('TC_31: Verify the Name field against script injection input', async () => {
    const payload = '<script>alert(1)</script>';
    const r = await injectIntoFatherName(payload);
    console.log('TC_31 result:', JSON.stringify(r));
    expect(r.jsDialogs).toEqual([]);
    expect(r.value).toBe(payload);
    expect(r.nameMessages).toEqual([]);
    expect(r.mendixDialog).toBeNull();
    expect(r.title).toContain('Application Form - Phase 2');
    // The payload must not have been injected as a live <script> element.
    const injected = await bf.page.evaluate(() => [...document.scripts].some((s) => s.textContent.includes('alert(1)')));
    expect(injected).toBe(false);
    expect(r.messages).toContain('UAN Number is mandatory');
  });

  // Excel TC_32
  test('TC_32: Verify the Name field against SQL injection input', async () => {
    const payload = "' OR '1'='1";
    const r = await injectIntoFatherName(payload);
    console.log('TC_32 result:', JSON.stringify(r));
    expect(r.jsDialogs).toEqual([]);
    expect(r.value).toBe(payload);
    expect(r.nameMessages).toEqual([]);
    expect(r.mendixDialog).toBeNull();
    expect(r.title).toContain('Application Form - Phase 2');
    await expect(otherDetails.bloodGroup).toBeVisible();
    // Same blocking messages as a normal Next with these sections blank.
    expect(r.messages).toContain('UAN Number is mandatory');
    expect(r.messages).toContain('Contact Number is mandatory');
  });

  // Excel TC_33 - two "Brother" rows are the Excel's own scenario. A second
  // "Father" and then a second "Mother" are also tried, since those are the
  // preset rows. Confirmed live: duplicate Brother is accepted; a second
  // Father or Mother raises "Relation exists" on both clashing rows.
  test('TC_33: Verify whether multiple dependents can share the same Relation value', async () => {
    await fillParentsValidly();
    const a = await otherDetails.addDependent(settle, bf);
    await otherDetails.fillDependentRow(a, { name: 'Brother One', relation: 'Brother', dob: '15/08/1995' });
    const b = await otherDetails.addDependent(settle, bf);
    await otherDetails.fillDependentRow(b, { name: 'Brother Two', relation: 'Brother', dob: '15/08/1998' });
    await settle(bf);

    const rowMessages = async (i) => [
      ...(await otherDetails.fieldValidationMessages(otherDetails.dependentNames.nth(i))),
      ...(await otherDetails.fieldValidationMessages(otherDetails.dependentRelations.nth(i))),
      ...(await otherDetails.fieldValidationMessages(otherDetails.dependentDOBs.nth(i))),
    ];
    await test.step('two "Brother" rows', async () => {
      const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      const got = { a: await rowMessages(a), b: await rowMessages(b), section: await otherDetails.dependentDetailsSection.locator('.mx-validation-message').allInnerTexts(), popup: await otherDetails.openDialogText() };
      console.log('TC_33 two Brothers:', JSON.stringify(got), 'all:', JSON.stringify(messages));
      expect(got.a).toEqual([]);
      expect(got.b).toEqual([]);
      expect(got.section).toEqual([]);
      expect(got.popup).toBeNull();
    });

    await test.step('second "Father" row', async () => {
      await otherDetails.selectByLabel(otherDetails.dependentRelations.nth(b), 'Father');
      await settle(bf);
      await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      const perRow = [];
      for (let i = 0; i < 4; i++) perRow.push(await otherDetails.fieldValidationMessages(otherDetails.dependentRelations.nth(i)));
      console.log('TC_33 second Father - Relation messages per row:', JSON.stringify(perRow));
      expect(perRow[0]).toContain('Relation exists');
      expect(perRow[b]).toContain('Relation exists');
    });

    await test.step('second "Mother" row', async () => {
      await otherDetails.selectByLabel(otherDetails.dependentRelations.nth(b), 'Mother');
      await settle(bf);
      await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      const perRow = [];
      for (let i = 0; i < 4; i++) perRow.push(await otherDetails.fieldValidationMessages(otherDetails.dependentRelations.nth(i)));
      console.log('TC_33 second Mother - Relation messages per row:', JSON.stringify(perRow));
      expect(perRow[1]).toContain('Relation exists');
      expect(perRow[b]).toContain('Relation exists');
      expect(perRow[0]).toEqual([]);
    });
  });

  // Excel TC_34 - 160 characters (the Excel's "150+"), then 250 to find out
  // what happens past the input's maxlength (200, read from the DOM).
  test('TC_34: Verify how the Name field handles an unusually long input', async () => {
    const name = otherDetails.dependentNames.nth(0);
    const maxLength = await name.getAttribute('maxlength');
    await fillParentsValidly();
    const results = {};
    for (const len of [160, 250]) {
      await otherDetails.fillDependentRow(0, { name: 'A'.repeat(len) });
      await settle(bf);
      await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      results[len] = { kept: (await name.inputValue()).length, messages: await otherDetails.fieldValidationMessages(name), popup: await otherDetails.openDialogText() };
      await otherDetails.dismissDialogs(settle, bf);
    }
    console.log('TC_34 maxlength:', maxLength, 'results:', JSON.stringify(results));
    expect(results[160]).toEqual({ kept: 160, messages: [], popup: null });
    expect(results[250].messages).toEqual([]);
    expect(results[250].kept).toBe(Number(maxLength));
  });
});

// ---- 1.3 UAN Details (TC_35-TC_40), confirmed live 2026-09-25 ----
// All five pooled accounts in utils/Phase2TestCandidates.js are
// experienced=Yes (read live); `fresher` is the one experienced=No account.
// Radio choices made here are not saved (no test ever gets past a blocked
// Next) and were confirmed not to persist to the next sign-in.
test.describe('Phase 2 - 1.3 UAN Details', () => {
  let bf, otherDetails;

  test.beforeEach(async () => {
    ({ bf, otherDetails } = await newPooledPhase2Session());
  });

  test.afterEach(async () => {
    try {
      await otherDetails.dismissDialogs(settle, bf);
    } finally {
      await bf.closeBrowser();
    }
  });

  // Excel TC_35 - text is compared whitespace-normalised: the fresher help
  // text wraps over three lines in the markup.
  test('TC_35: Verify all static UI text in the "1.3 UAN Details" section', async () => {
    await expect(otherDetails.uanSection.locator('.mx-groupbox-header')).toHaveText('1.3 UAN Details');
    const text = (await otherDetails.uanSection.innerText()).replace(/\s+/g, ' ');
    const questions = [
      'Are you experienced?',
      'Are you already a member of PF in your previous establishment?',
      'Have you withdrawn the full PF amount from your previous EPF Account?',
      'Are you already a member of Pension in your previous establishment?',
      'Have you withdrawn the full pension amount from your previous EPS account?',
    ];
    for (const q of questions) expect.soft(text, q).toContain(`${q} Yes No`);
    expect.soft(text).toContain('UAN Number*');
    expect.soft(text).toContain('ESIC number of last company');
    expect.soft(text).toContain('If you are a fresher, watch this video to create your UAN.');

    // Asterisks (rewritten 2026-09-25 with the user): every mandatory field
    // must carry the red "*". UAN Number and "member of PF" are always
    // mandatory; withdrawn PF / member of Pension / withdrawn pension are
    // mandatory once enabled, so they are enabled first (memberPF = Yes,
    // then memberPension = Yes) before the labels are read. "Are you
    // experienced?" (read-only) and ESIC (optional) must not have one.
    // KNOWN DEFECT (confirmed live 3/3): none of the four PF/Pension
    // questions shows an asterisk, even once enabled - only UAN Number does.
    await otherDetails.memberPFRadios.nth(0).check();
    await settle(bf);
    await otherDetails.memberPensionRadios.nth(0).check();
    await settle(bf);
    await expect(otherDetails.withdrawnPFRadios.first()).toBeEnabled();
    await expect(otherDetails.memberPensionRadios.first()).toBeEnabled();
    await expect(otherDetails.withdrawnPensionRadios.first()).toBeEnabled();

    const asterisks = await otherDetails.uanAsteriskLabels();
    console.log('TC_35 labels with an asterisk (all conditional questions enabled):', JSON.stringify(asterisks));
    const mandatory = ['UAN Number', questions[1], questions[2], questions[3], questions[4]];
    for (const label of mandatory) expect.soft(asterisks, `"${label}" must show the red mandatory asterisk`).toContain(label);
    for (const label of [questions[0], 'ESIC number of last company']) {
      expect.soft(asterisks, `"${label}" must NOT show a mandatory asterisk`).not.toContain(label);
    }
  });

  // Excel TC_36
  test('TC_36: Verify the "1.3 UAN Details" section toggle expands and collapses correctly', async () => {
    await expect(otherDetails.uanSectionToggleIcon).toHaveClass(/mx-icon-substract/);
    await expect(otherDetails.memberPFRadios.first()).toBeVisible();
    await expect(otherDetails.uanNumber).toBeVisible();

    await otherDetails.toggleSection(otherDetails.uanSectionToggleIcon);
    await settle(bf);
    await expect(otherDetails.memberPFRadios.first()).not.toBeVisible();
    await expect(otherDetails.uanNumber).not.toBeVisible();
    await expect(otherDetails.uanSectionToggleIcon).toHaveClass(/mx-icon-add/);

    await otherDetails.toggleSection(otherDetails.uanSectionToggleIcon);
    await settle(bf);
    await expect(otherDetails.memberPFRadios.first()).toBeVisible();
    await expect(otherDetails.uanNumber).toBeVisible();
    await expect(otherDetails.uanSectionToggleIcon).toHaveClass(/mx-icon-substract/);
  });

  // Excel TC_37 - the `single` account went through Phase 1 with
  // fill_Experienced(), i.e. "Are you experienced?" = Yes.
  test('TC_37: Verify "Are you experienced?" is read-only and correctly carries over the value from Phase 1', async () => {
    await expect(otherDetails.experiencedRadios).toHaveCount(2);
    await expect(otherDetails.experiencedRadios.nth(0)).toBeDisabled();
    await expect(otherDetails.experiencedRadios.nth(1)).toBeDisabled();
    expect(await otherDetails.radioStates(otherDetails.experiencedRadios)).toEqual([true, false]);

    await otherDetails.experiencedRadios.nth(1).scrollIntoViewIfNeeded();
    await otherDetails.experiencedRadios.nth(1).click({ force: true }).catch(() => {});
    await bf.page.locator(`label[for="${await otherDetails.experiencedRadios.nth(1).getAttribute('id')}"]`).click({ force: true }).catch(() => {});
    await settle(bf);
    expect(await otherDetails.radioStates(otherDetails.experiencedRadios)).toEqual([true, false]);
  });

  // Excel TC_39 - message checked on the memberPF group itself.
  test('TC_39: Verify "Are you already a member of PF..." is a mandatory field', async () => {
    expect(await otherDetails.radioStates(otherDetails.memberPFRadios)).toEqual([false, false]);
    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const fieldMessages = await otherDetails.fieldValidationMessages(otherDetails.memberPFRadios.first());
    console.log('TC_39 memberPF messages:', JSON.stringify(fieldMessages));
    expect(fieldMessages).toContain('Please select whether you were a PF member in your previous establishment.');
    expect(messages).toContain('Please select whether you were a PF member in your previous establishment.');
  });

  // Excel TC_40
  test('TC_40: Verify "Have you withdrawn the full PF amount..." stays disabled until "member of PF" is answered "Yes"', async () => {
    expect(await otherDetails.radioStates(otherDetails.memberPFRadios)).toEqual([false, false]);
    await expect(otherDetails.withdrawnPFRadios.nth(0)).toBeDisabled();
    await expect(otherDetails.withdrawnPFRadios.nth(1)).toBeDisabled();

    await otherDetails.memberPFRadios.nth(0).check();
    await settle(bf);
    await expect(otherDetails.withdrawnPFRadios.nth(0)).toBeEnabled();
    await expect(otherDetails.withdrawnPFRadios.nth(1)).toBeEnabled();
    await otherDetails.withdrawnPFRadios.nth(0).check();
    await settle(bf);
    expect(await otherDetails.radioStates(otherDetails.withdrawnPFRadios)).toEqual([true, false]);
  });
});

// ---- 1.3 UAN Details, batch 5 (TC_41-TC_50; TC_49 deliberately NOT
// automated - kept Pending on the user's instruction) ----
test.describe('Phase 2 - 1.3 UAN Details - cascade and UAN Number', () => {
  let bf, otherDetails;

  test.beforeEach(async () => {
    ({ bf, otherDetails } = await newPooledPhase2Session());
  });

  test.afterEach(async () => {
    try {
      await otherDetails.dismissDialogs(settle, bf);
    } finally {
      await bf.closeBrowser();
    }
  });

  // Excel TC_41
  test('TC_41: Verify "Are you already a member of Pension..." stays disabled until "member of PF" is answered "Yes"', async () => {
    expect(await otherDetails.radioStates(otherDetails.experiencedRadios), 'experienced=Yes account').toEqual([true, false]);
    expect(await otherDetails.radioStates(otherDetails.memberPFRadios)).toEqual([false, false]);
    await expect(otherDetails.memberPensionRadios.nth(0)).toBeDisabled();
    await expect(otherDetails.memberPensionRadios.nth(1)).toBeDisabled();

    await otherDetails.memberPFRadios.nth(0).check();
    await settle(bf);
    expect(await otherDetails.radioStates(otherDetails.withdrawnPFRadios), 'withdrawn PF left unanswered').toEqual([false, false]);
    await expect(otherDetails.memberPensionRadios.nth(0)).toBeEnabled();
    await expect(otherDetails.memberPensionRadios.nth(1)).toBeEnabled();
  });

  // Excel TC_42
  test('TC_42: Verify "Have you withdrawn the full pension amount..." stays disabled until "member of Pension" is answered "Yes"', async () => {
    await otherDetails.memberPFRadios.nth(0).check();
    await settle(bf);
    expect(await otherDetails.radioStates(otherDetails.memberPensionRadios)).toEqual([false, false]);
    await expect(otherDetails.withdrawnPensionRadios.nth(0)).toBeDisabled();
    await expect(otherDetails.withdrawnPensionRadios.nth(1)).toBeDisabled();

    await otherDetails.memberPensionRadios.nth(0).check();
    await settle(bf);
    await expect(otherDetails.withdrawnPensionRadios.nth(0)).toBeEnabled();
    await expect(otherDetails.withdrawnPensionRadios.nth(1)).toBeEnabled();
  });

  // Excel TC_43 - each message is checked on its own question.
  test('TC_43: Verify the three downstream PF/Pension questions are each mandatory once enabled', async () => {
    await otherDetails.memberPFRadios.nth(0).check();
    await settle(bf);
    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const got = {
      withdrawnPF: await otherDetails.fieldValidationMessages(otherDetails.withdrawnPFRadios.first()),
      memberPension: await otherDetails.fieldValidationMessages(otherDetails.memberPensionRadios.first()),
      withdrawnPension: await otherDetails.fieldValidationMessages(otherDetails.withdrawnPensionRadios.first()),
      memberPF: await otherDetails.fieldValidationMessages(otherDetails.memberPFRadios.first()),
    };
    console.log('TC_43 per-question messages:', JSON.stringify(got), 'all:', JSON.stringify(messages));
    expect(got.withdrawnPF).toContain('Please select whether you have withdrawn the full PF amount from your previous EPF account.');
    expect(got.memberPension).toContain('Please select whether you were a member of the Pension scheme in your previous establishment.');
    expect(got.withdrawnPension).toContain('Please indicate whether you have withdrawn the full pension amount from your previous EPS account.');
    expect(got.memberPF).toEqual([]);
  });

  // Excel TC_64 (new row, user-approved 2026-09-25). The downstream messages
  // only exist after a Next with memberPF = Yes (confirmed live: selecting
  // memberPF = Yes alone shows none), so a Next comes first to put the
  // "withdrawn pension" message on screen; memberPension = No must then
  // clear it, and a second Next (with withdrawn PF answered) must raise no
  // pension-related message at all.
  test('TC_64: Verify selecting "No" for Pension membership clears the withdrawn-pension requirement', async () => {
    const pensionMsgs = (list) => list.filter((m) => /pension|EPS/i.test(m));
    await otherDetails.memberPFRadios.nth(0).check();
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    await otherDetails.dismissDialogs(settle, bf);
    const before = await otherDetails.fieldValidationMessages(otherDetails.withdrawnPensionRadios.first());
    expect(before, 'precondition: withdrawn-pension message on screen').toContain('Please indicate whether you have withdrawn the full pension amount from your previous EPS account.');

    await otherDetails.memberPensionRadios.nth(1).check();
    await settle(bf);
    await expect(otherDetails.withdrawnPensionRadios.nth(0)).toBeDisabled();
    await expect(otherDetails.withdrawnPensionRadios.nth(1)).toBeDisabled();
    expect(await otherDetails.fieldValidationMessages(otherDetails.withdrawnPensionRadios.first()), 'message gone after Pension = No').toEqual([]);

    await otherDetails.withdrawnPFRadios.nth(0).check();
    await settle(bf);
    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const got = {
      all: messages,
      withdrawnPension: await otherDetails.fieldValidationMessages(otherDetails.withdrawnPensionRadios.first()),
      memberPension: await otherDetails.fieldValidationMessages(otherDetails.memberPensionRadios.first()),
      withdrawnPF: await otherDetails.fieldValidationMessages(otherDetails.withdrawnPFRadios.first()),
      withdrawnPensionDisabled: await otherDetails.withdrawnPensionRadios.first().isDisabled(),
    };
    console.log('TC_64 after Next:', JSON.stringify(got));
    expect(pensionMsgs(got.all)).toEqual([]);
    expect(got.withdrawnPension).toEqual([]);
    expect(got.memberPension).toEqual([]);
    expect(got.withdrawnPF).toEqual([]);
    expect(got.withdrawnPensionDisabled).toBe(true);
  });

  // Excel TC_45 - `single` is experienced=Yes.
  test('TC_45: Verify "ESIC number of last company" is enabled when experienced = "Yes"', async () => {
    expect(await otherDetails.radioStates(otherDetails.experiencedRadios)).toEqual([true, false]);
    expect(await otherDetails.radioStates(otherDetails.memberPFRadios), 'no PF/Pension answer given').toEqual([false, false]);
    await expect(otherDetails.esicNumber).toBeEnabled();
    await otherDetails.esicNumber.scrollIntoViewIfNeeded();
    await otherDetails.esicNumber.fill('3112345678');
    await otherDetails.esicNumber.press('Tab');
    await settle(bf);
    await expect(otherDetails.esicNumber).toHaveValue('3112345678');
  });

  // Shared by TC_47/TC_48/TC_50: type a UAN, Next, return the messages
  // rendered on the UAN Number field itself.
  async function uanMessagesFor(value) {
    await otherDetails.uanNumber.scrollIntoViewIfNeeded();
    await otherDetails.uanNumber.fill(value);
    await otherDetails.uanNumber.press('Tab');
    await settle(bf);
    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    return {
      kept: await otherDetails.uanNumber.inputValue(),
      field: await otherDetails.fieldValidationMessages(otherDetails.uanNumber),
      all: messages,
    };
  }

  // Excel TC_47
  test('TC_47: Verify UAN Number rejects a malformed value', async () => {
    const r = await uanMessagesFor('12345');
    console.log('TC_47 UAN "12345":', JSON.stringify(r));
    expect(r.field).toContain('UAN Number is invalid');
    expect(r.field).not.toContain('UAN Number is mandatory');
  });

  // Excel TC_48 - Next stays blocked by the other blank sections on purpose.
  test('TC_48: Verify UAN Number accepts a valid 12-digit value', async () => {
    const r = await uanMessagesFor('876578765432');
    console.log('TC_48 UAN "876578765432":', JSON.stringify(r));
    expect(r.kept).toBe('876578765432');
    expect(r.field).toEqual([]);
    expect(r.all.filter((m) => /UAN/i.test(m))).toEqual([]);
  });

  // Excel TC_49 - deliberately NOT automated, kept Pending on the user's
  // instruction (see the comment on this describe block above). STANDING
  // CONVENTION (2026-09-28): whenever a test case is left Pending in Excel
  // with a documented reason, add/update a matching
  // test.skip(true, '<same reason>') stub so Excel and the dashboard/report
  // always stay in sync - see project_context.md.
  test('TC_49: Verify the fresher help text/video link works correctly', async () => {
    test.skip(true, "Blocked: YouTube is blocked on this network, so the video's content/playability can't be verified from here.");
  });

  // Excel TC_50
  test('TC_50: Verify the UAN Number field against injection input', async () => {
    const jsDialogs = [];
    bf.page.on('dialog', async (d) => { jsDialogs.push(`${d.type()}: ${d.message()}`); await d.dismiss(); });
    const payload = '<script>alert(1)</script>';
    const r = await uanMessagesFor(payload);
    const injected = await bf.page.evaluate(() => [...document.scripts].some((s) => s.textContent.includes('alert(1)')));
    console.log('TC_50 UAN payload:', JSON.stringify({ ...r, jsDialogs, injected, mendixDialog: await otherDetails.openDialogText() }));
    expect(jsDialogs).toEqual([]);
    expect(injected).toBe(false);
    expect(await bf.page.title()).toContain('Application Form - Phase 2');
    expect(r.field).toContain('UAN Number is invalid');
  });
});

// Fresher (experienced = No) account: utils/Phase2TestCandidates.js `fresher`.
test.describe('Phase 2 - 1.3 UAN Details - fresher', () => {
  let bf, otherDetails;

  test.beforeEach(async () => {
    ({ bf, otherDetails } = await newPooledPhase2Session(phase2Candidates.fresher));
  });

  test.afterEach(async () => {
    try {
      await otherDetails.dismissDialogs(settle, bf);
    } finally {
      await bf.closeBrowser();
    }
  });

  // Excel TC_44
  test('TC_44: Verify "ESIC number of last company" is disabled for a fresher (experienced = "No")', async () => {
    expect(await otherDetails.radioStates(otherDetails.experiencedRadios), 'fresher account').toEqual([false, true]);
    await otherDetails.esicNumber.scrollIntoViewIfNeeded();
    await expect(otherDetails.esicNumber).toBeDisabled();
    expect(await attemptTyping(bf, otherDetails.esicNumber, '3112345678')).toBe('');
  });

});

// Excel TC_46 - extended 2026-09-25 (user-approved) to prove its title: the
// same check on the fresher (experienced=No) AND the experienced=Yes account,
// one sign-in each (same shape as TC_38).
test.describe('Phase 2 - 1.3 UAN Details - UAN Number for fresher and experienced', () => {
  test('TC_46: Verify UAN Number is enabled and mandatory regardless of experienced/fresher status', async () => {
    test.setTimeout(180000);
    for (const [key, experienced] of [['fresher', [false, true]], ['single', [true, false]]]) {
      await test.step(`${key} account`, async () => {
        const { bf, otherDetails } = await newPooledPhase2Session(phase2Candidates[key]);
        try {
          expect(await otherDetails.radioStates(otherDetails.experiencedRadios), `${key}: experienced [Yes, No]`).toEqual(experienced);
          await expect(otherDetails.uanNumber, `${key}: UAN enabled`).toBeEnabled();
          await expect(otherDetails.uanNumber, `${key}: UAN blank`).toHaveValue('');
          await otherDetails.clickNextAndGetValidationMessages(settle, bf);
          const field = await otherDetails.fieldValidationMessages(otherDetails.uanNumber);
          console.log(`TC_46 ${key} UAN field messages:`, JSON.stringify(field));
          expect(field, `${key}: mandatory message under UAN Number`).toContain('UAN Number is mandatory');
          await otherDetails.dismissDialogs(settle, bf);
        } finally {
          await bf.closeBrowser();
        }
      });
    }
  });
});

// Excel TC_38 - one sign-in per experienced status, so it lives outside the
// beforeEach above (same shape as TC_08).
test.describe('Phase 2 - 1.3 UAN Details - experienced vs fresher', () => {
  test('TC_38: Verify "Are you already a member of PF in your previous establishment?" is enabled regardless of experienced/fresher status', async () => {
    test.setTimeout(180000);
    for (const [key, expected] of [['fresher', [false, true]], ['single', [true, false]]]) {
      await test.step(`${key} account`, async () => {
        const { bf, otherDetails } = await newPooledPhase2Session(phase2Candidates[key]);
        try {
          expect(await otherDetails.radioStates(otherDetails.experiencedRadios), `${key}: experienced [Yes, No]`).toEqual(expected);
          await expect(otherDetails.memberPFRadios.nth(0)).toBeEnabled();
          await expect(otherDetails.memberPFRadios.nth(1)).toBeEnabled();
          await otherDetails.memberPFRadios.nth(1).check();
          await settle(bf);
          expect(await otherDetails.radioStates(otherDetails.memberPFRadios), `${key}: memberPF answerable`).toEqual([false, true]);
        } finally {
          await bf.closeBrowser();
        }
      });
    }
  });
});

// Excel TC_62 - the ONLY test that clicks Next on a fully valid Other
// Details form, so it runs on the spare `divorced` pooled account, never on
// `single`/`fresher`. Confirmed live 2026-09-25: a successful Next SAVES
// every entered value and renders "2. Upload Documents"; the next sign-in
// still lands on Other Details (with the saved values), so the fast path
// keeps working. Both Emergency Contact rows are filled: a blank second row
// is rejected (Name/Relation/Contact Number is mandatory) - flagged, see
// the TC_62 Excel row.
test.describe('Phase 2 - 1. Other Details -> 2. Upload Documents (spare account)', () => {
  test('TC_62: Verify clicking Next, once all of 1.1-1.4 are validly completed, renders the "2. Upload Documents" section', async () => {
    const { bf, otherDetails } = await newPooledPhase2Session(phase2Candidates.divorced);
    try {
      expect(await otherDetails.getSelectedText(otherDetails.maritalStatus)).toBe('Divorced');
      await expect(otherDetails.dateOfMarriage).toBeDisabled();
      expect(await otherDetails.stepCircleBackground('Upload Documents')).toBe(UNREACHED_STEP_BG);

      await otherDetails.selectByLabel(otherDetails.bloodGroup, 'A+');
      await otherDetails.selectByLabel(otherDetails.religion, 'Hinduism');
      await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
      await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
      await otherDetails.dependentNominees.nth(0).check();
      await otherDetails.memberPFRadios.nth(1).check();
      await settle(bf);
      await otherDetails.uanNumber.fill('876578765432');
      await otherDetails.uanNumber.press('Tab');
      await otherDetails.fillEmergencyRow(0, { name: 'Ravi Kumar', relation: 'Brother', contact1: '9876543210' });
      await otherDetails.fillEmergencyRow(1, { name: 'Sunita Devi', relation: 'Sister', contact1: '9876543211' });
      await settle(bf);

      const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      expect(messages, 'no validation message on a fully valid form').toEqual([]);
      await expect(otherDetails.dialog).toHaveCount(0);
      await expect(otherDetails.bloodGroup, 'left Other Details').toHaveCount(0);
      // The indicator renders the "2." disc and the "Upload Documents"
      // label as separate elements.
      await expect(otherDetails.stepLabel('Upload Documents')).toBeVisible();
      await expect(otherDetails.stepCircle('Upload Documents')).toHaveText('2.');
      await expect(bf.page.getByText('Click to Upload General Documents')).toBeVisible();
      await expect(bf.page.getByText('Aadhaar Card (Both the front and back of card)')).toBeVisible();
      expect(await otherDetails.stepCircleBackground('Upload Documents'), 'step 2 is now current').toBe(CURRENT_STEP_BG);
      const step1 = { bg: await otherDetails.stepCircleBackground('Other Details'), text: (await otherDetails.stepCircle('Other Details').innerText()).trim() };
      console.log('TC_62 step 1 after Next:', JSON.stringify(step1));
    } finally {
      await bf.closeBrowser();
    }
  });
});

// ---- 1.4 Emergency Contact (TC_51-TC_60), batch 6, confirmed live 2026-09-25 ----
// Exactly 2 contact rows, no add button. User ruling: the FIRST contact is
// mandatory, the SECOND may be left blank. Typed values / selections are not
// saved (every Next here stays blocked by the blank 1.1-1.3 sections).
test.describe('Phase 2 - 1.4 Emergency Contact', () => {
  let bf, otherDetails;
  const VALID_ROW = { name: 'Ravi Kumar', relation: 'Brother', contact1: '9876543210' };

  test.beforeEach(async () => {
    ({ bf, otherDetails } = await newPooledPhase2Session());
  });

  test.afterEach(async () => {
    try {
      await otherDetails.dismissDialogs(settle, bf);
    } finally {
      await bf.closeBrowser();
    }
  });

  // Excel TC_51
  test('TC_51: Verify all static UI text in the "1.4 Emergency Contact" section', async () => {
    await expect(otherDetails.ecSection.locator('.mx-groupbox-header')).toHaveText('1.4 Emergency Contact');
    const headers = [
      [1, 'Name of person to be contacted', true],
      [2, 'Relation', true],
      [3, 'Contact Number 1', true],
      [4, 'Contact Number 2', false],
    ];
    for (const [n, text, mandatory] of headers) {
      await expect.soft(otherDetails.ecHeaderLabel(n), `header ${n}`).toHaveText(text);
      await expect.soft(otherDetails.ecHeaderAsterisk(n), `"${text}" asterisk`).toHaveCount(mandatory ? 1 : 0);
    }
    await expect(otherDetails.ecNames).toHaveCount(2);
    await expect(otherDetails.ecSection.locator('button')).toHaveCount(0);
  });

  // Excel TC_52
  test('TC_52: Verify the "1.4 Emergency Contact" section toggle expands and collapses correctly', async () => {
    await expect(otherDetails.ecSectionToggleIcon).toHaveClass(/mx-icon-substract/);
    await expect(otherDetails.ecNames.first()).toBeVisible();

    await otherDetails.toggleSection(otherDetails.ecSectionToggleIcon);
    await settle(bf);
    await expect(otherDetails.ecNames.first()).not.toBeVisible();
    await expect(otherDetails.ecContact1.first()).not.toBeVisible();
    await expect(otherDetails.ecSectionToggleIcon).toHaveClass(/mx-icon-add/);

    await otherDetails.toggleSection(otherDetails.ecSectionToggleIcon);
    await settle(bf);
    await expect(otherDetails.ecNames.first()).toBeVisible();
    await expect(otherDetails.ecContact1.first()).toBeVisible();
    await expect(otherDetails.ecSectionToggleIcon).toHaveClass(/mx-icon-substract/);
  });

  // Excel TC_53 - first row.
  test('TC_53: Verify "Name of person to be contacted" is a mandatory field', async () => {
    await otherDetails.fillEmergencyRow(0, { ...VALID_ROW, name: '' });
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const row = await otherDetails.ecRowMessages(0);
    console.log('TC_53 row 1 messages:', JSON.stringify(row));
    expect(row.name).toContain('Name is mandatory');
    expect(row.relation).toEqual([]);
    expect(row.contact1).toEqual([]);
  });

  // Excel TC_54 - the Excel step uses the SECOND row (Name + Contact Number
  // 1 filled, Relation left unselected); the first row is filled validly.
  test('TC_54: Verify Relation is a mandatory field', async () => {
    await otherDetails.fillEmergencyRow(0, { ...VALID_ROW });
    await otherDetails.fillEmergencyRow(1, { name: 'Sunita Devi', relation: '', contact1: '9876543211' });
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const rows = [await otherDetails.ecRowMessages(0), await otherDetails.ecRowMessages(1)];
    console.log('TC_54 row messages:', JSON.stringify(rows));
    expect(rows[1].relation).toContain('Relation is mandatory');
    expect(rows[1].name).toEqual([]);
    expect(rows[1].contact1).toEqual([]);
  });

  // Excel TC_55 - checked on both rows.
  test('TC_55: Verify the Relation dropdown shows the correct list of options', async () => {
    const expected = ['Husband', 'Wife', 'Father', 'Mother', 'Brother', 'Sister', 'Father-In-Law', 'Mother-In-Law', 'Son', 'Daughter', 'Friend', 'Other'];
    for (let i = 0; i < 2; i++) {
      expect(await otherDetails.getOptionTexts(otherDetails.ecRelations.nth(i)), `row ${i + 1}`).toEqual(expected);
    }
  });

  // Excel TC_56 - first row.
  test('TC_56: Verify Contact Number 1 is a mandatory field', async () => {
    await otherDetails.fillEmergencyRow(0, { ...VALID_ROW, contact1: '' });
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const row = await otherDetails.ecRowMessages(0);
    console.log('TC_56 row 1 messages:', JSON.stringify(row));
    expect(row.contact1).toContain('Contact Number is mandatory');
    expect(row.name).toEqual([]);
    expect(row.relation).toEqual([]);
  });

  // Excel TC_57 - first row.
  test('TC_57: Verify Contact Number 1 rejects a malformed value', async () => {
    await otherDetails.fillEmergencyRow(0, { ...VALID_ROW, contact1: '12345' });
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const row = await otherDetails.ecRowMessages(0);
    console.log('TC_57 row 1 messages:', JSON.stringify(row));
    expect(row.contact1).toContain('Contact Number is not valid');
  });

  // Excel TC_58 - "does not block proceeding" checked the TC_10/TC_20 way:
  // with both rows valid and Contact Number 2 blank on both, 1.4 raises no
  // message at all (Next itself stays blocked by the blank 1.1-1.3 fields).
  test('TC_58: Verify Contact Number 2 is optional', async () => {
    await otherDetails.fillEmergencyRow(0, { ...VALID_ROW });
    await otherDetails.fillEmergencyRow(1, { name: 'Sunita Devi', relation: 'Sister', contact1: '9876543211' });
    await settle(bf);
    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const section = await otherDetails.ecSection.locator('.mx-validation-message').allInnerTexts();
    console.log('TC_58 1.4 messages:', JSON.stringify(section), 'all:', JSON.stringify(messages));
    for (let i = 0; i < 2; i++) await expect(otherDetails.ecContact2.nth(i)).toHaveValue('');
    expect(section).toEqual([]);
    expect(messages.filter((m) => /Contact Number/i.test(m))).toEqual([]);
  });

  // Excel TC_59 - open-ended row: records what the app does with a 5-digit
  // Contact Number 2 on an otherwise valid first row.
  test('TC_59: Verify Contact Number 2, if filled, is format-validated the same way as Contact Number 1', async () => {
    await otherDetails.fillEmergencyRow(0, { ...VALID_ROW, contact2: '12345' });
    await settle(bf);
    await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const row = await otherDetails.ecRowMessages(0);
    console.log('TC_59 row 1 messages:', JSON.stringify(row));
    expect(row.contact2).toContain('Contact Number is not valid');
    expect(row.contact1).toEqual([]);
  });

  // Excel TC_61 - same shape as TC_31: payload in the first contact's Name,
  // rest of the row valid, Next (blocked by the blank 1.1-1.3 sections).
  test('TC_61: Verify the Name of person to be contacted field against script injection input', async () => {
    const jsDialogs = [];
    bf.page.on('dialog', async (d) => { jsDialogs.push(`${d.type()}: ${d.message()}`); await d.dismiss(); });
    const payload = '<script>alert(1)</script>';
    await otherDetails.fillEmergencyRow(0, { ...VALID_ROW, name: payload });
    await settle(bf);
    const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
    const r = {
      jsDialogs,
      value: await otherDetails.ecNames.nth(0).inputValue(),
      row: await otherDetails.ecRowMessages(0),
      injected: await bf.page.evaluate(() => [...document.scripts].some((s) => s.textContent.includes('alert(1)'))),
      title: await bf.page.title(),
      all: messages,
    };
    console.log('TC_61 result:', JSON.stringify(r));
    expect(r.jsDialogs).toEqual([]);
    expect(r.value).toBe(payload);
    expect(r.row.name).toEqual([]);
    expect(r.injected).toBe(false);
    expect(r.title).toContain('Application Form - Phase 2');
    expect(r.all).toContain('UAN Number is mandatory');
  });

  // Excel TC_60 - KNOWN DEFECT (user-reported, Priority P3): a Single
  // candidate can pick marriage-dependent relations with no restriction. The
  // Expected ("rejected or restricted") is asserted per relation: the option
  // must be missing from the list, OR selecting it must raise a message on
  // that Relation field after Next.
  test('TC_60: Verify Emergency Contact Relation does not restrict marriage-dependent options when the candidate\'s Marital Status is "Single"', async () => {
    expect(await otherDetails.getSelectedText(otherDetails.maritalStatus)).toBe('Single');
    const options = await otherDetails.getOptionTexts(otherDetails.ecRelations.nth(0));
    const results = {};
    for (const relation of ['Husband', 'Wife', 'Father-In-Law', 'Mother-In-Law']) {
      if (!options.includes(relation)) { results[relation] = 'not offered'; continue; }
      await otherDetails.fillEmergencyRow(0, { ...VALID_ROW, relation });
      await settle(bf);
      await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      results[relation] = await otherDetails.fieldValidationMessages(otherDetails.ecRelations.nth(0));
      await otherDetails.dismissDialogs(settle, bf);
    }
    console.log('TC_60 Single candidate, per relation:', JSON.stringify(results));
    for (const [relation, r] of Object.entries(results)) {
      expect.soft(r === 'not offered' || r.length > 0, `"${relation}" should be rejected or restricted for a Single candidate`).toBe(true);
    }
  });
});

// ---- 2. Upload Documents (TC_65-74), batch 1, added 2026-09-28 ----
// Reached via a real successful Next on a fully-valid, already-SAVED Other
// Details form - see utils/Phase2TestCandidates.js's own comments on
// `divorced` (experienced=Yes) and `fresherUploads` (experienced=No): both
// accounts land back on Other Details pre-filled on sign-in, and a repeat
// Next succeeds with zero validation messages. NEVER use `single`/`fresher`
// here (destructive to the "1. Other Details" suite's own pooled accounts -
// see that file's comment), and NEVER check the consent checkbox AND click
// the real Submit button on any account in this batch (reserved for a
// dedicated disposable account in a later batch, per the user's explicit
// instruction).
//
// TC_72 (a dependent marked deceased should NOT get a document-upload
// block) is NOT automated in this batch: confirmed live (2026-09-28)
// neither `divorced` nor `fresherUploads` has a dependent marked deceased,
// and marking one via a Date of Demise on either pooled account would
// PERMANENTLY alter its saved Other Details state (a successful Next commits
// it server-side - see TC_62's own comment) for every later test that
// reuses them. Flagged for the user to decide (a dedicated new disposable
// account, vs. accepting a one-way change to an existing pooled account)
// rather than forcing it through here. Excel row left untouched (still
// "Not yet automated" / Pending).

// Signs in, then clicks Next once on the already-valid, already-SAVED Other
// Details form to reach "2. Upload Documents" - mirrors
// utils/CandidateFlowHelpers.js's reachPhase2Uploads(), but built on
// newPooledPhase2Session() above so this file's existing
// ITAP_Phase2OtherDetailsPage instance (step-indicator helpers etc.) stays
// available to callers too.
async function newUploadDocumentsSession(candidate) {
  const { bf, otherDetails } = await newPooledPhase2Session(candidate);
  const nextMessages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
  const uploadDocs = new ITAP_Phase2UploadDocumentsPage(bf.page);
  return { bf, otherDetails, uploadDocs, nextMessages };
}

test.describe('Phase 2 - 2. Upload Documents - General/Qualification/Experience Documents (experienced)', () => {
  let bf, otherDetails, uploadDocs;

  test.beforeEach(async () => {
    ({ bf, otherDetails, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.divorced));
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_65 - KNOWN MISMATCH (flagged, not silently corrected): the live
  // text is "Note: Max 2 files per document... | File name : 256 characters
  // max | ..." - the Excel step 2 quote omits the leading "Note: " prefix
  // and has no space before the colon in "File name: 256...". The assertion
  // below encodes the real, confirmed-live text (same convention as
  // TC_02/TC_10/TC_35 above), so Excel Status is recorded as Failed to
  // reflect the Expected-vs-Actual wording mismatch, not because anything
  // here is actually broken.
  test('TC_65: Verify the static note text and Document Upload Instructions link on "2. Upload Documents"', async () => {
    const noteText = await uploadDocs.noteText.innerText();
    console.log('TC_65 note text:', JSON.stringify(noteText));
    expect(noteText).toBe(
      'Note: Max 2 files per document (except Experience documents: max 10) | Max 5 MB per file | File name : 256 characters max | PDF, PNG, JPEG, JPG only',
    );
    await expect(uploadDocs.instructionsLink).toBeVisible();
    await expect(uploadDocs.instructionsLink).toHaveText('Click Here To See Document Upload Instructions');
  });

  // Excel TC_66
  test('TC_66: Verify the step indicator shows "Other Details" completed and "Upload Documents" as the current step', async () => {
    await expect(otherDetails.stepLabel('Other Details')).toBeVisible();
    await expect(otherDetails.stepLabel('Upload Documents')).toBeVisible();
    await expect(otherDetails.stepCircleCheckmark('Other Details'), 'Other Details shows a completed checkmark').toBeVisible();
    await expect(otherDetails.stepCircle('Upload Documents')).toHaveText('2.');
    expect(await otherDetails.stepCircleBackground('Upload Documents'), 'Upload Documents is the current step').toBe(CURRENT_STEP_BG);
  });

  // Excel TC_67
  test('TC_67: Verify all static UI text and mandatory asterisks in "Click to Upload General Documents"', async () => {
    await expect(uploadDocs.generalDocsSection.locator('.mx-groupbox-header')).toHaveText('Click to Upload General Documents');
    const fields = [
      'Aadhaar Card (Both the front and back of card)',
      'PAN Card',
      'Latest Photo (Passport size)',
      'Upload any one: Cancelled Cheque (with Name) / Passbook Copy / Last 3 Months Bank Statement',
      'UAN Profile',
    ];
    for (const label of fields) {
      await expect.soft(uploadDocs.fieldLabel(uploadDocs.generalDocsSection, label), `"${label}" label`).toBeVisible();
      await expect.soft(uploadDocs.fieldAsterisk(uploadDocs.generalDocsSection, label), `"${label}" asterisk`).toHaveCount(1);
    }
    // A "Choose File" control per field (confirmed live: rendered whether
    // the field's own file input is active or disabled-at-cap).
    await expect(uploadDocs.generalDocsSection.locator('.attachment-area')).toHaveCount(fields.length);
  });

  // Excel TC_68
  test('TC_68: Verify all static UI text and mandatory asterisks in "Click to Upload Qualification Documents"', async () => {
    await expect(uploadDocs.qualificationDocsSection.locator('.mx-groupbox-header')).toHaveText('Click to Upload Qualification Documents');
    for (const label of ['10th', '12th']) {
      await expect.soft(uploadDocs.fieldLabel(uploadDocs.qualificationDocsSection, label), `"${label}" label`).toBeVisible();
      await expect.soft(uploadDocs.fieldAsterisk(uploadDocs.qualificationDocsSection, label), `"${label}" must NOT show an asterisk`).toHaveCount(0);
    }
    const highest = 'Highest Qualification (Upload any one of Degree/Provisional Degree Certificate/Final Year Marksheet)';
    await expect(uploadDocs.fieldLabel(uploadDocs.qualificationDocsSection, highest)).toBeVisible();
    await expect(uploadDocs.fieldAsterisk(uploadDocs.qualificationDocsSection, highest)).toHaveCount(1);
  });

  // Excel TC_69 - `divorced` is experienced=Yes (utils/Phase2TestCandidates.js).
  test('TC_69: Verify "Click to Upload Experience Documents" is present and correctly worded for an experienced candidate', async () => {
    await expect(uploadDocs.experienceDocsSection.locator('.mx-groupbox-header')).toHaveText('Click to Upload Experience Documents');
    const label = 'Upload any one: Three months salary slip / Last CTC letter / Promotion or Increment letter';
    await expect(uploadDocs.fieldLabel(uploadDocs.experienceDocsSection, label)).toBeVisible();
    await expect(uploadDocs.fieldAsterisk(uploadDocs.experienceDocsSection, label)).toHaveCount(1);
  });

  // Excel TC_73
  test('TC_73: Verify the consent checkbox text is present, correctly worded, and unchecked by default', async () => {
    await expect(uploadDocs.consentText).toHaveText(
      'I confirm that the details provided by me are accurate to the best of my knowledge. I consent to the collection, processing, and storage of my personal data by Mankind for recruitment purposes.',
    );
    await expect(uploadDocs.consentCheckbox).not.toBeChecked();
  });

  // Excel TC_74 - not a real <a href>, a clickable div that opens a Mendix
  // file URL. Confirmed live 2026-09-28 that Playwright/Chromium treats this
  // specific fetch as a browser DOWNLOAD (the server response carries the
  // file with an attachment disposition) rather than a normal page
  // navigation: a blank tab DOES open for an instant (confirmed via a
  // context 'page' event, matching "opens a new tab"), but Chromium closes
  // it again itself the moment the download is recognised - too fast/timing
  // -dependent to assert a stable page count on, so this instead asserts
  // the one deterministic, always-present proof: the download event itself,
  // carrying the real file URL and suggested filename.
  test('TC_74: Verify "Click Here To See Document Upload Instructions" opens the instructions document in a new tab', async () => {
    const [download] = await Promise.all([
      bf.page.waitForEvent('download'),
      uploadDocs.instructionsLink.click(),
    ]);
    const suggestedFilename = download.suggestedFilename();
    // The file name is double URL-encoded in the raw download URL
    // (confirmed live: "...name=Document%2520Upload%2520Instruction.pdf...",
    // i.e. %20 itself re-encoded to %2520) - decode twice to get back to
    // plain text.
    const url = decodeURIComponent(decodeURIComponent(download.url()));
    console.log('TC_74 download:', JSON.stringify({ suggestedFilename, url }));
    expect(suggestedFilename).toBe('Document Upload Instruction.pdf');
    expect(url).toContain('Document Upload Instruction.pdf');
  });
});

// Excel TC_70 - `fresherUploads` is the dedicated experienced=No account
// (utils/Phase2TestCandidates.js) for this section; lives outside the
// describe above since it needs its own sign-in.
test.describe('Phase 2 - 2. Upload Documents - Experience Documents absent for fresher', () => {
  test('TC_70: Verify "Click to Upload Experience Documents" does not appear for a fresher (experienced=No) candidate', async () => {
    const { bf, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.fresherUploads);
    try {
      await expect(uploadDocs.experienceDocsSection).toHaveCount(0);
      await expect(bf.page.getByText('Click to Upload Experience Documents')).toHaveCount(0);
      // The other three sections must still be there (proves this is a
      // targeted absence, not a broken/empty page).
      await expect(uploadDocs.generalDocsSection).toHaveCount(1);
      await expect(uploadDocs.qualificationDocsSection).toHaveCount(1);
      await expect(uploadDocs.dependentDocsSection).toHaveCount(1);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_71 - reads the dependent rows (name/relation/Date of Demise)
// straight from "1. Other Details" BEFORE clicking Next, so the expected
// heading list is derived from the account's real, live data rather than
// hardcoded - catches a drift in either direction (a name/relation change,
// or a dependent silently getting a Date of Demise) instead of just
// re-confirming today's known values.
test.describe('Phase 2 - 2. Upload Documents - Dependent Documents', () => {
  test('TC_71: Verify a document-upload block appears for every non-deceased dependent', async () => {
    const { bf, otherDetails } = await newPooledPhase2Session(phase2Candidates.divorced);
    try {
      const depCount = await otherDetails.dependentNames.count();
      const expectedHeadings = [];
      for (let i = 0; i < depCount; i++) {
        const demise = await otherDetails.dependentDemises.nth(i).inputValue();
        if (demise) continue; // deceased - excluded per TC_72
        const name = await otherDetails.dependentNames.nth(i).inputValue();
        const relation = await otherDetails.getSelectedText(otherDetails.dependentRelations.nth(i));
        expectedHeadings.push(`${name} - ${relation}'s Documents`);
      }
      console.log('TC_71 expected non-deceased dependent headings:', JSON.stringify(expectedHeadings));

      await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      const uploadDocs = new ITAP_Phase2UploadDocumentsPage(bf.page);

      await expect(uploadDocs.dependentDocsSection.locator('.mx-groupbox-header')).toHaveText('Click to Upload Dependent Documents');
      const actualHeadings = await uploadDocs.dependentDocHeadings.allTextContents();
      console.log('TC_71 actual headings:', JSON.stringify(actualHeadings));
      expect(actualHeadings).toEqual(expectedHeadings);

      const blocks = uploadDocs.dependentDocBlocks;
      expect(await blocks.count()).toBe(expectedHeadings.length);
      for (let i = 0; i < expectedHeadings.length; i++) {
        const block = blocks.nth(i);
        await expect.soft(uploadDocs.fieldLabel(block, 'Aadhaar Card'), `block ${i} "Aadhaar Card" label`).toBeVisible();
        await expect.soft(uploadDocs.fieldAsterisk(block, 'Aadhaar Card'), `block ${i} "Aadhaar Card" asterisk`).toHaveCount(1);
        await expect.soft(uploadDocs.fieldLabel(block, 'Photo'), `block ${i} "Photo" label`).toBeVisible();
        await expect.soft(uploadDocs.fieldAsterisk(block, 'Photo'), `block ${i} "Photo" asterisk`).toHaveCount(1);
      }
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_72 - needs a dependent marked deceased (a Date of Demise), which
// neither `divorced` nor `fresherUploads` has, and marking one on either
// pooled account would PERMANENTLY overwrite its saved Other Details state
// (a successful Next commits server-side - see TC_62's own comment). Built
// on one new, DEDICATED, one-time-signup account instead - see
// utils/Phase2TestCandidates.js's `deceasedDependent` for the full
// rationale. This is the ONLY test in this whole file that runs a genuine
// fresh signup + a real Next with Nominee/UAN/Emergency Contact all filled
// in, and that is deliberate: this account exists solely for this test (and
// future Dependent-Documents-deceased regression), so a real, permanent
// save is safe and expected here, unlike every pooled account above.
test.describe('Phase 2 - 2. Upload Documents - Dependent Documents (deceased dependent)', () => {
  test('TC_72: Verify a dependent marked deceased (Date of Demise set) does NOT get a document-upload block', async () => {
    test.setTimeout(180000);
    const aadhaar = getRandomAadhar();
    console.log('TC_72 new dedicated account Aadhaar:', aadhaar);

    const bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    try {
      // -- Signup -> Phase 1 (Personal/Qualification/Experience, valid) --
      await signupAndReachPhase1(bf, aadhaar);

      const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
      await fillValidPersonalDetails(itapPage1, bf, { maritalStatus: 'Single' });
      await itapPage1.click_NextBtn();
      await bf.hardWait(2);

      const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
      await fillValidQualification(itapPage2, bf);
      await itapPage2.click_NextBtn();
      await bf.hardWait(2);

      const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
      await itapPage3.fill_Experienced(bf.hardWait.bind(bf));
      await bf.hardWait(2);

      const legacyPhase2 = new ITAP_ContinueToPhase2Page(bf.page);
      const itapNumber = await legacyPhase2.Extract_itap_number();
      console.log('TC_72 new account ITAP number:', itapNumber);
      await bf.hardWait(1);
      await legacyPhase2.click_continueToPhase2Btn();
      await bf.hardWait(2);

      // -- Now on "1. Other Details", blank. Father (row 0, "Amandeep
      // Singh") is marked deceased via a Date of Demise after his Date of
      // Birth; Mother (row 1, "Kashish Kaur") is left non-deceased and made
      // the Nominee instead, since a Nominee can't have a Date of Demise. --
      const otherDetails = new ITAP_Phase2OtherDetailsPage(bf.page);
      await otherDetails.selectByLabel(otherDetails.bloodGroup, 'A+');
      await otherDetails.selectByLabel(otherDetails.religion, 'Hinduism');
      await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
      await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
      await otherDetails.fillDate(otherDetails.dependentDemises.nth(0), '15/08/2020');
      await otherDetails.dependentNominees.nth(1).check();
      await otherDetails.memberPFRadios.nth(1).check();
      await settle(bf);
      await otherDetails.uanNumber.fill('876578765432');
      await otherDetails.uanNumber.press('Tab');
      await otherDetails.fillEmergencyRow(0, { name: 'Ravi Kumar', relation: 'Brother', contact1: '9876543210' });
      await otherDetails.fillEmergencyRow(1, { name: 'Sunita Devi', relation: 'Sister', contact1: '9876543211' });
      await settle(bf);

      const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      console.log('TC_72 validation messages after Next:', JSON.stringify(messages));
      expect(messages, 'no validation message on a fully valid form (deceased Father + non-deceased Nominee Mother)').toEqual([]);

      const uploadDocs = new ITAP_Phase2UploadDocumentsPage(bf.page);
      const headings = await uploadDocs.dependentDocHeadings.allTextContents();
      console.log('TC_72 dependent doc headings:', JSON.stringify(headings));
      expect(headings, 'only the non-deceased Mother gets a document block').toEqual(["Kashish Kaur - Mother's Documents"]);
      expect(await uploadDocs.dependentDocBlocks.count()).toBe(1);
      await expect(bf.page.getByText("Amandeep Singh - Father's Documents"), 'no block for the deceased Father').toHaveCount(0);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// ---- 2. Upload Documents - real file uploads (TC_76-84), batch 2, added
// 2026-09-28. TC_75 (unsupported file types blocked by the native OS
// picker) was already automated/Passed and is NOT repeated here.
//
// Uploaded files are NOT undo-able the way Other Details' typed/selected
// values are (confirmed live in batch 1: a file persists across sign-ins
// immediately, well before any Submit) - so, to keep each test's own
// before/after assertions unambiguous rather than depending on another
// test's slot-count history, every test below targets its OWN, previously-
// empty document slot on `fresherUploads` (confirmed empty across the board
// at the start of this batch). TC_83 is the one exception (Experience
// Documents - `divorced` only, since `fresherUploads` has no Experience
// Documents section at all).
//
// waitForFileAccepted() polls allTextContents() rather than asserting
// toContainText() directly on the list locator - Playwright's
// toContainText/toHaveText throw when a locator resolves to MULTIPLE
// elements unless you pass an array to match every one of them, and several
// tests below check a slot that already holds an earlier file by the time
// the assertion runs (e.g. TC_81's 2nd upload, with the 1st still present).
async function waitForFileAccepted(filesLocator, filename, timeout = 20000) {
  await expect.poll(() => filesLocator.allTextContents(), { timeout }).toContain(filename);
}

test.describe('Phase 2 - 2. Upload Documents - real file uploads', () => {
  let bf, otherDetails, uploadDocs;

  test.beforeEach(async () => {
    ({ bf, otherDetails, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.fresherUploads));
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_76 - "Aadhaar Card" slot.
  test('TC_76: Verify a valid PDF file is accepted for a General Document slot', async () => {
    const label = 'Aadhaar Card (Both the front and back of card)';
    await uploadDocs.uploadInto(uploadDocs.generalDocsSection, label, path.join(UPLOAD_FILES_DIR, 'test.pdf'));
    await waitForFileAccepted(uploadDocs.fieldUploadedFiles(uploadDocs.generalDocsSection, label), 'test.pdf');
    const alerts = await uploadDocs.fieldAlerts(uploadDocs.generalDocsSection, label).innerText().catch(() => '');
    console.log('TC_76 alerts:', JSON.stringify(alerts));
    expect(alerts.trim()).toBe('');
  });

  // Excel TC_77 - "PAN Card" slot.
  test('TC_77: Verify a valid PNG file is accepted for a General Document slot', async () => {
    const label = 'PAN Card';
    await uploadDocs.uploadInto(uploadDocs.generalDocsSection, label, path.join(UPLOAD_FILES_DIR, 'salarySlip.png'));
    await waitForFileAccepted(uploadDocs.fieldUploadedFiles(uploadDocs.generalDocsSection, label), 'salarySlip.png');
    const alerts = await uploadDocs.fieldAlerts(uploadDocs.generalDocsSection, label).innerText().catch(() => '');
    console.log('TC_77 alerts:', JSON.stringify(alerts));
    expect(alerts.trim()).toBe('');
  });

  // Excel TC_78 - "Latest Photo" slot. exactly5mb.jpg genuinely takes
  // longer to upload/render than a small file (confirmed live), hence the
  // longer poll timeout in waitForFileAccepted()'s default.
  test('TC_78: Verify a file exactly at the 5 MB size limit is accepted', async () => {
    const label = 'Latest Photo (Passport size)';
    await uploadDocs.uploadInto(uploadDocs.generalDocsSection, label, path.join(UPLOAD_FILES_DIR, 'exactly5mb.jpg'));
    await waitForFileAccepted(uploadDocs.fieldUploadedFiles(uploadDocs.generalDocsSection, label), 'exactly5mb.jpg');
    const alerts = await uploadDocs.fieldAlerts(uploadDocs.generalDocsSection, label).innerText().catch(() => '');
    console.log('TC_78 alerts:', JSON.stringify(alerts));
    expect(alerts.trim()).toBe('');
  });

  // Excel TC_79 - "UAN Profile" slot.
  test('TC_79: Verify a file over the 5 MB size limit is rejected', async () => {
    const label = 'UAN Profile';
    await uploadDocs.uploadInto(uploadDocs.generalDocsSection, label, path.join(UPLOAD_FILES_DIR, 'oversized.jpg'));
    await expect(uploadDocs.fieldAlerts(uploadDocs.generalDocsSection, label)).toContainText('The maximum file size is 5 MB.', { timeout: 10000 });
    const files = await uploadDocs.fieldUploadedFiles(uploadDocs.generalDocsSection, label).allTextContents();
    console.log('TC_79 files after rejected oversized upload:', JSON.stringify(files));
    expect(files).toEqual([]);
  });

  // Excel TC_80 - "10th" slot (Qualification Documents). Constructed
  // in-memory (buffer-based setInputFiles) rather than from a real file on
  // disk, per the user's explicit instruction - Windows itself cannot store
  // a 260+ character filename.
  test('TC_80: Verify a filename over 256 characters is rejected', async () => {
    const label = '10th';
    const longName = `${'A'.repeat(260)}.jpg`;
    const buffer = require('fs').readFileSync(path.join(UPLOAD_FILES_DIR, 'samplepic.jpg'));
    await uploadDocs.uploadInto(uploadDocs.qualificationDocsSection, label, { name: longName, mimeType: 'image/jpeg', buffer });
    await expect(uploadDocs.dialog).toBeVisible({ timeout: 10000 });
    const text = await uploadDocs.dialogText();
    console.log('TC_80 dialog text:', JSON.stringify(text));
    expect(text).toContain('Information');
    expect(text).toContain(`${longName} Document is not uploaded as file name is too big`);
    await uploadDocs.dismissDialog();
    const files = await uploadDocs.fieldUploadedFiles(uploadDocs.qualificationDocsSection, label).allTextContents();
    console.log('TC_80 files after rejected long filename:', JSON.stringify(files));
    expect(files).toEqual([]);
  });

  // Excel TC_81 - "12th" slot.
  test('TC_81: Verify a 2nd valid file is accepted into the same document slot', async () => {
    const label = '12th';
    const files = uploadDocs.fieldUploadedFiles(uploadDocs.qualificationDocsSection, label);
    await uploadDocs.uploadInto(uploadDocs.qualificationDocsSection, label, path.join(UPLOAD_FILES_DIR, 'Aadhar.jpg'));
    await waitForFileAccepted(files, 'Aadhar.jpg');
    await uploadDocs.uploadInto(uploadDocs.qualificationDocsSection, label, path.join(UPLOAD_FILES_DIR, 'Aadhar2.jpg'));
    await waitForFileAccepted(files, 'Aadhar2.jpg');
    const finalFiles = await files.allTextContents();
    console.log('TC_81 files:', JSON.stringify(finalFiles));
    expect(finalFiles).toEqual(['Aadhar.jpg', 'Aadhar2.jpg']);
  });

  // Excel TC_82 - "Highest Qualification" slot, self-contained (fills it to
  // 2 itself rather than depending on TC_81 having already run first).
  test('TC_82: Verify a document slot no longer accepts a 3rd file once it already holds 2', async () => {
    const label = 'Highest Qualification (Upload any one of Degree/Provisional Degree Certificate/Final Year Marksheet)';
    const files = uploadDocs.fieldUploadedFiles(uploadDocs.qualificationDocsSection, label);
    await uploadDocs.uploadInto(uploadDocs.qualificationDocsSection, label, path.join(UPLOAD_FILES_DIR, 'bsc.jpg'));
    await waitForFileAccepted(files, 'bsc.jpg');
    await uploadDocs.uploadInto(uploadDocs.qualificationDocsSection, label, path.join(UPLOAD_FILES_DIR, 'experience.jpg'));
    await waitForFileAccepted(files, 'experience.jpg');
    await expect(uploadDocs.fieldFileInput(uploadDocs.qualificationDocsSection, label), 'Choose File control gone at the 2-file cap').toHaveCount(0);
  });
});

// Excel TC_83 - Experience Documents (`divorced`, experienced=Yes only -
// `fresherUploads` has no Experience Documents section at all). Its
// Experience slot already carries 1 file (12.jpg) from earlier
// manual/automated probing (see batch 1's own note on pre-existing state),
// so this reads the current count first and uploads only as many MORE
// distinct files as needed to reach exactly 10 - self-correcting even if a
// prior partial/failed run already added some.
test.describe('Phase 2 - 2. Upload Documents - Experience Documents 10-file cap', () => {
  test('TC_83: Verify the Experience Documents field allows up to 10 files, not the standard 2-file limit', async () => {
    test.setTimeout(180000);
    const { bf, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.divorced);
    try {
      const label = 'Upload any one: Three months salary slip / Last CTC letter / Promotion or Increment letter';
      const files = uploadDocs.fieldUploadedFiles(uploadDocs.experienceDocsSection, label);
      const before = await files.count();
      console.log('TC_83 Experience Documents file count before:', before);
      const fillers = ['Aadhar.jpg', 'Pancard.jpg', 'samplepic.jpg', 'cheque.jpg', 'uan.jpg', '10.jpg', 'bsc.jpg', 'experience.jpg', 'test.pdf', 'salarySlip.png'];
      const toAdd = Math.max(0, 10 - before);
      for (let i = 0; i < toAdd; i++) {
        await uploadDocs.uploadInto(uploadDocs.experienceDocsSection, label, path.join(UPLOAD_FILES_DIR, fillers[i]));
        await expect(files, `after upload ${i + 1} of ${toAdd}`).toHaveCount(before + i + 1, { timeout: 20000 });
      }
      const finalCount = await files.count();
      console.log('TC_83 Experience Documents file count after filling to cap:', finalCount);
      expect(finalCount).toBe(10);
      await expect(uploadDocs.fieldFileInput(uploadDocs.experienceDocsSection, label), 'Choose File control gone at the 10-file cap').toHaveCount(0);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_84 - consent left unchecked (default), Submit clicked anyway.
test.describe('Phase 2 - 2. Upload Documents - Submit blocked without consent', () => {
  test('TC_84: Verify Submit is blocked when the consent checkbox is unchecked, regardless of document upload state', async () => {
    const { bf, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.fresherUploads);
    try {
      await expect(uploadDocs.consentCheckbox).not.toBeChecked();
      await uploadDocs.submitBtn.click();
      await expect(uploadDocs.dialog).toBeVisible({ timeout: 10000 });
      const text = await uploadDocs.dialogText();
      console.log('TC_84 dialog text:', JSON.stringify(text));
      expect(text).toContain('Information');
      expect(text).toContain('Please accept confirmation to proceed with the application');
      await uploadDocs.dismissDialog();
      // Still on Upload Documents - didn't navigate away/submit for real.
      await expect(uploadDocs.generalDocsSection).toBeVisible();
      await expect(uploadDocs.consentCheckbox).not.toBeChecked();
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_91 - deferred: simulating a genuinely browser-trusted drag-and-
// drop gesture didn't register on this React-based widget via a synthetic
// DOM event; needs a lower-level Chrome DevTools Protocol approach, not yet
// implemented. STANDING CONVENTION (2026-09-28): whenever a test case is
// left Pending in Excel with a documented reason, add/update a matching
// test.skip(true, '<same reason>') stub so Excel and the dashboard/report
// always stay in sync - see project_context.md.
test.describe('Phase 2 - 2. Upload Documents - drag-and-drop upload', () => {
  test('TC_91: Verify a file can be uploaded via drag-and-drop, not just "Choose File"', async () => {
    test.skip(true, "Blocked: drag-and-drop needs a genuinely browser-trusted drag gesture, which a synthetic DOM event can't reliably simulate - needs a lower-level Chrome DevTools Protocol approach, not yet implemented.");
  });
});

// ---- 2. Upload Documents - Submit / remove-file / defect / dependents /
// navigation (TC_85, TC_87-90, TC_92-96), batch 3, added 2026-09-28. Every
// one of these was already exercised live via scratch probes earlier today
// (results already recorded in the Excel workbook) - this batch is the
// permanent, re-runnable version of that same, already-proven logic, built
// on newUploadDocumentsSession()/fillAllEmptySlots()/yesButton/noButton/
// fieldRemoveButton (pages/Candidate/Phase2OtherDetails.js). TC_86 (P1
// defect, already recorded) is NOT in this batch - out of scope per the
// instruction that started this batch.
//
// `fresherUploads` and `divorced` both carry real accumulated document
// uploads from today's live probing (confirmed live 2026-09-28 - e.g.
// `divorced`'s "UAN Profile" already held a "fake-scan.jpg" from an earlier
// manual TC_92 probe, and `fresherUploads`'s General Documents fields are
// mostly at their 2-file cap already). Rather than assume either account
// starts from a clean/empty slate, every test below that needs a genuinely
// EMPTY mandatory field but does NOT check consent (TC_90/92/95) drives it
// there itself via emptyGeneralDocField() - safely re-runnable regardless of
// how much state earlier runs (of this batch or of today's manual probing)
// already left behind. Any test that DOES check consent (TC_85/87/88/96)
// uses newDisposableUploadDocumentsSession() instead, never a pooled
// account - see that function's own comment for why (the consent checkbox
// turned out to be a ONE-WAY LATCH per account, confirmed live 2026-09-28:
// this is what first broke the pre-existing TC_84 before `fresherUploads`
// itself was replaced with a clean account - see
// utils/Phase2TestCandidates.js's own updated comment on that entry).
//
// fillAllEmptySlots() itself was corrected during this batch's own live
// verification: it originally scanned '.documentsborder' as the atomic
// "one field" unit, which is correct for General/Qualification/Experience
// Documents (exactly one documentsborder per field, confirmed live) but
// WRONG for Dependent Documents, where "Aadhaar Card" and "Photo" share ONE
// documentsborder wrapping two separate '.row.documentchoosefilemargin'
// rows - the container-level scan filled only whichever of the two came
// first and then, seeing the shared container "already had a file", skipped
// the other entirely, leaving a stuck "Please upload all documents" popup
// even on an apparently fully-filled form. Fixed to scan at the row level
// instead - see that method's own comment.

// Empties a General Documents field by removing every file currently in it
// (its own Yes/No-style confirm per removal, reusing yesButton - confirmed
// live 2026-09-28, see TC_90) - guarantees a genuinely empty, mandatory slot
// to act on regardless of what an earlier run of this suite (or today's
// manual probing) already left in the account.
async function emptyGeneralDocField(uploadDocs, bf, label) {
  const files = uploadDocs.fieldUploadedFiles(uploadDocs.generalDocsSection, label);
  for (let guard = 0; guard < 5 && (await files.count()) > 0; guard++) {
    await uploadDocs.fieldRemoveButton(uploadDocs.generalDocsSection, label).last().click();
    await expect(uploadDocs.yesButton).toBeVisible({ timeout: 10000 });
    await uploadDocs.yesButton.click();
    await settle(bf, { timeout: 6000 });
  }
  await expect(files, `"${label}" must be empty before this test acts on it`).toHaveCount(0);
  return files;
}

// Builds one fresh, disposable account and drives it (signup -> Phase 1 ->
// Continue to Phase 2 -> a fully-valid Other Details Next, same shape as
// TC_72/TC_89's own inline flow) to "2. Upload Documents" with every
// document slot genuinely empty. Added once this batch's own live
// verification found the consent checkbox is a ONE-WAY latch per account:
// checking it and later trying to uncheck it again - even followed by an
// unchecked Submit click + dialog dismiss, to force a real round trip -
// does NOT persist back to false on a fresh sign-in (confirmed live
// 2026-09-28). Checking it on a REUSED pooled account therefore
// PERMANENTLY breaks any test elsewhere that assumes consent starts
// unchecked (this is exactly what first broke the pre-existing TC_84 when
// TC_85/87/88/96 below were first written against `fresherUploads`). Any
// test that needs to check this box uses this fresh-account helper instead
// - the same "would permanently alter reusable state" escape hatch TC_72/
// TC_89 already use in this file, and it has a side benefit here too: a
// genuinely fresh account starts with every slot empty, so TC_85 no longer
// needs emptyGeneralDocField() to manufacture a missing-document state.
async function newDisposableUploadDocumentsSession() {
  const aadhaar = getRandomAadhar();
  const bf = new BrowserFactory();
  await bf.launchBrowser(config.CANDIDATE_URL);

  await signupAndReachPhase1(bf, aadhaar);
  const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
  await fillValidPersonalDetails(itapPage1, bf, { maritalStatus: 'Single' });
  await itapPage1.click_NextBtn();
  await bf.hardWait(2);

  const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
  await fillValidQualification(itapPage2, bf);
  await itapPage2.click_NextBtn();
  await bf.hardWait(2);

  const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
  await itapPage3.fill_Experienced(bf.hardWait.bind(bf));
  await bf.hardWait(2);

  const legacyPhase2 = new ITAP_ContinueToPhase2Page(bf.page);
  await legacyPhase2.Extract_itap_number();
  await bf.hardWait(1);
  await legacyPhase2.click_continueToPhase2Btn();
  await bf.hardWait(2);

  const otherDetails = new ITAP_Phase2OtherDetailsPage(bf.page);
  await otherDetails.selectByLabel(otherDetails.bloodGroup, 'A+');
  await otherDetails.selectByLabel(otherDetails.religion, 'Hinduism');
  await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
  await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
  await otherDetails.dependentNominees.nth(0).check();
  await otherDetails.memberPFRadios.nth(1).check();
  await settle(bf);
  await otherDetails.uanNumber.fill('876578765432');
  await otherDetails.uanNumber.press('Tab');
  await otherDetails.fillEmergencyRow(0, { name: 'Ravi Kumar', relation: 'Brother', contact1: '9876543210' });
  await otherDetails.fillEmergencyRow(1, { name: 'Sunita Devi', relation: 'Sister', contact1: '9876543211' });
  await settle(bf);

  const nextMessages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
  const uploadDocs = new ITAP_Phase2UploadDocumentsPage(bf.page);
  await uploadDocs.generalDocsSection.waitFor({ state: 'visible', timeout: 20000 });
  return {
    bf, otherDetails, uploadDocs, nextMessages, aadhaar,
  };
}

// Excel TC_85 - fresh disposable account (see newDisposableUploadDocumentsSession()
// above) starts with every document slot genuinely empty, so the
// missing-mandatory-document Submit is reproducible with no setup beyond
// checking consent.
test.describe('Phase 2 - 2. Upload Documents - Submit blocked when documents missing', () => {
  test('TC_85: Verify Submit is blocked when consent is checked but mandatory documents are missing', async () => {
    test.setTimeout(180000);
    const { bf, uploadDocs } = await newDisposableUploadDocumentsSession();
    try {
      await uploadDocs.consentCheckbox.check();
      await expect(uploadDocs.consentCheckbox).toBeChecked();
      await uploadDocs.submitBtn.click();
      await expect(uploadDocs.dialog).toBeVisible({ timeout: 15000 });
      const text = await uploadDocs.dialogText();
      console.log('TC_85 dialog text:', JSON.stringify(text));
      expect(text).toContain('Please upload all documents');
      await uploadDocs.dismissDialog();
      // Still on Upload Documents - didn't navigate away/submit for real.
      await expect(uploadDocs.generalDocsSection).toBeVisible();
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_87
test.describe('Phase 2 - 2. Upload Documents - Submit confirmation dialog', () => {
  test('TC_87: Verify the Submit confirmation dialog appears once every mandatory document is uploaded and consent is checked', async () => {
    test.setTimeout(180000);
    const { bf, uploadDocs } = await newDisposableUploadDocumentsSession();
    try {
      await uploadDocs.fillAllEmptySlots();
      await uploadDocs.consentCheckbox.check();
      await expect(uploadDocs.consentCheckbox).toBeChecked();
      await uploadDocs.submitBtn.click();

      await expect(bf.page.getByText(/Are you sure you want to submit\?/i), 'the real Submit confirmation text').toBeVisible({ timeout: 15000 });
      await expect(uploadDocs.yesButton).toBeVisible();
      // Deliberately does NOT click Yes - this only proves the happy path
      // (a fully valid form + checked consent) is reachable, not that a
      // real submission completes (see TC_89 for that, gated behind
      // test.skip()). This is a disposable, one-time account, so there's no
      // need to click No/uncheck or otherwise clean up afterward.
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_88
test.describe('Phase 2 - 2. Upload Documents - Cancel Submit confirmation', () => {
  test('TC_88: Verify clicking "No" on the Submit confirmation dialog cancels safely without submitting', async () => {
    test.setTimeout(180000);
    const { bf, uploadDocs } = await newDisposableUploadDocumentsSession();
    try {
      await uploadDocs.fillAllEmptySlots();
      await uploadDocs.consentCheckbox.check();
      await uploadDocs.submitBtn.click();
      await expect(uploadDocs.yesButton).toBeVisible({ timeout: 15000 });

      await uploadDocs.noButton.click();
      await settle(bf);

      // Still on Upload Documents - Submit was cancelled, not completed.
      await expect(uploadDocs.generalDocsSection).toBeVisible();
      await expect(bf.page.getByText('Click to Upload General Documents')).toBeVisible();
      // The files fillAllEmptySlots() just uploaded (or found already
      // there) are still present, not wiped out by the cancel.
      const panFiles = await uploadDocs.fieldUploadedFiles(uploadDocs.generalDocsSection, 'PAN Card').count();
      console.log('TC_88 PAN Card files still present after cancel:', panFiles);
      expect(panFiles).toBeGreaterThan(0);
    } finally {
      // Disposable, one-time account - no cleanup needed.
      await bf.closeBrowser();
    }
  });
});

// Excel TC_90 - "Aadhaar Card" emptied first (same reasoning as TC_85), so
// the before(0)/after-upload(1)/after-remove(0) sequence the Excel step
// describes is reproducible regardless of prior state.
test.describe('Phase 2 - 2. Upload Documents - remove an uploaded file', () => {
  test('TC_90: Verify removing an already-uploaded file works', async () => {
    test.setTimeout(120000);
    const { bf, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.fresherUploads);
    try {
      const label = 'Aadhaar Card (Both the front and back of card)';
      const files = await emptyGeneralDocField(uploadDocs, bf, label);

      await uploadDocs.uploadInto(uploadDocs.generalDocsSection, label, path.join(UPLOAD_FILES_DIR, 'samplepic.jpg'));
      await waitForFileAccepted(files, 'samplepic.jpg');
      await expect(files).toHaveCount(1);

      await uploadDocs.fieldRemoveButton(uploadDocs.generalDocsSection, label).first().click();
      // Confirmed live: removing a file shows its own Yes/No-style confirm
      // (the same widget as the real Submit confirmation - TC_87/88).
      await expect(uploadDocs.yesButton).toBeVisible({ timeout: 10000 });
      await uploadDocs.yesButton.click();
      await settle(bf, { timeout: 6000 });

      await expect(files, 'back to 0 files after removal').toHaveCount(0, { timeout: 10000 });
      await expect(uploadDocs.fieldFileInput(uploadDocs.generalDocsSection, label), 'Choose File control available again').toHaveCount(1);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_92 - KNOWN DEFECT (confirmed live 2026-09-28, Excel Priority P2):
// the app currently ACCEPTS a file whose declared name/MIME type
// ("image/jpeg") does not match its actual content (plain text) - confirmed
// directly live on this same account: `divorced`'s "UAN Profile" already
// held a "fake-scan.jpg" from an earlier manual probe of this exact defect,
// well before this test existed. Per this project's established convention
// (project_context.md: "Known-failing/defect test cases should assert the
// CORRECT expected behavior... never assert the buggy behavior just to make
// the test pass, which would hide the defect"), this test asserts the
// CORRECT behavior - the spoofed file must be REJECTED (0 files accepted) -
// so it stays genuinely RED until the real defect is fixed. A passing run
// here would mean the defect was fixed, not that this test is broken.
test.describe('Phase 2 - 2. Upload Documents - content/MIME spoofing (known defect)', () => {
  test('TC_92: Verify a file whose content/MIME type does not match its declared type is rejected', async () => {
    test.setTimeout(120000);
    const { bf, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.divorced);
    try {
      const label = 'Aadhaar Card (Both the front and back of card)';
      const files = await emptyGeneralDocField(uploadDocs, bf, label);

      const spoofed = { name: 'fake-scan.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a real image, just plain text') };
      await uploadDocs.uploadInto(uploadDocs.generalDocsSection, label, spoofed);
      // A plain settle(bf) isn't enough here - live-verified during this
      // batch that the accept/reject decision for a content-mismatched file
      // resolves asynchronously without a DOM mutation settle() can reliably
      // catch (an early check intermittently read a false "rejected" that a
      // longer wait then showed was really still pending, ending in
      // "accepted" every time once fully settled).
      await bf.page.waitForTimeout(8000);
      const accepted = await files.allTextContents();
      console.log('TC_92 files after spoofed upload:', JSON.stringify(accepted));
      // CORRECT/expected behavior - a content-mismatched file must be
      // rejected. Confirmed live 2026-09-28 this currently FAILS (the app
      // accepts it) - that is the documented defect, not a bug in this test.
      await expect(files, 'a content/MIME-mismatched file must be rejected').toHaveCount(0);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_93 - `divorced` may already carry 3+ dependents from today's live
// probing (Father, Mother, and "Rohan Verma"/Brother, added earlier) -
// written idempotently so it never keeps growing the account no matter how
// many times it runs.
test.describe('Phase 2 - 2. Upload Documents - Dependent Documents for a manually-added dependent', () => {
  test('TC_93: Verify a manually-added, non-deceased dependent also gets its own Upload Documents block', async () => {
    test.setTimeout(180000);
    const { bf, otherDetails } = await newPooledPhase2Session(phase2Candidates.divorced);
    try {
      let count = await otherDetails.dependentNames.count();
      let extraIndex = 1;
      while (count < 3) {
        const row = await otherDetails.addDependent(settle, bf);
        await otherDetails.fillDependentRow(row, { name: `Extra Member ${extraIndex}`, relation: 'Sister', dob: '15/08/1998' });
        extraIndex += 1;
        await settle(bf);
        count = await otherDetails.dependentNames.count();
      }
      console.log('TC_93 dependent count before Next:', count);

      const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      console.log('TC_93 validation messages after Next:', JSON.stringify(messages));
      expect(messages, "the account's existing Other Details data is already valid").toEqual([]);
      await expect(otherDetails.bloodGroup, 'left Other Details').toHaveCount(0);

      const uploadDocs = new ITAP_Phase2UploadDocumentsPage(bf.page);
      const headings = await uploadDocs.dependentDocHeadings.allTextContents();
      console.log('TC_93 dependent doc headings:', JSON.stringify(headings));
      expect(headings.length).toBeGreaterThanOrEqual(3);
      for (const heading of headings) expect(heading).toMatch(/'s Documents$/);
      expect(await uploadDocs.dependentDocBlocks.count()).toBe(headings.length);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_94 - CORRECTED during this batch's own live verification: the
// original premise ("no way to navigate back") was based on an earlier,
// incomplete check that only tried the step LABEL, not the step CIRCLE.
// Live-confirmed 2026-09-28 with a completely normal (non-forced) click -
// the circle is `role="button"`, `cursor:pointer`, fully visible and
// enabled, no force needed - that clicking the "Other Details" step CIRCLE
// genuinely navigates back from Upload Documents to Other Details. This is
// an established, intentional feature of the step indicator throughout this
// whole app (the same pattern Phase 1's own step indicator relies on), not
// a defect - so this test now asserts the real, correct behavior: the step
// LABEL text is inert (clicking it does nothing), but the step CIRCLE does
// navigate back, and there is still no dedicated "Back" BUTTON anywhere on
// the page (a distinct, separate claim from whether the circle itself is
// clickable).
test.describe('Phase 2 - 2. Upload Documents - step indicator back navigation', () => {
  test('TC_94: Verify the "Other Details" step circle (not the step label) navigates back from Upload Documents, with no dedicated "Back" button', async () => {
    const { bf, otherDetails, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.divorced);
    try {
      await expect(uploadDocs.generalDocsSection).toBeVisible();

      // The step LABEL text itself is inert.
      await otherDetails.stepLabel('Other Details').click({ force: true }).catch(() => {});
      await settle(bf);
      await expect(uploadDocs.generalDocsSection, 'still on Upload Documents after clicking the step label').toBeVisible();

      // No dedicated "Back" button exists anywhere on the page.
      const backBtn = bf.page.getByRole('button', { name: /back/i });
      console.log('TC_94 Back button count:', await backBtn.count());
      await expect(backBtn).toHaveCount(0);

      // The step CIRCLE, clicked normally (no force needed - it is a real,
      // enabled, pointer-cursor button), genuinely navigates back.
      await expect(otherDetails.stepCircle('Other Details')).toBeEnabled();
      await otherDetails.stepCircle('Other Details').click();
      await settle(bf);
      await expect(otherDetails.bloodGroup, 'navigated back to Other Details').toBeVisible();
      await expect(uploadDocs.generalDocsSection, 'no longer on Upload Documents').toHaveCount(0);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_95 - "Aadhaar Card" emptied first, then given exactly one file, so
// the reload's effect is unambiguous either way.
test.describe('Phase 2 - 2. Upload Documents - reload loses unsaved state', () => {
  test('TC_95: Verify reloading Upload Documents loses unsaved (not-yet-submitted) state', async () => {
    test.setTimeout(120000);
    const { bf, uploadDocs } = await newUploadDocumentsSession(phase2Candidates.fresherUploads);
    try {
      const label = 'Aadhaar Card (Both the front and back of card)';
      const files = await emptyGeneralDocField(uploadDocs, bf, label);
      await uploadDocs.uploadInto(uploadDocs.generalDocsSection, label, path.join(UPLOAD_FILES_DIR, 'samplepic.jpg'));
      await waitForFileAccepted(files, 'samplepic.jpg');

      await bf.page.reload();
      await bf.page.waitForTimeout(5000);
      await settle(bf, { timeout: 8000 });

      const uploadPromptCount = await bf.page.locator('text=/Click to Upload/').count();
      console.log('TC_95 "Click to Upload" occurrences after reload:', uploadPromptCount);
      // Confirmed live: a reload re-derives from the last SAVED state, which
      // for an already-Other-Details-complete account is Other Details
      // itself, not a half-populated Upload Documents page.
      expect(uploadPromptCount).toBe(0);
    } finally {
      await bf.closeBrowser();
    }
  });
});

// Excel TC_96 - uses a fresh disposable account, same as TC_85/87/88, since
// it checks consent (a one-way latch per account - see
// newDisposableUploadDocumentsSession()'s own comment).
test.describe('Phase 2 - 2. Upload Documents - double-click Submit', () => {
  test('TC_96: Verify double-clicking Submit does not cause a doubled confirmation/submission', async () => {
    test.setTimeout(180000);
    const { bf, uploadDocs } = await newDisposableUploadDocumentsSession();
    try {
      await uploadDocs.fillAllEmptySlots();
      await uploadDocs.consentCheckbox.check();
      await expect(uploadDocs.consentCheckbox).toBeChecked();

      await Promise.all([uploadDocs.submitBtn.click(), uploadDocs.submitBtn.click()]);
      await expect(uploadDocs.yesButton).toBeVisible({ timeout: 15000 });
      const count = await uploadDocs.yesButton.count();
      console.log('TC_96 yesButton count after double-click:', count);
      expect(count).toBe(1);

      await uploadDocs.noButton.click();
      await settle(bf);
    } finally {
      // Disposable, one-time account - no cleanup needed.
      await bf.closeBrowser();
    }
  });
});

// Excel TC_89 - NOT run automatically: creates a real disposable account and
// performs a genuine, irreversible submission every time it executes (same
// category of risk as TC_16/TC_49/TC_91's existing skip stubs, but here the
// reason is "too risky to run automatically", not "blocked"). Verified live
// 2026-09-28 with the skip line temporarily commented out - the flow below
// genuinely completes a real submission end-to-end (reached "Application
// Submitted"). Put the skip back before finishing; un-skip manually only
// when deliberately re-verifying this exact path.
test.describe('Phase 2 - 2. Upload Documents - real Submit (disposable account)', () => {
  test('TC_89: Verify a fully valid Upload Documents submission completes the application', async () => {
    test.skip(true, 'Not run automatically - creates a real disposable account and completes a genuine, irreversible submission every run. Un-skip manually only when deliberately re-verifying this exact path.');
    test.setTimeout(300000);
    const aadhaar = getRandomAadhar();
    console.log('TC_89 new dedicated account Aadhaar:', aadhaar);

    const bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    try {
      // -- Signup -> Phase 1 (Personal/Qualification/Experience, valid) --
      await signupAndReachPhase1(bf, aadhaar);

      const itapPage1 = new ITAPInterviewPerformaPage(bf.page);
      await fillValidPersonalDetails(itapPage1, bf, { maritalStatus: 'Single' });
      await itapPage1.click_NextBtn();
      await bf.hardWait(2);

      const itapPage2 = new ITAP_QualificationDetailsPage(bf.page);
      await fillValidQualification(itapPage2, bf);
      await itapPage2.click_NextBtn();
      await bf.hardWait(2);

      const itapPage3 = new ITAP_ExperienceDetailPage(bf.page);
      await itapPage3.fill_Experienced(bf.hardWait.bind(bf));
      await bf.hardWait(2);

      const legacyPhase2 = new ITAP_ContinueToPhase2Page(bf.page);
      const itapNumber = await legacyPhase2.Extract_itap_number();
      console.log('TC_89 new account ITAP number:', itapNumber);
      await bf.hardWait(1);
      await legacyPhase2.click_continueToPhase2Btn();
      await bf.hardWait(2);

      // -- "1. Other Details", fully valid --
      const otherDetails = new ITAP_Phase2OtherDetailsPage(bf.page);
      await otherDetails.selectByLabel(otherDetails.bloodGroup, 'A+');
      await otherDetails.selectByLabel(otherDetails.religion, 'Hinduism');
      await otherDetails.fillDate(otherDetails.dependentDOBs.nth(0), '15/08/1965');
      await otherDetails.fillDate(otherDetails.dependentDOBs.nth(1), '15/08/1970');
      await otherDetails.dependentNominees.nth(0).check();
      await otherDetails.memberPFRadios.nth(1).check();
      await settle(bf);
      await otherDetails.uanNumber.fill('876578765432');
      await otherDetails.uanNumber.press('Tab');
      await otherDetails.fillEmergencyRow(0, { name: 'Ravi Kumar', relation: 'Brother', contact1: '9876543210' });
      await otherDetails.fillEmergencyRow(1, { name: 'Sunita Devi', relation: 'Sister', contact1: '9876543211' });
      await settle(bf);

      const messages = await otherDetails.clickNextAndGetValidationMessages(settle, bf);
      console.log('TC_89 validation messages after Next:', JSON.stringify(messages));
      expect(messages, 'no validation message on a fully valid form').toEqual([]);
      await expect(otherDetails.bloodGroup, 'left Other Details').toHaveCount(0);

      // -- "2. Upload Documents" --
      const uploadDocs = new ITAP_Phase2UploadDocumentsPage(bf.page);
      await uploadDocs.generalDocsSection.waitFor({ state: 'visible', timeout: 20000 });
      await uploadDocs.fillAllEmptySlots();
      await uploadDocs.consentCheckbox.check();
      await expect(uploadDocs.consentCheckbox).toBeChecked();
      await uploadDocs.submitBtn.click();
      await expect(uploadDocs.yesButton).toBeVisible({ timeout: 20000 });
      // Confirmed live 2026-09-28: clicking Yes too fast (right on
      // visibility) failed once - an extra settle-time buffer fixes it.
      await bf.page.waitForTimeout(800);
      await uploadDocs.yesButton.click();

      await bf.page.getByText('Application Submitted').waitFor({ state: 'visible', timeout: 20000 });
      await expect(bf.page.getByText('Application Submitted')).toBeVisible();
      const bodyText = await bf.page.locator('body').innerText();
      console.log('TC_89 post-submit body text (truncated):', bodyText.slice(0, 400));
      expect(bodyText).toContain('Congratulations! Your additional details have been submitted.');
    } finally {
      await bf.closeBrowser();
    }
  });
});
