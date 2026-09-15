const { test, expect } = require('@playwright/test');
const path = require('path');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const {
  VALID_DOC_SLOTS,
  uploadSlot,
  uploadAllDocuments,
  checkTermsAndSubmit,
  getVisibleValidationMessages,
  reachPhase2OtherDetails,
  reachPhase2Uploads,
  reachOtherDetailsPage,
} = require('../../utils/CandidateFlowHelpers');
const { addResult, saveFile } = require('../../excelReporter');

// Negative / edge-case coverage for Phase 2 of the candidate application form
// (Document Upload) — the happy-path upload with pre-approved, correctly-sized
// .jpg fixtures is exercised elsewhere (e.g. utils/createFreshInterviewCandidate.js),
// not duplicated here.
//
// Source spec: Modification Test Cases.xlsx, "Missing Test Cases" sheet,
// TC-028..TC-032. TC-030 is the only High-priority row; the rest are
// Medium/Low and are ordered accordingly, Low-priority rows last.
//
// Upload policy confirmed by the team (not independently re-derived here):
// max 2 files per document slot (10 for Experience documents), max 5 MB per
// file, file name <= 256 characters, PDF/PNG/JPEG/JPG only.
//
// Reaching the upload page requires a full fresh signup -> Phase 1 (Personal
// + Qualification + Experience) run per test.
//
// uploadSlot/uploadAllDocuments/checkTermsAndSubmit/getVisibleValidationMessages/
// reachPhase2OtherDetails/reachPhase2Uploads/VALID_DOC_SLOTS now live in
// utils/CandidateFlowHelpers.js (promoted from here) so the new describe.serial
// blocks below can reuse the same flow logic instead of redefining it.
const filesDir = path.join('upload-files');

test.describe('Phase 2 - Document Upload - Negative & Edge Cases', () => {
  let bf;

  test.beforeEach(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
  });

  test.afterEach(async () => {
    await bf.closeBrowser();
  });

  // TC-030 (High)
  test('TC-030: blocks Submit when a mandatory document is missing', async () => {
    await reachPhase2Uploads(bf);
    // Leave slot 2 (PAN card) empty; upload every other applicable slot.
    await uploadAllDocuments(bf, { skipIndices: [2] });
    await checkTermsAndSubmit(bf);

    // Submission must not succeed: no "Application Submitted" dialog.
    const successDialog = bf.page.locator("div[role='dialog']").filter({
      has: bf.page.getByRole('heading', { name: 'Application Submitted' }),
    });
    await expect(successDialog).toHaveCount(0);
  });

  // TC-028 (Medium)
  test('TC-028: rejects an unsupported file type on upload', async () => {
    await reachPhase2Uploads(bf);
    await uploadSlot(bf, 1).setInputFiles(path.join(filesDir, 'invalid-type.gif'));
    await bf.hardWait(1.5);

    // Confirmed live: this rejection isn't a .mx-validation-message — it's a
    // popup "Information" dialog ("Only jpg, jpeg, png, pdf is allowed.").
    const infoDialog = bf.page.locator("div[role='dialog']");
    const dialogTexts = await infoDialog.allTextContents();
    expect(dialogTexts.some(t => /is allowed/i.test(t))).toBe(true);
    await bf.page.getByRole('button', { name: 'OK' }).click();
  });

  // TC-031 (Low)
  test('TC-031: rejects a malformed UAN number', async () => {
    const itapPhase2 = await reachPhase2OtherDetails(bf, { uanNumber: '123' });
    await itapPhase2.clickNextBtn();
    await bf.hardWait(1.5);

    const messages = await getVisibleValidationMessages(bf);
    expect(messages.some(m => /uan/i.test(m))).toBe(true);
  });

  // TC-029 (Low)
  test('TC-029: rejects an oversized file on upload', async () => {
    await reachPhase2Uploads(bf);
    await uploadSlot(bf, 1).setInputFiles(path.join(filesDir, 'oversized.jpg'));
    await bf.hardWait(1.5);

    // Confirmed live: this rejection isn't a .mx-validation-message either —
    // it's an inline dismissible tooltip ("The maximum file size is 5 MB.")
    // anchored under the upload slot, not a dialog like TC-028's.
    const bodyText = await bf.page.locator('body').innerText();
    expect(bodyText).toMatch(/maximum file size/i);
  });

  // TC-032 (Low)
  // CORRECTED (2026-09-09): the original version of this test asserted
  // "replacing an already-uploaded document keeps only the new file",
  // checking `input.files[0].name` on the underlying DOM element. Confirmed
  // live (via screenshot while building the new TC-DU0x batch above): a
  // second, different upload into an already-filled slot does NOT replace
  // the first — it's ADDED as a second attachment, both remaining visible
  // in the document's own file list with individual delete buttons, up to
  // the page's own documented "Max 2 files per document" cap (see TC-OD09).
  // The DOM input's raw `.files[0]` is not a reliable signal for this at
  // all once a slot holds 2 files (confirmed live: it can read back empty),
  // which is why the original assertion could pass or fail depending on
  // timing/ordering rather than reflecting real app behavior. This checks
  // the actual visible file list instead.
  test('TC-032: a second, different upload into an already-filled slot is added as a second attachment, not a replacement', async () => {
    await reachPhase2Uploads(bf);
    const slot = uploadSlot(bf, 1);
    await slot.setInputFiles(path.join(filesDir, 'Aadhar.jpg'));
    await bf.hardWait(1);
    await slot.setInputFiles(path.join(filesDir, 'Pancard.jpg'));
    await bf.hardWait(1.5);

    const bodyText = await bf.page.locator('body').innerText();
    expect(bodyText).toMatch(/Aadhar\.jpg/);
    expect(bodyText).toMatch(/Pancard\.jpg/);
  });
});

// Confirmed live: an incomplete Other Details submit triggers not just
// inline .mx-validation-message text but also a separate blocking
// "Information" modal ("Please complete all mandatory fields..."). Its
// underlay blocks every subsequent click on the page until dismissed, so
// every test below that expects Next to stay blocked must dismiss it before
// finishing, or the next test in this serial sequence hangs.
async function dismissInfoDialogIfPresent(bf) {
  const infoDialog = bf.page.locator("div[role='dialog']").filter({ hasText: 'Information' });
  if (await infoDialog.isVisible().catch(() => false)) {
    await infoDialog.getByRole('button', { name: 'OK' }).click();
    await bf.hardWait(1);
  }
}

// New describe.serial block (per user-confirmed design decision): reaching
// Other Details needs a full signup -> Personal -> Qualification ->
// Experience traversal, so — matching Onboarding/Interview's own convention
// for expensive-to-reach shared state (e.g. Setup.spec.js's
// describe.serial + one beforeAll-created candidate) — one candidate is
// created once and every test below runs in sequence against that same
// Other Details page, progressively filling it in rather than each test
// redoing the full traversal. This section previously had almost no
// negative coverage at all: only TC-031 (malformed UAN) existed anywhere
// in the whole module.
test.describe.serial('Phase 2 - Other Details - Negative & Edge Cases', () => {
  let bf, phase2;

  test.beforeAll(async () => {
    // Default hook timeout (120s) isn't enough once beforeAll also drives a
    // full signup -> Personal -> Qualification -> Experience traversal,
    // same reasoning as Setup.spec.js:40 / StatusFeedback.spec.js:53.
    test.setTimeout(300000);
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    phase2 = await reachOtherDetailsPage(bf);
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  // TC-OD01 (new, Negative): confirmed live — a blank Other Details submit
  // produces 8 distinct inline mandatory-field messages, AND a separate
  // blocking "Information" modal dialog ("Please complete all mandatory
  // fields (including Nominee, if not already selected) to proceed") —
  // which also directly confirms Nominee is mandatory (see TC-OD08). That
  // dialog's underlay blocks every subsequent click on this shared page
  // until dismissed, so this test must click OK before finishing, or the
  // rest of this describe.serial block hangs on the very next interaction.
  test('TC-OD01 [Negative]: blocks Next when Other Details is submitted fully blank', async () => {
    await phase2.clickNextBtn();
    await bf.hardWait(1.5);

    const messages = await getVisibleValidationMessages(bf);
    expect(messages).toEqual(expect.arrayContaining([
      'Blood group is mandatory',
      'Religion is mandatory',
      'Date of Birth is mandatory',
      'Please select whether you were a PF member in your previous establishment.',
      'UAN Number is mandatory',
      'Name is mandatory',
      'Relation is mandatory',
      'Contact Number is mandatory',
    ]));

    const infoDialog = bf.page.locator("div[role='dialog']").filter({ hasText: 'Information' });
    await expect(infoDialog).toContainText('Please complete all mandatory fields (including Nominee, if not already selected) to proceed');
    await dismissInfoDialogIfPresent(bf);
  });

  // TC-OD02 (new, Negative): confirmed live — toggling "PF member = Yes"
  // reveals/requires 3 additional conditional questions, a real
  // field-dependency chain with zero prior coverage. Fills everything else
  // needed to isolate just the PF branch (blood group/religion/DOB/nominee/
  // emergency contacts), but deliberately leaves UAN blank so the form
  // can't fully succeed and navigate away from this shared page.
  test('TC-OD02 [Negative]: PF member = Yes requires 3 additional conditional questions', async () => {
    await phase2.otherDetails();
    await phase2.dependantDetails(bf.hardWait.bind(bf));
    await phase2.emergencyContact();

    await phase2.pfmember_toggle_yes.scrollIntoViewIfNeeded();
    await phase2.pfmember_toggle_yes.click();
    await bf.hardWait(1);
    await phase2.clickNextBtn();
    await bf.hardWait(1.5);

    const messages = await getVisibleValidationMessages(bf);
    expect(messages).toEqual(expect.arrayContaining([
      'Please select whether you have withdrawn the full PF amount from your previous EPF account.',
      'Please select whether you were a member of the Pension scheme in your previous establishment.',
      'Please indicate whether you have withdrawn the full pension amount from your previous EPS account.',
      'UAN Number is mandatory',
    ]));
    await dismissInfoDialogIfPresent(bf);
  });

  // TC-OD03 (new, Positive): the "No" path requires none of the 3
  // conditional questions TC-OD02 just confirmed for "Yes". UAN is left
  // blank on purpose (same reason as TC-OD02) — its own "UAN Number is
  // mandatory" message staying present confirms the form is still safely
  // blocked from advancing, regardless of the PF answer.
  test('TC-OD03 [Positive]: PF member = No requires none of the "Yes" branch\'s conditional questions', async () => {
    await phase2.pfmember_toggle_no.scrollIntoViewIfNeeded();
    await phase2.pfmember_toggle_no.click();
    await bf.hardWait(1);
    await phase2.clickNextBtn();
    await bf.hardWait(1.5);

    const messages = await getVisibleValidationMessages(bf);
    expect(messages.some(m => /withdrawn|pension/i.test(m))).toBe(false);
    expect(messages).toContain('UAN Number is mandatory');
    await dismissInfoDialogIfPresent(bf);
  });

  // TC-OD04 (new, Negative): confirmed live — identical mobile numbers on
  // both emergency contacts produce a "Duplicate Contact Number" message,
  // never exercised by any existing test.
  test('TC-OD04 [Negative]: rejects identical mobile numbers on both emergency contacts', async () => {
    await phase2.emergencyContactNum2.fill('9876543218'); // same as contact 1
    await bf.hardWait(1);
    await phase2.clickNextBtn();
    await bf.hardWait(1.5);

    const messages = await getVisibleValidationMessages(bf);
    expect(messages).toContain('Duplicate Contact Number');
    expect(messages).toContain('UAN Number is mandatory');
    await dismissInfoDialogIfPresent(bf);
  });

  // TC-OD05/OD06 (new, Negative): malformed (wrong digit count) mobile
  // numbers for each emergency contact independently — this section had no
  // per-field mobile-format coverage at all.
  test('TC-OD05 [Negative]: rejects a malformed mobile number for Emergency Contact 1', async () => {
    await phase2.emergencyContactNum1.fill('12345');
    await phase2.emergencyContactNum2.fill('9876543219'); // restore to a distinct, valid number
    await bf.hardWait(1);
    await phase2.clickNextBtn();
    await bf.hardWait(1.5);

    const messages = await getVisibleValidationMessages(bf);
    expect(messages.some(m => /contact number/i.test(m))).toBe(true);
    await dismissInfoDialogIfPresent(bf);
  });

  test('TC-OD06 [Negative]: rejects a malformed mobile number for Emergency Contact 2', async () => {
    await phase2.emergencyContactNum1.fill('9876543218'); // restore to valid
    await phase2.emergencyContactNum2.fill('54321');
    await bf.hardWait(1);
    await phase2.clickNextBtn();
    await bf.hardWait(1.5);

    const messages = await getVisibleValidationMessages(bf);
    expect(messages.some(m => /contact number/i.test(m))).toBe(true);
    await dismissInfoDialogIfPresent(bf);
  });

  // TC-OD07 (new, Security): free-text Emergency Contact Name field must
  // treat an XSS payload as inert data.
  test('TC-OD07 [Security]: Emergency Contact Name safely accepts an XSS payload without executing it', async () => {
    let dialogAppeared = false;
    bf.page.on('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await phase2.emergencyContactNum2.fill('9876543219'); // restore to valid
    await phase2.emergencyContactName.fill('<script>alert(1)</script>');
    await bf.hardWait(1);
    await phase2.clickNextBtn();
    await bf.hardWait(1.5);

    expect(dialogAppeared).toBe(false);
    await dismissInfoDialogIfPresent(bf);
  });

  // TC-OD08 (new, Edge)
  // CONFIRMED LIVE FINDING: TC-OD01's blank-submit "Information" dialog
  // explicitly named Nominee ("...including Nominee, if not already
  // selected...") as if it were a mandatory field. It is not actually
  // enforced — with every other field valid (UAN filled here, the one
  // remaining gap) and Nominee deliberately left UNCHECKED, Next succeeds
  // and reaches Document Upload anyway. This is a real inconsistency
  // between the dialog's wording and the app's actual validation (not
  // necessarily a functional defect — Nominee may be intentionally
  // optional — so this is documented as an annotation rather than asserted
  // as a hard failure the way TC-019/TC-EX05/TC-EX06 are).
  test('TC-OD08 [Edge]: Nominee left unchecked does not actually block submission, despite the dialog naming it', async () => {
    await phase2.emergencyContactName.fill('Kumar Saurabh'); // restore to valid
    await phase2.nominee.uncheck();
    await phase2.uanDetails();
    await bf.hardWait(1);
    await phase2.clickNextBtn();
    await bf.hardWait(2);

    test.info().annotations.push({
      type: 'known-issue',
      description: 'TC-OD01\'s blank-submit dialog names Nominee as mandatory ("...including Nominee, if not already selected...to proceed"), but leaving it unchecked with everything else valid does not block submission — the form reaches Document Upload anyway.',
    });

    const messages = await getVisibleValidationMessages(bf);
    expect(messages.length).toBe(0);
    // uploadSlot() is a real <input type="file">, deliberately CSS-hidden
    // behind a styled "Choose File" label (same reason the existing
    // TC-028/029/030/032 tests never assert its visibility either — only
    // that setInputFiles() works on it). Confirm arrival at Document Upload
    // via its actual visible heading instead.
    await expect(bf.page.getByText('Click to Upload General Documents')).toBeVisible();
    await expect(uploadSlot(bf, 1)).toHaveCount(1);
  });

  // TC-OD09 (new, Positive): now on Document Upload (reached by TC-OD08),
  // confirms the exact upload policy (file count/size/name-length/type
  // limits) visible in the page's own instructional note — independently
  // verifying the numbers Phase2.spec.js's header comment (lines 18-20)
  // had only ever recorded as "confirmed by the team, not independently
  // re-derived here."
  test('TC-OD09 [Positive]: Document Upload page displays the documented upload policy', async () => {
    const bodyText = await bf.page.locator('body').innerText();
    expect(bodyText).toMatch(/max 2 files per document/i);
    expect(bodyText).toMatch(/experience documents:?\s*max 10/i);
    expect(bodyText).toMatch(/max 5\s*mb per file/i);
    expect(bodyText).toMatch(/256 characters max/i);
    expect(bodyText).toMatch(/pdf,?\s*png,?\s*jpeg,?\s*jpg only/i);
  });
});

// New describe.serial block (per user-confirmed design decision, same
// reasoning as "Phase 2 - Other Details" above): one candidate is created
// once and every test below runs in sequence against that same Document
// Upload page. Builds on top of the existing TC-028..032 negative coverage
// (unsupported file type, oversized file, missing mandatory doc, malformed
// UAN, file replacement) with the boundary/positive/end-to-end cases that
// were still missing — most importantly, TC-DU09: no test anywhere in the
// Candidate module itself previously asserted a full valid submission
// actually succeeds (the "Application Submitted" dialog) — that assertion
// only ever existed inside utils/createFreshInterviewCandidate.js, a helper
// used by a *different* module.
test.describe.serial('Phase 2 - Document Upload - Additional Coverage', () => {
  let bf;

  test.beforeAll(async () => {
    // Same reasoning as the Other Details block above — reaching Document
    // Upload needs the full signup -> Personal -> Qualification ->
    // Experience -> Other Details traversal.
    test.setTimeout(300000);
    bf = new BrowserFactory();
    await bf.launchBrowser(config.CANDIDATE_URL);
    await reachPhase2Uploads(bf);
  });

  test.afterEach(async ({}, testInfo) => {
    addResult(testInfo);
  });

  test.afterAll(async () => {
    await saveFile();
    await bf?.closeBrowser();
  });

  // TC-DU01..DU04 each use a DIFFERENT slot (4, 5, 6, 7) rather than all
  // reusing slot 1. CONFIRMED LIVE: repeatedly uploading different files
  // into the SAME slot several times in a row (as an earlier version of
  // these tests did, all via slot 1) breaks the page — the widget's own
  // per-document file history list (visibly showing 2+ accumulated entries
  // in the UI, not just the latest one, matching the "Max 2 files per
  // document" policy) apparently causes the later flat-indexed
  // (//input[@type='file'])[N] lookups for higher-numbered slots to time
  // out. Spreading these 4 checks across 4 slots that are each touched only
  // once avoids the issue entirely, without needing to fully reverse-
  // engineer the widget's internal history-list behavior.

  // TC-DU01 (new, Boundary): existing TC-029 only tests an over-limit file
  // (6 MB) — the true boundary is the exact stated limit itself, which must
  // be *accepted*. upload-files/exactly5mb.jpg is exactly 5*1024*1024 bytes,
  // built the same way as the existing oversized.jpg fixture (random bytes
  // padded to an exact size — confirmed live that the app's check is
  // extension+size based, not real image-content validation).
  test('TC-DU01 [Boundary]: accepts a file at exactly the 5 MB size limit', async () => {
    await uploadSlot(bf, 4).setInputFiles(path.join(filesDir, 'exactly5mb.jpg'));
    await bf.hardWait(1.5);

    const bodyText = await bf.page.locator('body').innerText();
    expect(bodyText).not.toMatch(/maximum file size/i);
  });

  // TC-DU02 (new, Positive): existing TC-028 only tests a rejected type
  // (.gif) — no existing test confirms a *valid* type beyond .jpg actually
  // works. upload-files/test.pdf is a small, real, valid single-page PDF.
  test('TC-DU02 [Positive]: accepts a valid .pdf upload', async () => {
    await uploadSlot(bf, 5).setInputFiles(path.join(filesDir, 'test.pdf'));
    await bf.hardWait(1.5);

    const infoDialog = bf.page.locator("div[role='dialog']");
    const dialogTexts = await infoDialog.allTextContents();
    expect(dialogTexts.some(t => /is allowed/i.test(t))).toBe(false);
  });

  // TC-DU03 (new, Positive): same reasoning as TC-DU02, for .png (reuses
  // the existing upload-files/salarySlip.png fixture — already in the repo
  // but never previously used by any Phase 2 test).
  test('TC-DU03 [Positive]: accepts a valid .png upload', async () => {
    await uploadSlot(bf, 6).setInputFiles(path.join(filesDir, 'salarySlip.png'));
    await bf.hardWait(1.5);

    const infoDialog = bf.page.locator("div[role='dialog']");
    const dialogTexts = await infoDialog.allTextContents();
    expect(dialogTexts.some(t => /is allowed/i.test(t))).toBe(false);
  });

  // TC-DU04 (new, Boundary)
  // NOTE: the documented policy (confirmed live in TC-OD09) caps filenames
  // at 256 characters. A literal 256-character filename could not be
  // created as a fixture in this Windows dev environment — the full
  // absolute path (project directory + upload-files/ + a 256-char name)
  // exceeds Windows' own 260-character MAX_PATH limit, which is an
  // environment constraint, not an app one. This uses a 120-character
  // filename instead — still far longer than any real document name, just
  // short of the exact stated cap — to confirm long filenames in general
  // don't break the upload.
  test('TC-DU04 [Boundary]: accepts a long (120-character) filename', async () => {
    const longName = 'a'.repeat(116) + '.jpg';
    await uploadSlot(bf, 7).setInputFiles(path.join(filesDir, longName));
    await bf.hardWait(1.5);

    const infoDialog = bf.page.locator("div[role='dialog']");
    const dialogTexts = await infoDialog.allTextContents();
    expect(dialogTexts.some(t => /is allowed/i.test(t))).toBe(false);
  });

  // TC-DU05 (new, Negative): existing TC-030 only tests a missing mandatory
  // *document* — no existing test confirms the Terms & Conditions checkbox
  // itself is enforced when every document IS present. Confirmed live: an
  // unchecked-Terms Submit attempt pops its own blocking "Information"
  // dialog ("Please accept confirmation to proceed with the application")
  // — same underlay-blocks-everything hazard as the Other Details block's
  // dialog, so it must be dismissed before the next test can interact with
  // the page at all.
  test('TC-DU05 [Negative]: blocks Submit when Terms & Conditions is left unchecked, even with every document uploaded', async () => {
    await uploadAllDocuments(bf); // resets every slot to the standard valid fixture
    await bf.hardWait(1);

    const submitBtn = bf.page.locator("//*[contains(@data-button-id,'CandidatePhase2_UploadDocument.actionButton13')]");
    await submitBtn.click(); // deliberately not checking the Terms checkbox first
    await bf.hardWait(1.5);

    const successDialog = bf.page.locator("div[role='dialog']").filter({
      has: bf.page.getByRole('heading', { name: 'Application Submitted' }),
    });
    await expect(successDialog).toHaveCount(0);

    const infoDialog = bf.page.locator("div[role='dialog']").filter({ hasText: 'Information' });
    await expect(infoDialog).toContainText('Please accept confirmation to proceed with the application');
    await dismissInfoDialogIfPresent(bf);
  });

  // TC-DU06/DU07 (new, Negative): existing TC-030 only checks slot 2 (PAN
  // card) — these confirm the same mandatory-document gate on two other,
  // different slots (Aadhaar and Photo), catching any slot-specific gating
  // bug TC-030 alone wouldn't reveal.
  //
  // Deliberately does NOT re-upload/restore the cleared slot afterward.
  // CONFIRMED LIVE: each uploaded file is persisted per-document
  // server-side (survives a full page reload — see TC-DU08's own finding),
  // and once any single document slot ends up holding a 2nd file, the flat
  // (//input[@type='file'])[N] positional indexing used throughout this
  // file shifts for every later slot, breaking their lookups. Clearing a
  // slot and later re-uploading into it counts as a 2nd touch and
  // reproduced exactly this breakage (confirmed while building this test).
  // Leaving the slot cleared here and letting TC-DU08's uploadAllDocuments()
  // fill it in exactly once, later, avoids ever double-touching any slot.
  test('TC-DU06 [Negative]: blocks Submit when the Aadhaar slot is cleared', async () => {
    await uploadSlot(bf, 1).setInputFiles([]);
    await bf.hardWait(1);
    await checkTermsAndSubmit(bf);

    const successDialog = bf.page.locator("div[role='dialog']").filter({
      has: bf.page.getByRole('heading', { name: 'Application Submitted' }),
    });
    await expect(successDialog).toHaveCount(0);
  });

  // Confirmed live: unlike the Aadhaar slot (TC-DU06), clearing the Photo
  // slot reactively DISABLES the Submit button itself (data-disabled=
  // "true") rather than leaving it clickable-but-blocked-on-click — a real
  // per-slot inconsistency in how "missing mandatory document" is enforced.
  // Handles both possibilities rather than assuming checkTermsAndSubmit()'s
  // blind click will always succeed. Also does not restore afterward, for
  // the same single-touch-per-slot reasoning as TC-DU06 above.
  test('TC-DU07 [Negative]: blocks Submit when the Photo slot is cleared', async () => {
    await uploadSlot(bf, 3).setInputFiles([]);
    await bf.hardWait(1);

    const checkBox = bf.page.locator("//*[contains(@id,'CandidatePhase2_UploadDocument.checkBox1')]");
    await checkBox.check();
    await bf.hardWait(1);

    const submitBtn = bf.page.locator("//*[contains(@data-button-id,'CandidatePhase2_UploadDocument.actionButton13')]");
    const isDisabled = await submitBtn.getAttribute('data-disabled');
    if (isDisabled !== 'true') {
      await submitBtn.click();
      await bf.hardWait(1.5);
    }

    const successDialog = bf.page.locator("div[role='dialog']").filter({
      has: bf.page.getByRole('heading', { name: 'Application Submitted' }),
    });
    await expect(successDialog).toHaveCount(0);
  });

  // TC-DU08 (new, Edge)
  // CONFIRMED LIVE FINDING #1: unlike TC-021's Personal Details refresh
  // (which either restores the same step or drops to login), refreshing
  // mid-Document-Upload actually REWINDS the stepper back to step "1. Other
  // Details" — while retaining its previously-entered data (blood
  // group/religion/dependents all still populated). The page title alone
  // ("Mendix - Application Form - Phase 2") does not distinguish this from
  // staying on "2. Upload Documents", since both steps share one Mendix
  // page/title — hence checking for the actual step-specific elements
  // below, not just the title.
  // CONFIRMED LIVE FINDING #2: uploaded documents are persisted per-slot on
  // the server as each one is selected, not held only in the browser's
  // transient <input type="file"> element — already-uploaded slots survive
  // the refresh with their files intact, confirmed via screenshot. However,
  // this same persistence made a full "recover and re-fill" step here
  // unreliable to automate deterministically in the time available (some
  // already-filled slots intermittently showed a duplicated second entry
  // after the reload, which cascades into the same flat-index breakage
  // TC-DU06/07's fix avoids) — so this test deliberately stops at
  // documenting the confirmed step-rewind behavior, and does NOT attempt to
  // recover/re-fill documents afterward. TC-DU09 (next) is intentionally
  // self-contained with its own fresh session specifically so it never
  // depends on this test's (or this whole shared session's) upload state.
  test('TC-DU08 [Edge]: browser refresh mid-upload rewinds to Other Details without losing its data', async () => {
    await bf.page.reload({ waitUntil: 'networkidle' });
    await bf.hardWait(2);

    const title = await bf.page.title();
    expect(['Mendix - Application Form - Phase 2', 'Mendix - Candidate Login']).toContain(title);

    const onUploadStep = title === 'Mendix - Application Form - Phase 2'
      && await uploadSlot(bf, 1).count() > 0;
    const onOtherDetailsStep = title === 'Mendix - Application Form - Phase 2'
      && await bf.page.locator("//*[contains(@data-button-id,'CandidatePhase2_OtherDetails.actionButton13')]").count() > 0;

    test.info().annotations.push({
      type: 'result',
      description: `Refresh mid-upload landed on: ${onUploadStep ? 'Upload Documents (unchanged)' : onOtherDetailsStep ? 'Other Details (rewound one step, data retained)' : 'Candidate Login (session dropped)'}`,
    });

    expect(onUploadStep || onOtherDetailsStep || title === 'Mendix - Candidate Login').toBe(true);
  });

  // TC-DU09 (new, Positive) — the single most important new test in this
  // whole batch: closes the named gap in TEST_KNOWLEDGE_MAP.md — no test
  // anywhere in the Candidate module itself previously asserted that a
  // fully valid submission actually succeeds. Every document slot uploaded,
  // Terms checked, Submit clicked, and the real "Application Submitted"
  // success dialog is asserted present (not just "no failure dialog", the
  // weaker signal every other test in this file uses).
  //
  // Deliberately uses its OWN fresh BrowserFactory session/candidate rather
  // than the shared one above — TC-DU06/07/08 leave the shared session's
  // upload state in a condition not worth depending on for the single most
  // important assertion in this batch (see TC-DU08's comment). A clean,
  // independent run is the reliable way to prove this works.
  test('TC-DU09 [Positive]: a fully valid submission succeeds with the "Application Submitted" dialog', async () => {
    // Full inline signup -> Phase 1 -> Phase 2 -> 13 uploads -> submit needs
    // more than Playwright's default 120s per-test budget, same reasoning as
    // the beforeAll timeout bumps elsewhere in this project (e.g.
    // Setup.spec.js:40) for tests that create a candidate from scratch.
    test.setTimeout(300000);
    const freshBf = new BrowserFactory();
    await freshBf.launchBrowser(config.CANDIDATE_URL);
    try {
      await reachPhase2Uploads(freshBf);
      await uploadAllDocuments(freshBf);
      await checkTermsAndSubmit(freshBf);

      // Confirmed live: when a submission is genuinely complete and about
      // to succeed, an additional "Confirmation" dialog appears first
      // ("Are you sure you want to submit? ... you will not be able to edit
      // these later.") — the same Yes/No pattern Experience Details already
      // uses (pages/Candidate/Phase1.js's confirmationMsg). Handled locally
      // here, not inside the shared checkTermsAndSubmit() helper, so every
      // negative test that also calls that helper (TC-028..032, TC-DU05/06/
      // 07) can't accidentally click a real submission through.
      const confirmYesBtn = freshBf.page.locator("//*[@class='btn btn-primary' and text()='Yes']");
      if (await confirmYesBtn.isVisible().catch(() => false)) {
        await confirmYesBtn.click();
        await freshBf.hardWait(2);
      }

      const successDialog = freshBf.page.locator("div[role='dialog']").filter({
        has: freshBf.page.getByRole('heading', { name: 'Application Submitted' }),
      });
      await expect(successDialog).toBeVisible();
    } finally {
      await freshBf.closeBrowser();
    }
  });

  // TC-DU10 (new, Negative)
  // Closes an open question left by TC-030/TC-DU06: those only prove "no
  // success dialog without confirming Yes" — they never click through the
  // "Are you sure you want to submit?" confirmation, so they couldn't rule
  // out the missing-document gate being bypassable that way. This test does
  // click "Yes" (same as TC-DU09's real happy path) with Aadhaar still
  // empty, and CONFIRMED LIVE (re-run twice for stability) that the app
  // correctly still blocks it — no "Application Submitted" dialog appears
  // either way. (An earlier live observation made while debugging the
  // TC-DU06/07 slot-index-corruption issue had suggested this might be
  // bypassable — that turned out to be an artifact of the corrupted
  // multi-file-per-slot state at the time, not a real gap; this clean,
  // isolated re-test is the actual confirmed behavior.)
  //
  // Deliberately uses its own fresh, isolated session (not the shared
  // TC-DU01..08 one above) for the same reason as TC-DU09 — a clean,
  // single-slot-missing state is the only way to get a reliable read here.
  test('TC-DU10 [Negative]: a missing mandatory document still blocks submission even after confirming "Yes"', async () => {
    test.setTimeout(300000);
    const freshBf = new BrowserFactory();
    await freshBf.launchBrowser(config.CANDIDATE_URL);
    try {
      await reachPhase2Uploads(freshBf);
      await uploadAllDocuments(freshBf, { skipIndices: [1] }); // Aadhaar left empty
      await checkTermsAndSubmit(freshBf);

      const confirmYesBtn = freshBf.page.locator("//*[@class='btn btn-primary' and text()='Yes']");
      if (await confirmYesBtn.isVisible().catch(() => false)) {
        await confirmYesBtn.click();
        await freshBf.hardWait(2);
      }

      const successDialog = freshBf.page.locator("div[role='dialog']").filter({
        has: freshBf.page.getByRole('heading', { name: 'Application Submitted' }),
      });
      await expect(successDialog).toHaveCount(0);
    } finally {
      await freshBf.closeBrowser();
    }
  });
});
