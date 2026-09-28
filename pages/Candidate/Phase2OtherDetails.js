// pages/Candidate/Phase2OtherDetails.js - page object for Application Form -
// Phase 2, section "1. Other Details" (new 2026-09-25). A separate file
// rather than an addition to pages/Candidate/Phase2.js because that file's
// legacy ITAP_ContinueToPhase2Page is still imported by
// utils/CandidateFlowHelpers.js and utils/createFreshInterviewCandidate.js.
//
// Locators confirmed live 2026-09-25. Mendix ids look like
// "279.MR.Snip_OtherDetails.textBox1_cka_5" - the "279.MR." prefix and the
// "_cka_5" suffix change between renders, so everything matches on the
// stable middle part. The trailing "_" on the textBox ids is deliberate:
// without it, 'textBox1' would also match 'textBox11' (PAN).
//
// Field labels are NOT <label for=...> elements here: each field sits in its
// own container as <span>Label</span>[<span style="color:red">*</span>]
// <div class="form-group">...</div>, so labelContainer()/asteriskFor() below
// work off that structure.
class ITAP_Phase2OtherDetailsPage {
  constructor(page) {
    this.page = page;

    // ---- page shell ----
    this.headerLogo  = page.locator('img.mx-name-staticImage1');
    this.accountIcon = page.locator('img.mx-name-staticImage3');
    this.signOutBtn  = page.getByRole('button', { name: 'Sign out' });
    this.pageTitle   = page.locator('h1.mx-name-pageTitle1');

    // ---- 1.1 Other Details fields ----
    this.name           = page.locator("input[id*='Snip_OtherDetails.textBox1_']").first();
    this.mobile         = page.locator("input[id*='Snip_OtherDetails.textBox4_']").first();
    this.email          = page.locator("input[id*='Snip_OtherDetails.textBox5_']").first();
    this.pan            = page.locator("input[id*='Snip_OtherDetails.textBox11_']").first();
    // Scoped to <select> - a validation message's own <div> also gets an id
    // containing the widget name (same issue documented in Phase2.js).
    this.bloodGroup     = page.locator("select[id*='Snip_OtherDetails.dropDown1']").first();
    this.religion       = page.locator("select[id*='Snip_OtherDetails.dropDown5']").first();
    this.maritalStatus  = page.locator("select[id*='Snip_OtherDetails.dropDown2']").first();
    this.dateOfMarriage = page.locator("input[id*='Snip_OtherDetails.datePicker1']").first();

    this.nextBtn = page.locator("//*[contains(@data-button-id,'CandidatePhase2_OtherDetails.actionButton13')]").first();
    this.validationMessages = page.locator('.mx-validation-message');

    // ---- collapsible section groupboxes (added 2026-09-25, batch 2) ----
    // Same pattern as Phase 1: the header's icon has "mx-icon-substract"
    // when expanded and "mx-icon-add" when collapsed.
    this.otherDetailsSection        = page.locator('.mx-name-groupBox1').first();
    this.otherDetailsToggleIcon     = this.otherDetailsSection.locator('.mx-groupbox-collapse-icon').first();
    this.dependentDetailsSection    = page.locator('.mx-name-groupBox3').first();
    this.dependentDetailsToggleIcon = this.dependentDetailsSection.locator('.mx-groupbox-collapse-icon').first();

    // ---- 1.2 Dependent Details ----
    // Mendix renders each dependent row TWICE: a desktop layout inside
    // div.hide-phone (textBox1 / dropDown1 / datePicker1 = DOB /
    // datePicker2 = Date of Demise / checkBox1 = Nominee) and a hidden phone
    // layout (textBox2 / dropDown2 / datePicker5 / datePicker4 / checkBox2).
    // Everything below is scoped to the visible desktop family.
    const dep = (widget) => page.locator(`div.hide-phone [id*='Snip_DependentDetails.${widget}_']`);
    this.dependentNames     = page.locator("div.hide-phone input[id*='Snip_DependentDetails.textBox1_']");
    this.dependentRelations = page.locator("div.hide-phone select[id*='Snip_DependentDetails.dropDown1_']");
    this.dependentDOBs      = page.locator("div.hide-phone input[id*='Snip_DependentDetails.datePicker1_']");
    this.dependentDemises   = page.locator("div.hide-phone input[id*='Snip_DependentDetails.datePicker2_']");
    this.dependentNominees  = page.locator("div.hide-phone input[id*='Snip_DependentDetails.checkBox1_']");
    // Column header labels (label1..label5) of the desktop layout.
    this.dependentHeaderLabel = (n) => dep(`label${n}`).first();
    this.addMemberBtn = page.getByRole('button', { name: 'Add Member' });
    // Father/Mother rows show a greyed-out, non-clickable trash image
    // (staticImage2 + "disabled"); rows added via Add Member get a clickable
    // one (staticImage1, role=button) that opens an OK/Cancel confirmation.
    this.lockedTrashIcons    = page.locator("div.hide-phone img.mx-name-staticImage2[src*='Delete_Icon']");
    this.deletableTrashIcons = page.locator("div.hide-phone img.mx-name-staticImage1[src*='Delete_Icon']");
    this.dialog = page.locator('.modal-dialog');

    // ---- 1.3 UAN Details (added 2026-09-25, batch 4) ----
    // Confirmed live: groupBox4, single (non-duplicated) widget set. Each
    // radio group renders its Yes option first, then No. "Are you
    // experienced?" (radioButtons6) uses values "true"/"false"; the other
    // four use "_true"/"_false".
    this.uanSection           = page.locator('.mx-name-groupBox4').first();
    this.uanSectionToggleIcon = this.uanSection.locator('.mx-groupbox-collapse-icon').first();
    const uanRadios = (widget) => page.locator(`input[type='radio'][id*='Snip_UAN_Details.${widget}_']`);
    this.experiencedRadios      = uanRadios('radioButtons6');
    this.memberPFRadios         = uanRadios('radioButtons1');
    this.withdrawnPFRadios      = uanRadios('radioButtons2');
    this.memberPensionRadios    = uanRadios('radioButtons3');
    this.withdrawnPensionRadios = uanRadios('radioButtons4');
    this.uanNumber = page.locator("input[id*='Snip_UAN_Details.textBox1_']").first();
    this.esicNumber = page.locator("input[id*='Snip_UAN_Details.textBox2_']").first();

    // ---- 1.4 Emergency Contact (added 2026-09-25, batch 6) ----
    // Confirmed live: groupBox10, a list view of exactly 2 rows, no add
    // button. Like Dependent Details it renders a desktop widget set
    // (textBox1 Name / dropDown1 Relation / textBox3 Contact Number 1 /
    // textBox4 Contact Number 2) and a hidden phone set (textBox2 / dropDown2
    // / textBox5 / textBox6); the ids below only match the desktop set.
    // Column headers are label1..label4, each followed by a red "*" span
    // when mandatory.
    this.ecSection           = page.locator('.mx-name-groupBox10').first();
    this.ecSectionToggleIcon = this.ecSection.locator('.mx-groupbox-collapse-icon').first();
    this.ecNames     = this.ecSection.locator("input[id*='Snip_EmergencyContact.textBox1_']");
    this.ecRelations = this.ecSection.locator("select[id*='Snip_EmergencyContact.dropDown1_']");
    this.ecContact1  = this.ecSection.locator("input[id*='Snip_EmergencyContact.textBox3_']");
    this.ecContact2  = this.ecSection.locator("input[id*='Snip_EmergencyContact.textBox4_']");
    this.ecHeaderLabel = (n) => this.ecSection.locator(`label.mx-name-label${n}`).first();
  }

  // The red "*" span directly after an Emergency Contact column header.
  ecHeaderAsterisk(n) {
    return this.ecHeaderLabel(n).locator("xpath=following-sibling::span[normalize-space()='*']");
  }

  // Fills whichever of name/relation/contact1/contact2 are given for
  // Emergency Contact row i (0 or 1).
  async fillEmergencyRow(i, { name, relation, contact1, contact2 } = {}) {
    const text = async (loc, v) => {
      await loc.scrollIntoViewIfNeeded();
      await loc.fill(v);
      await loc.press('Tab');
    };
    if (name !== undefined) await text(this.ecNames.nth(i), name);
    if (relation !== undefined) {
      if (relation === '') await this.clearSelect(this.ecRelations.nth(i));
      else await this.selectByLabel(this.ecRelations.nth(i), relation);
    }
    if (contact1 !== undefined) await text(this.ecContact1.nth(i), contact1);
    if (contact2 !== undefined) await text(this.ecContact2.nth(i), contact2);
  }

  // Validation messages on every field of Emergency Contact row i.
  async ecRowMessages(i) {
    return {
      name: await this.fieldValidationMessages(this.ecNames.nth(i)),
      relation: await this.fieldValidationMessages(this.ecRelations.nth(i)),
      contact1: await this.fieldValidationMessages(this.ecContact1.nth(i)),
      contact2: await this.fieldValidationMessages(this.ecContact2.nth(i)),
    };
  }

  // [Yes checked, No checked] for a UAN radio group.
  async radioStates(radios) {
    return radios.evaluateAll((els) => els.map((e) => e.checked));
  }

  // Labels inside the UAN section that carry the red "*" right after them.
  async uanAsteriskLabels() {
    return this.uanSection.evaluate((g) => [...g.querySelectorAll('span')]
      .filter((s) => s.innerText.trim() === '*')
      .map((s) => (s.previousElementSibling ? s.previousElementSibling.innerText.trim() : '')));
  }

  async toggleSection(icon) {
    await icon.scrollIntoViewIfNeeded();
    await icon.click({ force: true });
  }

  // The red "*" span directly after a Dependent Details header label.
  dependentHeaderAsterisk(n) {
    return this.dependentHeaderLabel(n).locator("xpath=following-sibling::span[normalize-space()='*']");
  }

  // Validation message(s) rendered inside the given field's own form-group,
  // so e.g. a dependent's "Name is mandatory" can't be confused with the
  // identically-worded Emergency Contact message.
  async fieldValidationMessages(fieldLocator) {
    return fieldLocator.evaluate((el) => {
      const group = el.closest('.form-group');
      if (!group) return [];
      return [...group.querySelectorAll('.mx-validation-message')].map((m) => m.innerText.trim()).filter(Boolean);
    });
  }

  async fillDate(locator, value) {
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(value);
    await locator.press('Tab');
  }

  // Clicking "Add Member" commits a new (blank) dependent row server-side
  // straight away - confirmed live 2026-09-25 that it is still there on the
  // next sign-in, even with nothing typed and nothing saved. Deleting it
  // (trash -> OK) also persists. This removes every row added that way, so
  // pooled accounts go back to exactly Father + Mother. Father/Mother
  // themselves are never deletable, so they can't be hit by this.
  //
  // A blocked Next leaves an "Information" modal open ("Please complete all
  // mandatory fields (including Nominee, if not already selected) to
  // proceed", OK button) whose underlay swallows every click, so any open
  // dialog is dismissed first.
  async dismissDialogs(settle, bf) {
    for (let guard = 0; guard < 5 && (await this.dialog.count()) > 0; guard++) {
      await this.dialog.last().locator('.mx-dialog-footer button', { hasText: 'OK' }).click();
      await settle(bf);
    }
  }

  async deleteAddedDependents(settle, bf) {
    await this.dismissDialogs(settle, bf);
    for (let guard = 0; guard < 10 && (await this.deletableTrashIcons.count()) > 0; guard++) {
      await this.deletableTrashIcons.last().scrollIntoViewIfNeeded();
      await this.deletableTrashIcons.last().click();
      const ok = this.dialog.last().locator('.mx-dialog-footer button', { hasText: 'OK' });
      await ok.waitFor({ state: 'visible', timeout: 10000 });
      await ok.click();
      await settle(bf, { timeout: 6000 });
    }
  }

  // ---- added 2026-09-25, batch 3 (TC_21-TC_30) ----

  // Clicks "Add Member" and waits for the new row to render. Returns the new
  // row's index. NB the row persists server-side immediately (see above).
  async addDependent(settle, bf) {
    const before = await this.dependentNames.count();
    await this.addMemberBtn.scrollIntoViewIfNeeded();
    await this.addMemberBtn.click();
    await settle(bf, { timeout: 6000 });
    await this.dependentNames.nth(before).waitFor({ state: 'visible', timeout: 10000 });
    return before;
  }

  // Fills whichever of name/relation/dob/demise are given for dependent row i.
  async fillDependentRow(i, { name, relation, dob, demise } = {}) {
    if (name !== undefined) {
      await this.dependentNames.nth(i).scrollIntoViewIfNeeded();
      await this.dependentNames.nth(i).fill(name);
      await this.dependentNames.nth(i).press('Tab');
    }
    if (relation !== undefined) await this.selectByLabel(this.dependentRelations.nth(i), relation);
    if (dob !== undefined) await this.fillDate(this.dependentDOBs.nth(i), dob);
    if (demise !== undefined) await this.fillDate(this.dependentDemises.nth(i), demise);
  }

  // Checked state of every visible Nominee checkbox, in row order.
  async nomineeStates() {
    const n = await this.dependentNominees.count();
    const states = [];
    for (let i = 0; i < n; i++) states.push(await this.dependentNominees.nth(i).isChecked());
    return states;
  }

  // Body text of the top-most open Mendix dialog, or null if none is open.
  async openDialogText() {
    if ((await this.dialog.count()) === 0) return null;
    return (await this.dialog.last().locator('.modal-body, .mx-dialog-body').first().innerText().catch(() => this.dialog.last().innerText())).trim();
  }

  // The step-indicator circle (the "1."/"2." disc) sitting just before a
  // step's label. Current step = filled dark disc rgb(50, 43, 124); a step
  // not yet reached = pale disc rgb(213, 226, 231) (confirmed live).
  stepCircle(label) {
    return this.page.locator(`xpath=//span[normalize-space()='${label}']/preceding-sibling::div[1]`).first();
  }

  stepLabel(label) {
    return this.page.locator(`xpath=//span[normalize-space()='${label}']`).first();
  }

  async stepCircleBackground(label) {
    return this.stepCircle(label).evaluate((el) => getComputedStyle(el).backgroundColor);
  }

  // The checkmark image rendered inside a step's circle once that step is
  // completed (added 2026-09-28 for TC_66). Confirmed live: the numeral span
  // itself stays in the DOM (so stepCircle(label) still resolves) but goes
  // display:none via its own "hide-desktop hide-phone" classes once the step
  // completes, replaced visually by this checkmark image.
  stepCircleCheckmark(label) {
    return this.stepCircle(label).locator("img[src*='check_2']");
  }

  // The container holding a 1.1 Other Details field's label span + widget.
  labelContainer(labelText) {
    return this.page.locator(
      `xpath=//div[span[normalize-space()='${labelText}'] and .//*[contains(@id,'Snip_OtherDetails.')]]`,
    ).first();
  }

  // The red "*" span directly beside that label (absent = not marked mandatory).
  asteriskFor(labelText) {
    return this.labelContainer(labelText).locator("xpath=./span[normalize-space()='*']");
  }

  // Visible option texts, blank placeholder option filtered out.
  async getOptionTexts(selectLocator) {
    const texts = await selectLocator.locator('option').allTextContents();
    return texts.map((t) => t.trim()).filter(Boolean);
  }

  async getSelectedText(selectLocator) {
    return selectLocator.evaluate((el) => (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text.trim() : ''));
  }

  async selectByLabel(selectLocator, label) {
    await selectLocator.scrollIntoViewIfNeeded();
    await selectLocator.selectOption({ label });
  }

  // Resets a select to its blank placeholder - done actively (not just "left
  // alone") so a value that may have stuck on the pooled account from an
  // earlier run can't hide a mandatory-field message.
  async clearSelect(selectLocator) {
    await selectLocator.scrollIntoViewIfNeeded();
    await selectLocator.selectOption({ index: 0 });
  }

  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  }

  // Mendix validates server-side, so the DOM is quiet between the click and
  // the response and a bare settle() can return before any message exists
  // (same reasoning as Phase1.spec.js's clickNextAndGetValidationMessages()).
  // Races the two real outcomes instead: a validation message renders, or
  // the page left Other Details (Blood Group <select> gone). Non-throwing.
  async clickNextAndGetValidationMessages(settle, bf) {
    await this.nextBtn.scrollIntoViewIfNeeded();
    await this.nextBtn.click();
    await this.page
      .waitForFunction(
        () => !!document.querySelector('.mx-validation-message')
          || !document.querySelector("select[id*='Snip_OtherDetails.dropDown1']"),
        undefined,
        { timeout: 10000, polling: 150 },
      )
      .catch(() => {});
    await settle(bf);
    return this.getVisibleValidationMessages();
  }
}

// ---- Phase 2, section "2. Upload Documents" (added 2026-09-28, batch 1:
// TC_65-74 - the static note/instructions link, step indicator (shared with
// ITAP_Phase2OtherDetailsPage.stepCircle/stepLabel above), General /
// Qualification / Experience / Dependent Documents section labels +
// mandatory asterisks, and the consent checkbox). A separate class in this
// SAME file rather than an addition to ITAP_Phase2OtherDetailsPage above -
// same reasoning that class's own header comment gives for being split out
// of pages/Candidate/Phase2.js: a distinct page/section with its own
// locators. Nothing above this point is touched.
//
// Reached from "1. Other Details" via a real successful Next - every test
// using this class signs in as `divorced` or `fresherUploads`
// (utils/Phase2TestCandidates.js), never `single`/`fresher` (seeing that
// file's own comment on why a valid Next there would be destructive to the
// section 1 suite's pooled accounts).
//
// Confirmed live 2026-09-28: a document field already at its per-document
// file cap (2, except Experience Documents: 10) renders a disabled "Choose
// File" control with NO real <input type='file'> underneath it - both
// `divorced` and `fresherUploads` carry some already-uploaded files from
// earlier manual/automated probing, so raw input[type='file'] counts vary
// run to run. Nothing in TC_65-74 needs to open/count/clear those, so this
// class doesn't provide a raw-input locator - see
// utils/CandidateFlowHelpers.js's uploadSlot()/uploadAllDocuments() for
// that, used by later, upload-driving batches.
class ITAP_Phase2UploadDocumentsPage {
  constructor(page) {
    this.page = page;

    // The "Note: " bold prefix (mx-name-text1) and the rest of the sentence
    // (mx-name-text2) are two separate widgets sharing one wrapper div -
    // this points at that wrapper so its full innerText reads as one
    // sentence (confirmed live 2026-09-28).
    this.noteText = page.locator('.mx-name-container1.spacing-outer-bottom').first();
    // Not a real <a href> - a clickable div (role="button") that, per a
    // browser download (not a normal page navigation - confirmed live
    // 2026-09-28, see TC_74), fetches "Document Upload Instruction.pdf".
    this.instructionsLink = page.locator("div[role='button']", { hasText: 'Click Here To See Document Upload Instructions' }).first();

    this.generalDocsSection       = page.locator('.mx-name-groupBox2').first();
    this.qualificationDocsSection = page.locator('.mx-name-groupBox5').first();
    this.experienceDocsSection    = page.locator('.mx-name-groupBox7').first();
    this.dependentDocsSection     = page.locator('.mx-name-groupBox6').first();

    // One <li> per non-deceased dependent (confirmed live 2026-09-28: a
    // deceased dependent's row is omitted entirely, not just hidden).
    // Scoped to mx-name-listView1 specifically (not the more generic
    // .mx-listview, which also matches the small per-document uploaded-file
    // list views nested inside each block and would over-count).
    this.dependentDocBlocks = this.dependentDocsSection.locator('.mx-name-listView1 > ul > li');
    // "{Name} - {Relation}'s Documents" heading inside each block.
    this.dependentDocHeadings = this.dependentDocsSection.locator('.mx-name-text1');

    this.consentCheckbox = page.locator("input[id*='CandidatePhase2_UploadDocument.checkBox1']");
    // NOT just '.mx-name-text3' - that class name collides with the
    // page-shell step-indicator's own "1." numeral span (Mendix widget names
    // are only unique within their own snippet, not page-wide - confirmed
    // live 2026-09-28). The extra "spacing-outer-left" class is what the
    // real consent text widget alone carries.
    this.consentText = page.locator('.mx-name-text3.spacing-outer-left').first();

    // ---- added 2026-09-28, batch 3 (TC_85-96): real Submit interactions ----
    // Mendix's native Yes/No confirmation dialog - distinct from the OK-only
    // `.modal-dialog` above (Information popups): confirmed live it opens on
    // clicking Submit with a fully valid form + checked consent ("Are you
    // sure you want to submit? Please ensure all the details are correct as
    // you will not be able to edit these later."), and again (its own,
    // separately-triggered instance) on clicking a file's remove/delete icon.
    this.yesButton = page.getByRole('button', { name: /^yes$/i });
    this.noButton = page.getByRole('button', { name: /^no$/i });

    // ---- real file-upload interactions (added 2026-09-28, batch 2:
    // TC_76-84) ----
    this.submitBtn = page.locator("//*[contains(@data-button-id,'CandidatePhase2_UploadDocument.actionButton13')]").first();
    // Page-level Mendix "Information"/"Confirmation" popups (long-filename
    // rejection, Submit-without-consent) - same underlying widget as
    // ITAP_Phase2OtherDetailsPage.dialog, but that class isn't reused here
    // since this class deliberately doesn't depend on it (a distinct
    // section/page in the same SPA).
    this.dialog = page.locator('.modal-dialog');
  }

  // Body text of the top-most open Mendix dialog, or null if none is open.
  async dialogText() {
    if ((await this.dialog.count()) === 0) return null;
    return (await this.dialog.last().innerText()).trim();
  }

  // Dismisses the top-most open dialog via its OK button, if one is open.
  async dismissDialog() {
    const ok = this.dialog.last().locator('.mx-dialog-footer button', { hasText: 'OK' });
    if (await ok.count()) await ok.click();
  }

  // The "col-lg col-md col" grid cell holding one Upload Documents field's
  // label span and (when mandatory) its red "*" as a sibling wrapper's span
  // - scoped to a section/block root so identically-worded labels in
  // different sections ("Aadhaar Card" appears in General Documents AND
  // every Dependent Documents block) can't be confused for one another.
  // Matched on the exact class token "col-lg" (not e.g. "col-lg-1", the
  // neighboring green-tick column) via the classic XPath "space-padded
  // contains" idiom.
  fieldCell(root, labelText) {
    return root.locator(`xpath=.//div[contains(concat(" ", normalize-space(@class), " "), " col-lg ") and .//span[normalize-space()="${labelText}"]]`).first();
  }

  fieldLabel(root, labelText) {
    return this.fieldCell(root, labelText).locator(`xpath=.//span[normalize-space()="${labelText}"]`).first();
  }

  // The red "*" span(s) in that same cell - empty locator (count 0) means
  // the field is not marked mandatory.
  fieldAsterisk(root, labelText) {
    return this.fieldCell(root, labelText).locator('xpath=.//span[normalize-space()="*"]');
  }

  // The full "documentsborder" wrapper for a field - contains BOTH the
  // label row (what fieldCell() above reaches) AND the sibling "Choose
  // File" / uploaded-file-list row underneath it. Needed for real file
  // upload interactions (added 2026-09-28, batch 2: TC_76-84) - fieldCell()
  // alone doesn't reach far enough up the tree for these.
  fieldContainer(root, labelText) {
    return root.locator(`xpath=.//div[contains(concat(" ", normalize-space(@class), " "), " documentsborder ") and .//span[normalize-space()="${labelText}"]]`).first();
  }

  // The real <input type='file'> for a field's slot - ABSENT once that slot
  // already holds its cap (2 files, or 10 for Experience Documents -
  // confirmed live 2026-09-28: the whole "Choose File" control disappears,
  // not just becomes disabled - see TC_82/TC_83's own comments).
  fieldFileInput(root, labelText) {
    return this.fieldContainer(root, labelText).locator("input[type='file']");
  }

  // Names of files already accepted into a field's slot, in list order.
  fieldUploadedFiles(root, labelText) {
    return this.fieldContainer(root, labelText).locator('.documentdisplaycontent');
  }

  // The filedropper widget's own inline rejection banner for a field - size
  // and type errors render HERE (confirmed live 2026-09-28), not as a
  // page-level dialog. Contrast with the long-filename rejection, which IS
  // a page-level dialog (see `dialog`/dialogText() above).
  fieldAlerts(root, labelText) {
    return this.fieldContainer(root, labelText).locator('.filedropper__alerts');
  }

  // Uploads a file (a path, or a Playwright buffer object
  // {name,mimeType,buffer} for the in-memory long-filename case) into a
  // field's slot exactly the way setInputFiles() always has elsewhere in
  // this codebase (fires the same 'change' event a native OS picker would).
  async uploadInto(root, labelText, fileOrBuffer) {
    await this.fieldFileInput(root, labelText).setInputFiles(fileOrBuffer);
  }

  // ---- added 2026-09-28, batch 3 (TC_85-96) ----

  // The delete/remove icon on an already-uploaded file within a field's slot
  // - one per uploaded file, in the same order as fieldUploadedFiles(). Live
  // DOM check 2026-09-28 found no '.filedropper__item'/
  // '.filedropper__button-zone__button' classes anywhere on this page (the
  // real per-file row is a plain '.documentdisplaycontent' + sibling
  // "pull-right" div); the icon itself is the exact same
  // `img[src*='Delete_Icon']` pattern ITAP_Phase2OtherDetailsPage above
  // already uses for the 1.2 Dependent Details trash icons - reused here for
  // consistency rather than inventing a different selector.
  fieldRemoveButton(root, labelText) {
    return this.fieldContainer(root, labelText).locator("img[src*='Delete_Icon']");
  }

  // Fills every currently-empty document slot on the whole page with the
  // same valid file - these tests don't care which file lands in which slot,
  // only that the form becomes fully valid (confirmed live 2026-09-28).
  //
  // Deliberately scans '.row.documentchoosefilemargin' (the "Choose File" +
  // file-list row pair for ONE labeled field), not '.documentsborder' - live
  // DOM check 2026-09-28 found General/Qualification/Experience Documents
  // render exactly one documentsborder PER FIELD, but Dependent Documents
  // renders ONE documentsborder per DEPENDENT wrapping TWO such rows
  // ("Aadhaar Card" then "Photo"). Scanning at the documentsborder level
  // therefore read a dependent's block as "already has a file" (hence
  // skipped it entirely) the moment EITHER of its two fields got one,
  // silently leaving the other's input untouched - confirmed live as the
  // actual cause of a stuck "Please upload all documents" popup on an
  // otherwise fully-filled form. The row-level scan below fixes that: each
  // row is its own atomic slot with its own '.documentdisplaycontent' list
  // and its own real <input type='file'>. Capped at 30 iterations (more
  // atomic rows than documentsborder containers) as a safety guard against
  // an infinite loop if a slot were to ever not register as filled.
  async fillAllEmptySlots(validFilePath = 'D:/itap/utils/upload-files/samplepic.jpg') {
    for (let guard = 0; guard < 30; guard++) {
      const rows = this.page.locator('.row.documentchoosefilemargin');
      const total = await rows.count();
      let input = null;
      for (let i = 0; i < total; i++) {
        const row = rows.nth(i);
        // eslint-disable-next-line no-await-in-loop
        if ((await row.locator('.documentdisplaycontent').count()) > 0) continue;
        const candidate = row.locator("input[type='file']");
        // eslint-disable-next-line no-await-in-loop
        if ((await candidate.count()) === 0) continue; // already at cap, no real input to use
        input = candidate.first();
        break;
      }
      if (!input) break;
      await input.setInputFiles(validFilePath);
      await this.page.waitForTimeout(700);
    }
  }
}

module.exports = { ITAP_Phase2OtherDetailsPage, ITAP_Phase2UploadDocumentsPage };
