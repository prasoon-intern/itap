// pages/Candidate/Phase1.js — Candidate Phase 1 page objects. Contains 3
// classes, unchanged from the previous consolidated pages/Candidate.js:
//   - ITAPInterviewPerformaPage: Personal Details
//   - ITAP_QualificationDetailsPage: Qualification Details
//   - ITAP_ExperienceDetailPage: Experience Details

// pages/ITAPInterviewPerformaPage.js — equivalent to ITAPInterviewPerformaPage.java
class ITAPInterviewPerformaPage {
  constructor(page) {
    this.page = page;

    // Basic Details
    this.firstNamefield  = page.locator("[placeholder='Enter first name']");
    this.middleNamefield = page.locator("[placeholder='Enter middle name']");
    this.lastNamefield   = page.locator("[placeholder='Enter last name']");
    // Confirmed live (2026-09-17): a native <select> — scoped to //select for
    // the same validation-error-id-collision reason as State/District below.
    this.role            = page.locator("//select[contains(@id, 'BasicDetails.dropDown3')]");
    this.hQ_preference   = page.locator("//*[contains(@id,'BasicDetails.referenceSelector1')]");
    this.hQ_flexible   = page.locator("//*[contains(@id,'MR.Snip_BasicDetails.radioButtons5') and @value='HQ_Flexible']");
    this.hQ_notflexible   = page.locator("//*[contains(@id,'MR.Snip_BasicDetails.radioButtons5') and @value='HQ_Not_Flexible']");

    // Personal Details
    this.pancardField    = page.locator("[placeholder='Enter pan card']");
    this.mobNo           = page.locator("[placeholder='Enter mobile number']");
    // Confirmed live (2026-08-19): this is a combobox widget, not a native
    // <select> — the id previously here ('PersonalDetails.dropDown5')
    // matches zero elements on the current form and hung select_Gender()
    // forever waiting for it to appear.
    this.gender          = page.locator("//*[contains(@id, 'Snip_PersonalDetails.comboBox1')]");
    this.DOB             = page.locator("[placeholder='dd/mm/yyyy']");
    // Confirmed live (2026-09-17): a native <select> — scoped to //select for
    // the same validation-error-id-collision reason as State/District below.
    this.maritalStatus   = page.locator("//select[contains(@id, 'PersonalDetails.dropDown6')]");
    this.fatherName      = page.locator("(//*[contains(@id,'PersonalDetails.textBox2')])[1]");
    this.fatherOcc       = page.locator("(//*[contains(@id,'Snip_PersonalDetails.textBox12')])");
    this.fatherIncome    = page.locator("(//*[contains(@id,'Snip_PersonalDetails.textBox13')])");
    this.motherName      = page.locator("(//*[contains(@id,'Snip_PersonalDetails.textBox14')])");
    this.motherOcc       = page.locator("(//*[contains(@id,'Snip_PersonalDetails.textBox15')])");
    this.motherIncome    = page.locator("(//*[contains(@id,'Snip_PersonalDetails.textBox16')])");

    // Communication Address
    this.perAddLine1     = page.locator("[placeholder='Enter permanent address']");
    this.addLine2        = page.locator("[placeholder='Enter address line 2']");
    this.addLine3        = page.locator("[placeholder='Enter address line 3']");
    this.city            = page.locator("(//*[@placeholder='Enter city'])[1]");
    this.pin             = page.locator("(//*[@placeholder='Enter pin code'])[1]");
    // Confirmed live (2026-09-17): both State and District render as plain
    // native <select> elements, not custom combobox widgets. A bare
    // contains(@id,...) locator is ambiguous once a validation error is
    // showing — Mendix's error <div id="...-error"> also contains the same
    // id substring, producing a strict-mode multi-match — so this is scoped
    // to //select the same way SignUpSignIn.js already scopes its own
    // id-substring locators to //input for the identical reason.
    this.state           = page.locator("//select[contains(@id,'PersonalDetails.referenceSelector1')]");
    this.district        = page.locator("//select[contains(@id, 'PersonalDetails.referenceSelector2')]");
    this.perAddRadioBtn  = page.locator("//*[contains(@id, 'PersonalDetails.checkBox1')]");

    this.currAddLine1     = page.locator("[placeholder='Enter current address']");
    this.currAddLine2     = page.locator("[placeholder='Enter current address line 2']");
    this.currAddLine3     = page.locator("[placeholder='Enter current address line 3']");
    this.currCity         = page.locator("(//*[@placeholder='Enter city'])[2]");
    this.currPin          = page.locator("(//*[@placeholder='Enter pin code'])[2]");
    this.currState        = page.locator("//select[contains(@id,'Snip_PersonalDetails.referenceSelector3')]");
    this.currDistrict     = page.locator("//select[contains(@id, 'Snip_PersonalDetails.referenceSelector5')]");
    this.nextBtn         = page.locator("//*[contains(@data-button-id, 'Candidate_PersonalDetails.actionButton16')]");
    // Confirmed live (2026-09-11): a genuine, separate "Save" action exists
    // alongside Next on every Phase 1 screen (Mendix renders a second,
    // identical Save/Next pair for its responsive/mobile layout, hence
    // "contains" rather than an exact id match) - never exercised by any
    // existing test.
    this.saveBtn         = page.locator("//*[contains(@data-button-id, 'Candidate_PersonalDetails.actionButton13')]");
    this.vehicleNum       = page.locator("[placeholder='Enter Vehicle Number']");
    this.vehicleNumToggleyes = page.locator("//*[contains(@id, 'Snip_GeneralDetails.radioButtons5') and @value='_true']");
    this.vehicleNumToggleno = page.locator("//*[contains(@id, 'Snip_GeneralDetails.radioButtons5') and @value='_false']");
    this.interviewDate_Toggle = page.locator("//*[contains(@id, 'Snip_GeneralDetails.radioButtons6') and @value='_true']");
    this.interviewDate_Toggle_No = page.locator("//*[contains(@id, 'Snip_GeneralDetails.radioButtons6') and @value='_false']");
    this.interviewDate = page.locator("[placeholder='Enter past interview date']");

    // Page shell (header/footer/step indicator/sign-out) - shared across all
    // three Phase 1 sections. Confirmed live (2026-09-17).
    this.headerLogo   = page.locator('img.mx-name-staticImage1');
    this.accountIcon  = page.locator('img.mx-name-staticImage3');
    this.signOutBtn   = page.getByRole('button', { name: 'Sign out' });
    this.stepPersonalDetailsLabel      = page.getByText('Personal Details', { exact: false }).first();
    this.stepQualificationDetailsLabel = page.getByText('Qualification Details', { exact: false }).first();
    this.stepExperienceDetailsLabel    = page.getByText('Experience Details', { exact: false }).first();
    // Step-indicator CIRCLES (the numbered/checkmarked badge to the left of
    // each label above), for TC_51/53/88/89/90/91's step-progress
    // assertions. Confirmed live (2026-09-22): fixed Mendix widget names
    // (mx-name-containerNN), stable across renders since they're tied to a
    // specific position in the page design, not to a record - same
    // reasoning as this file's other mx-name-* class locators (e.g.
    // basicInfoSection below). A COMPLETED step's circle contains an <img>
    // checkmark (MankindUIResources check_2.svg); the CURRENT/active step
    // has the same purple background (rgb(50,43,124)) but no checkmark; a
    // not-yet-reached step carries an extra 'wizard-inactive' class and a
    // light grey background (rgb(213,226,231)) instead.
    this.stepPersonalDetailsCircle      = page.locator('.mx-name-container36');
    this.stepQualificationDetailsCircle = page.locator('.mx-name-container52');
    this.stepExperienceDetailsCircle    = page.locator('.mx-name-container41');
    // BY-LABEL step circles — added 2026-09-23 for the Qualification Details
    // "fast path" session helper (see Phase1.spec.js's
    // newPooledQualificationSessionFast()). The fixed mx-name-containerNN
    // classes above are NOT stable across the two different renders of this
    // wizard: confirmed live that the Personal Details page a candidate
    // lands on after a FRESH SIGN-IN numbers its circles
    // container49/45/52 (Personal/Qualification/Experience), whereas the
    // post-Next Qualification Details page numbers them container36/52/41.
    // So '.mx-name-container52' is Qualification's circle on one page and
    // Experience's on the other — clicking it after a fresh sign-in hits the
    // wrong (and inactive) step and silently does nothing.
    //
    // These locate the circle by its adjacent label text instead, which is
    // identical on both renders: each step is
    //   <div ... role="button"><span>N.</span></div><span>Step Label</span>
    // so the circle is the role=button div immediately preceding the label.
    // Left as ADDITIONS — the class-based locators above stay exactly as they
    // were, since TC_51/TC_53 already pass using them on the post-Next page.
    this.stepPersonalDetailsCircleByLabel      = page.locator("//span[normalize-space()='Personal Details']/preceding-sibling::div[@role='button'][1]");
    this.stepQualificationDetailsCircleByLabel = page.locator("//span[normalize-space()='Qualification Details']/preceding-sibling::div[@role='button'][1]");
    this.stepExperienceDetailsCircleByLabel    = page.locator("//span[normalize-space()='Experience Details']/preceding-sibling::div[@role='button'][1]");
    this.footerCopyright = page.getByText('© Mankind@2026. All rights reserved.', { exact: false });
    this.footerHelpline  = page.getByText('Helpline No.', { exact: false });

    // Section 1.1/1.2/1.3 collapsible groupboxes + their +/- toggle icons.
    // Confirmed live (2026-09-17): the icon's class includes
    // "mx-icon-substract" when the section is expanded and "mx-icon-add"
    // once collapsed.
    this.basicInfoSection            = page.locator('.mx-name-groupBox2');
    this.basicInfoToggleIcon         = this.basicInfoSection.locator('.mx-groupbox-collapse-icon').first();
    this.personalDetailsSection      = page.locator('.mx-name-groupBox4');
    this.personalDetailsToggleIcon   = this.personalDetailsSection.locator('.mx-groupbox-collapse-icon').first();
    this.generalDetailsSection       = page.locator('.mx-name-groupBox6');
    this.generalDetailsToggleIcon    = this.generalDetailsSection.locator('.mx-groupbox-collapse-icon').first();

    // Validation messages only render after a Next click attempt (same Mendix
    // pattern confirmed on the Signup form) — reused here for Phase 1 negative tests.
    this.validationMessages = page.locator(".mx-validation-message");
    // Mendix modal dialogs (both the "Changes have been saved successfully"
    // info dialog and genuine runtime-error dialogs) render as .mx-dialog,
    // separate from the inline .mx-validation-message field errors above.
    this.dialogMessage = page.locator(".mx-dialog");
  }

  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map(t => t.trim()).filter(Boolean))];
  }

  // Waits for whatever .mx-dialog appears after a Save click (success info
  // dialog or error dialog) and returns its text, then dismisses it so the
  // page is left in a clean, interactable state for whatever the test does
  // next. Escape reliably closes both dialog variants (confirmed live).
  async getDialogTextAndDismiss() {
    await this.dialogMessage.first().waitFor({ timeout: 10000 });
    const text = (await this.dialogMessage.first().textContent()).trim();
    await this.page.keyboard.press('Escape');
    return text;
  }

  async click_SaveBtn() {
    await this.saveBtn.scrollIntoViewIfNeeded();
    await this.saveBtn.click();
  }

  async clickOn_SignOut() {
    await this.signOutBtn.scrollIntoViewIfNeeded();
    await this.signOutBtn.click();
  }

  // Clicks a section's +/- collapse icon (basicInfoToggleIcon /
  // personalDetailsToggleIcon / generalDetailsToggleIcon). Confirmed live
  // (2026-09-17): a plain .click() on the icon itself doesn't always
  // register (same "Mendix click sometimes doesn't register" issue
  // documented elsewhere in this project), so this uses force:true, matching
  // how the live probe that discovered this toggle behavior worked reliably.
  async toggleSection(icon) {
    await icon.scrollIntoViewIfNeeded();
    await icon.click({ force: true });
  }

  async enter_FirstName(firstName) {
    await this.firstNamefield.fill(firstName);
  }

  async enter_MiddleName(middleName) {
    await this.middleNamefield.fill(middleName);
  }

  async enter_LastName(lastName) {
    await this.lastNamefield.fill(lastName);
  }

  async select_Role(role) {
    await this.role.click();
    await this.role.pressSequentially(role);
    await this.role.press('Enter');
  }

  async select_HQ(hqPreference) {
    await this.hQ_preference.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    await this.hQ_preference.scrollIntoViewIfNeeded();
  }

   async select_HQFlexible() {
    await this.hQ_flexible.scrollIntoViewIfNeeded();
    await this.hQ_flexible.click();
  }

   async select_HQNotFlexible() {
    await this.hQ_notflexible.scrollIntoViewIfNeeded();
    await this.hQ_notflexible.click();
  }



  async fill_ContactDetails(pan = 'ATBPV6191F', mobile = '9876543210') {
    await this.pancardField.fill(pan);
    await this.mobNo.fill(mobile);
  }

  async select_Gender() {
    await this.gender.scrollIntoViewIfNeeded();
    await this.gender.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  // selectMaritalStatus = false (new, optional, default true so every
  // existing caller is unaffected): skips selecting a Marital Status option,
  // leaving the native <select> on its blank default value - used by the
  // "Marital Status is mandatory" negative test, which needs DOB (and every
  // other field) validly filled while only Marital Status stays blank.
  async fill_PersonalDetails(dob = '2/2/1993', selectMaritalStatus = true) {
    await this.DOB.scrollIntoViewIfNeeded();
    await this.DOB.fill(dob);
    if (!selectMaritalStatus) return;
    await this.maritalStatus.scrollIntoViewIfNeeded();
    await this.maritalStatus.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  // Extra params (fatherOcc/fatherIncome/motherName/motherOcc/motherIncome)
  // are new and optional, each defaulting to its previous hardcoded value -
  // every existing call site (utils/createFreshInterviewCandidate.js's
  // no-args call, CandidateFlowHelpers.js's single-positional-arg call)
  // keeps its exact previous behavior unchanged.
  async fill_ParentDetails(fatherName = 'Amandeep Singh', fatherOcc = 'Service', fatherIncome = '500000', motherName = 'Kashish Kaur', motherOcc = 'Home Maker', motherIncome = '0') {
    await this.fatherName.scrollIntoViewIfNeeded();
    await this.fatherName.fill(fatherName);
    await this.fatherOcc.fill(fatherOcc);
    await this.fatherIncome.fill(fatherIncome);
    await this.motherName.fill(motherName);
    await this.motherOcc.fill(motherOcc);
    await this.motherIncome.fill(motherIncome);
  }

  // Confirmed live (2026-08-19): address line 1 has a 35-character cap. The
  // previous default ('D1075 7th Floor Dushyant Vihar Nagar', 37 chars) was
  // silently over that limit, so every Personal Details submission — valid
  // or not — was blocked by "Permanent address line 1 should be less than
  // 35 characters," regardless of which field a test was actually targeting.
  async fill_Address(addr1 = 'D1075 Dushyant Vihar Nagar', city = 'Delhi', pin = '110001') {
    await this.perAddLine1.scrollIntoViewIfNeeded();
    await this.perAddLine1.fill(addr1);
    await this.city.fill(city);
    await this.pin.fill(pin);
  }

  // selectState/selectDistrict = false (new, optional, both default true so
  // every existing caller is unaffected): let a caller skip State and/or
  // District entirely, leaving the native <select>(s) on their blank
  // default value - used by the "State/District is mandatory" negative
  // tests, which need every other Permanent Address field validly filled
  // while only State (or only District, with State validly chosen) stays
  // blank. Skipping State implies skipping District too, since District has
  // no real options to choose from until a State is selected (confirmed live).
  async select_StateDistrict(hardWait, selectState = true, selectDistrict = true) {
    if (!selectState) return;
    await this.state.scrollIntoViewIfNeeded();
    await this.state.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    if (!selectDistrict) return;
    await hardWait(3);
    await this.district.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  // Confirmed live (2026-09-22): once a candidate account has successfully
  // completed Personal Details at least once (e.g. by reaching Qualification
  // Details via a real "Next"), this checkbox comes back CHECKED on the next
  // sign-in - a plain unconditional .click() here then UNCHECKS it instead of
  // checking it, silently clearing Current Address and turning every one of
  // its fields "mandatory" again. Every real caller only ever wants this
  // checked (see the 3 call sites: fillValidPersonalDetails's unconditional
  // branch, createFreshInterviewCandidate.js, and TC_25's own direct call,
  // none of which ever want a toggle-OFF) so this is now idempotent - a
  // behavior fix, not a semantic change, and a no-op for the previous
  // always-starts-unchecked case every existing caller was written against.
  async click_PerAddRadioBtn() {
    await this.perAddRadioBtn.scrollIntoViewIfNeeded();
    const alreadyChecked = await this.perAddRadioBtn.isChecked().catch(() => false);
    if (!alreadyChecked) {
      await this.perAddRadioBtn.click();
    }
  }

    async fillCurrentAddress() {
    await this.currAddLine1.scrollIntoViewIfNeeded();
    await this.currAddLine1.fill('Flat No. 204, Green Residency');
    await this.currCity.fill('Gujarat');
    await this.currPin.fill('136131');
  }


  // See select_StateDistrict() above for selectState/selectDistrict.
  async selectCurr_StateDistrict(hardWait, selectState = true, selectDistrict = true) {
    if (!selectState) return;
    await this.currState.scrollIntoViewIfNeeded();
    await this.currState.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    if (!selectDistrict) return;
    await hardWait(3);
    await this.currDistrict.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  async select_vehicleNum_yes(vehicleNumber = 'HR26DE1433') {
    await this.vehicleNumToggleyes.scrollIntoViewIfNeeded();
    await this.vehicleNumToggleyes.click();
    await this.vehicleNum.fill(vehicleNumber);
  }

   async select_vehicleNum_no() {
    await this.vehicleNumToggleno.scrollIntoViewIfNeeded();
    await this.vehicleNumToggleno.click();
  }

  async select_InterviewDate(date = '1/1/2024') {
    await this.interviewDate_Toggle.scrollIntoViewIfNeeded();
    await this.interviewDate_Toggle.click();
    await this.interviewDate.fill(date);
  }

   async select_No_InterviewDate() {
    await this.interviewDate_Toggle_No.scrollIntoViewIfNeeded();
    await this.interviewDate_Toggle_No.click();
  }

  async click_NextBtn() {
    await this.nextBtn.scrollIntoViewIfNeeded();
    await this.nextBtn.click();
  }
}

// pages/ITAP_QualificationDetailsPage.js — equivalent to ITAP_QualificationDetailsPage.java
class ITAP_QualificationDetailsPage {
  constructor(page) {
    this.page = page;

    this.Xth_FromDate      = page.locator("(//*[@placeholder='dd/mm/yyyy'])[1]");
    this.Xth_ToDate        = page.locator("(//*[@placeholder='dd/mm/yyyy'])[2]");
    this.Xth_Marks         = page.locator("(//*[@placeholder='Enter marks in percent'])[1]");
    this.XII_FromDate      = page.locator("(//*[@placeholder='dd/mm/yyyy'])[3]");
    this.XII_ToDate        = page.locator("(//*[@placeholder='dd/mm/yyyy'])[4]");
    this.XII_Marks         = page.locator("(//*[@placeholder='Enter marks in percent'])[2]");
    this.graduation_course = page.locator("input.widget-combobox-input[role='combobox'][id*='Snip_Qualification.comboBox1']").first();
    this.graduation_FromDate = page.locator("(//*[@placeholder='dd/mm/yyyy'])[5]");
    this.graduation_ToDate   = page.locator("(//*[@placeholder='dd/mm/yyyy'])[6]");
    this.graduation_Type     = page.locator("//*[contains(@id,'Snip_Qualification.dropDown3')]").first();
    this.graduation_Marks    = page.locator("(//*[@placeholder='Enter marks in percent'])[3]");
    // Specialization fields (10th/12th/Graduation/Additional Qualification) —
    // confirmed live (2026-09-22): placeholder "Enter specialization",
    // appearing in DOM order 10th, 12th, Graduation, then one more per
    // Additional Qualification block added. Not previously in this file —
    // the TC_01-50 pass never needed them.
    this.Xth_Specialization         = page.locator("(//*[@placeholder='Enter specialization'])[1]");
    this.XII_Specialization         = page.locator("(//*[@placeholder='Enter specialization'])[2]");
    this.graduation_Specialization  = page.locator("(//*[@placeholder='Enter specialization'])[3]");
    this.addcourse_Specialization   = page.locator("(//*[@placeholder='Enter specialization'])[4]");
    this.addcourseBtn       = page.getByRole('button', { name: 'Add Qualification' }).first();
    this.additional_course = page.locator("input.widget-combobox-input[role='combobox'][id*='Snip_Qualification.comboBox1']").nth(1);
    this.additionalQualificationHeader = page.locator("h6:has-text('Additional Qualification')");
    this.addcourse_FromDate = page.locator("(//*[@placeholder='dd/mm/yyyy'])[7]");
    this.addcourse_ToDate   = page.locator("(//*[@placeholder='dd/mm/yyyy'])[8]");
    this.addcourse_Type     = page.locator("//*[contains(@id,'Snip_Qualification.dropDown3')]").nth(1);
    this.addcourse_Marks    = page.locator("(//*[@placeholder='Enter marks in percent'])[4]");

    // Every qualification block (Graduation + each Additional Qualification)
    // renders exactly one Course combobox input, so counting these is the
    // most reliable "how many blocks are on the page" signal available.
    // Deliberately NOT additionalQualificationHeader: that h6-based locator
    // matched ZERO elements in a live probe (2026-09-23) even while "Add
    // Qualification" clicks were demonstrably succeeding, so it cannot be
    // trusted as a block-presence signal. Added 2026-09-23 for TC_79-TC_83.
    this.qualificationCourseInputs = page.locator("input.widget-combobox-input[role='combobox'][id*='Snip_Qualification.comboBox1']");

    // CONFIRMED LIVE (2026-09-23, TC_81/TC_82 pass). The per-block delete
    // control is NOT a <button> at all - which is why the earlier best-effort
    // union of button/glyphicon/trash shapes matched zero elements. It is a
    // Mendix static image widget rendered as:
    //
    //   <img class="mx-image mx-name-staticImage3 spacing-outer-right-medium
    //              img-responsive"
    //        src=".../AppointementModule$Image_collection$delete_FILL0_wght300
    //             _GRAD0_opsz24.svg?<cachebuster>"
    //        role="button" style="cursor: pointer;">
    //
    // Matched on role="button" + a "delete" src rather than on
    // mx-name-staticImage3, because the page carries other static images
    // (mx-name-staticImage1 in the header) and the src is the part that
    // actually names the action. The `?<cachebuster>` query string on the src
    // rules out an exact-match selector, hence *=.
    //
    // Confirmed live: this renders ONLY on Additional Qualification blocks -
    // count is 0 with Graduation alone and grows by exactly one per added
    // block - so Graduation itself has no delete control and .last() is
    // always an additional block.
    this.qualificationRemoveButtons = page.locator("img.mx-image[role='button'][src*='delete']");

    // 10th/12th/Graduation section collapse toggles — same
    // mx-groupbox-collapse-icon pattern Personal Details already uses.
    // Confirmed live (2026-09-22): unlike Personal Details' sections, the
    // <h6 class="mx-groupbox-header"> IS the header itself (not wrapped in a
    // separate header container), with the collapse <i> icon as its own
    // first child, e.g. `<h6 class="mx-groupbox-header"><i
    // class="...mx-groupbox-collapse-icon..."/>10th</h6>` - so this locates
    // the icon as a CHILD of the heading text, not an ancestor's descendant.
    // All three sections are rendered via the same Mendix list view
    // (mx-name-listView11, one row per section) and so share one outer
    // widget name (mx-name-groupBox6) - a fixed class number (like Personal
    // Details' basicInfoSection) can't tell them apart, hence the by-text
    // lookup.
    // Graduation Course combobox's own "Clear selection" button (the little
    // x inside the widget). Confirmed live (2026-09-23): the Mendix combobox
    // renders it only while a value IS selected, so callers must tolerate a
    // count of 0. Scoped to the FIRST Snip_Qualification.comboBox1 widget
    // (Graduation's own — the Additional Qualification blocks reuse the same
    // id fragment), matching this.graduation_course's own .first().
    // Needed because Qualification Details fields persist per-field on the
    // pooled candidate (see clear_XthDetails()'s comment), so a
    // "Course left unselected" negative test has to actively clear a stale
    // course rather than simply not touching it.
    this.graduation_course_clearBtn = page
      .locator('div.widget-combobox')
      .filter({ has: page.locator("input[id*='Snip_Qualification.comboBox1']") })
      .first()
      .locator('button.widget-combobox-clear-button');

    this.tenthToggleIcon = page.locator("//h6[normalize-space()='10th']/i[contains(@class,'mx-groupbox-collapse-icon')]");
    this.twelfthToggleIcon = page.locator("//h6[normalize-space()='12th']/i[contains(@class,'mx-groupbox-collapse-icon')]");
    this.graduationToggleIcon = page.locator("//h6[normalize-space()='Graduation']/i[contains(@class,'mx-groupbox-collapse-icon')]");

    this.nextBtn             = page.locator("//*[contains(@data-button-id, 'Qualification_Details.actionButton15')]");
    this.saveBtn             = page.locator("//*[contains(@data-button-id, 'Qualification_Details.actionButton13')]");

    // Same Mendix validation-message pattern used on Signup/Phase 1.
    this.validationMessages = page.locator(".mx-validation-message");
    this.dialogMessage = page.locator(".mx-dialog");
  }

  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map(t => t.trim()).filter(Boolean))];
  }

  // See ITAPInterviewPerformaPage.getDialogTextAndDismiss() for details.
  async getDialogTextAndDismiss() {
    await this.dialogMessage.first().waitFor({ timeout: 10000 });
    const text = (await this.dialogMessage.first().textContent()).trim();
    await this.page.keyboard.press('Escape');
    return text;
  }

  async click_SaveBtn() {
    await this.saveBtn.scrollIntoViewIfNeeded();
    await this.saveBtn.click();
  }

  // Mirrors ITAPInterviewPerformaPage.toggleSection() - same "force:true"
  // click needed for this Mendix +/- collapse icon to register reliably
  // (see that method's own comment).
  async toggleSection(icon) {
    await icon.scrollIntoViewIfNeeded();
    await icon.click({ force: true });
  }

  // Public wrapper around the private _selectCourseOption() helper, for
  // tests that need to choose a SPECIFIC Graduation Course option (e.g. the
  // Course-mandatory negative test needs to leave it unselected instead;
  // other tests just need any valid option, already covered by
  // fill_graduationDetails()'s own default).
  async selectGraduationCourse(courseText) {
    await this._selectCourseOption(this.graduation_course, courseText);
  }

  // specialization = new, optional (default '' = leave blank, matching every
  // existing caller's previous behavior exactly - none of them ever touched
  // Specialization, which TC_01-50 never needed).
  async fill_XthDetails(fromDate = '02/02/2010', toDate = '02/02/2011', marks = '80', specialization = '') {
    await this.Xth_FromDate.waitFor();
    await this.Xth_FromDate.fill(fromDate);
    await this.Xth_ToDate.fill(toDate);
    await this.Xth_Marks.fill(marks);
    if (specialization) await this.Xth_Specialization.fill(specialization);
    await this.page.keyboard.press('Tab');
  }

  // Confirmed live (2026-09-22): unlike Personal Details, Qualification
  // Details' fields persist per-field as soon as they're touched -
  // independent of whether a later Next/Save succeeds - so the POOLED
  // candidate can carry stale 10th/12th values in from an EARLIER test in
  // this same suite even though the current test never calls
  // fill_XthDetails()/fill_XIIthDetails() itself. Used by
  // fillValidQualification()'s skipXth/skipXII to actively blank the
  // section instead of just not touching it, so "leave 10th/12th blank"
  // tests (TC_55/TC_60) get a real blank section regardless of what the
  // pooled account happened to have saved from a previous test.
  async clear_XthDetails() {
    await this.Xth_FromDate.waitFor();
    await this.Xth_FromDate.fill('');
    await this.Xth_ToDate.fill('');
    await this.Xth_Marks.fill('');
    await this.Xth_Specialization.fill('');
    await this.page.keyboard.press('Tab');
  }

  async clear_XIIthDetails() {
    await this.XII_FromDate.waitFor();
    await this.XII_FromDate.fill('');
    await this.XII_ToDate.fill('');
    await this.XII_Marks.fill('');
    await this.XII_Specialization.fill('');
    await this.page.keyboard.press('Tab');
  }

  async fill_XIIthDetails(fromDate = '02/02/2012', toDate = '02/02/2013', marks = '85', specialization = '') {
    await this.XII_FromDate.waitFor();
    await this.XII_FromDate.fill(fromDate);
    await this.XII_ToDate.fill(toDate);
    await this.XII_Marks.fill(marks);
    if (specialization) await this.XII_Specialization.fill(specialization);
    await this.page.keyboard.press('Tab');
  }

  // course/type/specialization = new, optional, each defaulting to the exact
  // previous hardcoded behavior (course 'B.Sc', type = whatever the first
  // ArrowDown lands on - confirmed live 2026-09-22 to be "Distance", the
  // native <select>'s first real option - specialization blank) so every
  // existing caller (fillValidQualification, TC_37/TC_39's flow via
  // reachOtherDetailsPage) is unaffected.
  async fill_graduationDetails(fromDate = '02/02/2014', toDate = '02/02/2018', marks = '90', course = 'B.Sc', type = null, specialization = '') {
    await this.page.mouse.wheel(0, 800);
    await this.graduation_FromDate.scrollIntoViewIfNeeded();
    await this.graduation_course.waitFor();
    await this._selectCourseOption(this.graduation_course, course);
    await this.graduation_FromDate.waitFor();
    await this.graduation_FromDate.fill(fromDate);
    await this.graduation_ToDate.fill(toDate);
    if (type) {
      await this.graduation_Type.selectOption({ label: type });
    } else {
      await this.graduation_Type.click();
      await this.page.keyboard.press('ArrowDown');
      await this.page.keyboard.press('Enter');
    }
    await this.graduation_Marks.fill(marks);
    if (specialization) await this.graduation_Specialization.fill(specialization);
    await this.page.keyboard.press('Tab');
  }

  // Fills Graduation with valid data EXCEPT the one field named by `omit`,
  // which is actively CLEARED instead. Added 2026-09-23 for the Graduation
  // mandatory-field negative tests (TC_66-TC_70).
  //
  // Why clearing (not merely skipping) is required: Qualification Details
  // fields persist per-field on the server as soon as they're touched, so
  // the pooled candidate reliably carries a previous test's Graduation
  // values in (confirmed live 2026-09-23 — a fresh sign-in showed B.Sc. /
  // 02/02/2014 / 02/02/2018 / 90.00 / Regular already populated). Simply not
  // filling a field would leave that stale value in place and the
  // "mandatory" assertion would never actually be exercised. This mirrors
  // clear_XthDetails()/clear_XIIthDetails()'s existing reasoning.
  //
  // `omit` is one of: 'course' | 'from' | 'to' | 'type' | 'marks' (null =
  // fill everything, i.e. identical to fill_graduationDetails()).
  //
  // Deliberately a SEPARATE method rather than a new parameter on
  // fill_graduationDetails(): that one is already called by
  // fillValidQualification() and by TC_37/TC_39's full-submission flow, and
  // TC_01-60 must keep passing untouched.
  async fill_graduationDetailsOmitting(omit = null, opts = {}) {
    const {
      fromDate = '02/02/2014', toDate = '02/02/2018', marks = '90',
      course = 'B.Sc', type = 'Regular', specialization = '',
    } = opts;

    await this.page.mouse.wheel(0, 800);
    await this.graduation_FromDate.scrollIntoViewIfNeeded();
    await this.graduation_course.waitFor();

    if (omit === 'course') {
      // The clear button only renders while something IS selected; a
      // count of 0 just means the field was already empty.
      if (await this.graduation_course_clearBtn.count() > 0) {
        await this.graduation_course_clearBtn.click({ force: true });
      }
    } else {
      await this._selectCourseOption(this.graduation_course, course);
    }

    await this.graduation_FromDate.waitFor();
    await this.graduation_FromDate.fill(omit === 'from' ? '' : fromDate);
    await this.graduation_ToDate.fill(omit === 'to' ? '' : toDate);

    // Confirmed live (2026-09-23): Graduation "Type" is a plain native
    // <select> whose options are ['', 'Distance', 'Regular'] — so the blank
    // first option is what "unselected" means here, and selectOption('')
    // is the way to get back to it.
    await this.graduation_Type.selectOption(omit === 'type' ? '' : type);

    await this.graduation_Marks.fill(omit === 'marks' ? '' : marks);
    if (specialization) await this.graduation_Specialization.fill(specialization);
    await this.page.keyboard.press('Tab');
  }

  async fill_additionalQualificationDetails() {
    await this.addcourseBtn.scrollIntoViewIfNeeded();

    // Confirmed live (repeatedly, this project): clicking "Add Qualification"
    // can silently not register - the same "Mendix click sometimes doesn't
    // register" issue documented elsewhere in this project. The old code
    // here did a single click then an UNBOUNDED scrollIntoViewIfNeeded() on
    // the resulting header, which - if the click didn't register - wasn't
    // just slow, it hung for the app's full default action timeout (long
    // enough to blow through even a 10-minute test hook budget). Verify the
    // header actually appeared (short, bounded check) before proceeding,
    // and retry the click a few times rather than waiting once indefinitely.
    let headerAppeared = false;
    for (let attempt = 0; attempt < 4 && !headerAppeared; attempt++) {
      await this.addcourseBtn.click();
      headerAppeared = await this.additionalQualificationHeader
        .scrollIntoViewIfNeeded({ timeout: 5000 })
        .then(() => true)
        .catch(() => false);
    }
    if (!headerAppeared) {
      throw new Error('fill_additionalQualificationDetails(): "Additional Qualification" section never appeared after 4 click attempts.');
    }

    await this._selectCourseOption(this.additional_course, 'B.Com.');
    await this.addcourse_FromDate.waitFor();
    await this.addcourse_FromDate.fill('02/02/2019');
    await this.addcourse_ToDate.fill('02/02/2020');
    await this.addcourse_Type.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    await this.addcourse_Marks.fill('82');
    await this.page.keyboard.press('Tab');
  }

  // TC-024: a second "Add Qualification" click reveals a third combobox
  // instance (graduation=.first(), first additional=.nth(1)) — nth(2) here.
  async fill_secondAdditionalQualificationDetails() {
    await this.addcourseBtn.scrollIntoViewIfNeeded();
    await this.addcourseBtn.click();
    const secondCourse = this.page.locator("input.widget-combobox-input[role='combobox'][id*='Snip_Qualification.comboBox1']").nth(2);
    const secondFromDate = this.page.locator("(//*[@placeholder='dd/mm/yyyy'])[9]");
    const secondToDate = this.page.locator("(//*[@placeholder='dd/mm/yyyy'])[10]");
    const secondType = this.page.locator("//*[contains(@id,'Snip_Qualification.dropDown3')]").nth(2);
    const secondMarks = this.page.locator("(//*[@placeholder='Enter marks in percent'])[5]");

    await this._selectCourseOption(secondCourse, 'M.Com.');
    await secondFromDate.waitFor();
    await secondFromDate.fill('02/02/2021');
    await secondToDate.fill('02/02/2022');
    await secondType.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    await secondMarks.fill('75');
    await this.page.keyboard.press('Tab');
  }

  // ---- Additions for TC_71-TC_91 (2026-09-23) ----
  // All purely additive: nothing above this point changed, so TC_01-TC_70
  // and TC_119 keep behaving exactly as before.

  // How many qualification blocks are currently rendered: 1 (Graduation) +
  // one per Additional Qualification block. See qualificationCourseInputs'
  // own comment for why the Course combobox is the counted widget.
  async qualificationBlockCount() {
    return this.qualificationCourseInputs.count();
  }

  // True when "+ Add Qualification" is in its disabled state. Checks three
  // shapes on purpose: Mendix buttons can be disabled via the native
  // `disabled` attribute, via aria-disabled, or (for some widget styles)
  // purely via a `disabled`/`btn-disabled` class. Only the LIVE pass can say
  // which one this button uses (the probe that confirmed the cap only
  // reported "became disabled"), so all three are accepted.
  async isAddQualificationDisabled() {
    if (await this.addcourseBtn.isDisabled().catch(() => false)) return true;
    const cls = (await this.addcourseBtn.getAttribute('class').catch(() => '')) || '';
    const aria = (await this.addcourseBtn.getAttribute('aria-disabled').catch(() => '')) || '';
    return /disabled/i.test(cls) || aria === 'true';
  }

  // Clicks "+ Add Qualification" and returns the resulting block count.
  // Retries the click (the documented "Mendix click sometimes doesn't
  // register" issue - see fill_additionalQualificationDetails()), verifying
  // by the block COUNT actually growing rather than by the untrustworthy
  // additionalQualificationHeader. Returns the unchanged count instead of
  // throwing when the block never appears, so a caller testing the cap can
  // simply stop.
  async clickAddQualification({ attempts = 3, timeout = 6000 } = {}) {
    const before = await this.qualificationBlockCount();
    for (let i = 0; i < attempts; i++) {
      await this.addcourseBtn.scrollIntoViewIfNeeded().catch(() => {});
      await this.addcourseBtn.click({ force: true }).catch(() => {});
      const grew = await this.page
        .waitForFunction(
          ({ sel, n }) => document.querySelectorAll(sel).length > n,
          { sel: "input.widget-combobox-input[role='combobox'][id*='Snip_Qualification.comboBox1']", n: before },
          { timeout, polling: 150 },
        )
        .then(() => true)
        .catch(() => false);
      if (grew) return this.qualificationBlockCount();
    }
    return before;
  }

  // Adds Additional Qualification blocks until `target` TOTAL blocks exist
  // (total = 1 Graduation + N additional), FILLING each block as it is added,
  // and returns the final block count.
  //
  // Why the filling is not optional: "Add Qualification" only produces a new
  // block when every block already on the page is filled. With a blank block
  // sitting there, clicking Add instead fires validation on that block's own
  // mandatory fields ("Select From Date", "Select To Date", "Select
  // Qualification Type", "Please enter valid Percentage of Marks") and adds
  // nothing - correct, well-signposted behaviour, confirmed by the user's
  // screenshot 2026-09-24.
  //
  // A naive "click Add repeatedly" loop therefore stalls at 2 blocks. If the
  // caller isn't looking at validation messages it looks indistinguishable
  // from having hit a cap - which is exactly what the 2026-09-22 throwaway
  // probe got wrong when it reported the button "becoming disabled after 9
  // clicks". Note an earlier revision of this comment called the behaviour a
  // "silent no-op with no validation message"; that was wrong, the messages
  // are there.
  //
  // Each block gets a distinct From/To year pair so no cross-block date rule
  // can interfere.
  async addFilledQualificationBlocksUntil(target, { maxAttempts = 30 } = {}) {
    let count = await this.qualificationBlockCount();
    for (let i = 0; i < maxAttempts && count < target; i++) {
      const grown = await this.clickAddQualification();
      if (grown <= count) return grown; // genuinely refused to add - caller decides
      count = grown;
      await this.fill_nthAdditionalQualification(count - 1, {
        course: 'B.Com.',
        fromDate: `02/02/${2000 + count}`,
        toDate: `02/02/${2001 + count}`,
        marks: '80',
      });
    }
    return this.qualificationBlockCount();
  }

  // Opens the Graduation Course combobox and returns every option it renders,
  // then closes it again.
  //
  // VIRTUALISATION: confirmed live (2026-09-23) NOT to be an issue. The popup
  // is <ul class="widget-combobox-menu-list widget-combobox-menu-lazy-scroll">
  // and despite the "lazy-scroll" class it renders all 65 <li role="option">
  // elements up front (scrollHeight 2080 vs clientHeight 320 - it scrolls, but
  // nothing is withheld from the DOM). So no scroll-while-collecting is
  // needed.
  //
  // WHAT WAS ACTUALLY BROKEN (fixed 2026-09-23): this used to do a single
  // click, one waitFor, then allTextContents() - three separate round trips.
  // Live, that returned an EMPTY array: the same "Mendix click sometimes
  // doesn't register" flakiness documented throughout this file also shows up
  // here as a popup that opens and is torn down again by a re-render between
  // the waitFor and the read, and a bare allTextContents() has no retry of its
  // own. Now the open is retried, and the option texts are captured in ONE
  // atomic in-page read via waitForFunction so the popup cannot close
  // mid-read.
  async getGraduationCourseOptions({ attempts = 4, timeout = 10000 } = {}) {
    const OPTION_SEL = "li[role='option'], [role='option']";
    for (let i = 0; i < attempts; i++) {
      await this.graduation_course.scrollIntoViewIfNeeded().catch(() => {});
      await this.graduation_course.click({ force: true }).catch(() => {});

      const handle = await this.page
        .waitForFunction(
          (sel) => {
            const opts = document.querySelectorAll(sel);
            if (!opts.length) return null;
            const texts = Array.from(opts).map(o => o.textContent.trim()).filter(Boolean);
            return texts.length ? texts : null;
          },
          OPTION_SEL,
          { timeout, polling: 150 },
        )
        .catch(() => null);

      if (handle) {
        const texts = await handle.jsonValue();
        await this.page.keyboard.press('Escape').catch(() => {});
        return texts;
      }
      // Popup never opened (or opened empty) - make sure nothing is left half
      // open before the next attempt.
      await this.page.keyboard.press('Escape').catch(() => {});
    }
    throw new Error(
      `getGraduationCourseOptions(): the Graduation Course combobox never rendered any `
      + `options after ${attempts} open attempts.`,
    );
  }

  // Graduation "Type" is a plain native <select> (confirmed live 2026-09-23 -
  // see fill_graduationDetailsOmitting()'s comment), so its options can be
  // read without opening anything. The blank placeholder option is filtered
  // out, matching how TC_10/TC_15 already read the Role/Marital Status
  // dropdowns.
  async getGraduationTypeOptions() {
    return (await this.graduation_Type.locator('option').allTextContents())
      .map(t => t.trim())
      .filter(Boolean);
  }

  // Field locators for the Nth Additional Qualification block (n = 1 is the
  // first one added). Derived from the SAME indexing the existing
  // addcourse_* / fill_secondAdditionalQualificationDetails() locators
  // already use - for n = 1 these are byte-for-byte the existing
  // addcourse_FromDate/[7], addcourse_ToDate/[8], addcourse_Marks/[4],
  // addcourse_Specialization/[4], addcourse_Type/nth(1) locators; for n = 2
  // they match fill_secondAdditionalQualificationDetails()'s [9]/[10]/[5]/
  // nth(2). Generalised so TC_79-TC_83 can address whichever block they just
  // added without hardcoding a third and fourth copy.
  additionalQualificationFields(n = 1) {
    return {
      course: this.qualificationCourseInputs.nth(n),
      fromDate: this.page.locator(`(//*[@placeholder='dd/mm/yyyy'])[${5 + 2 * n}]`),
      toDate: this.page.locator(`(//*[@placeholder='dd/mm/yyyy'])[${6 + 2 * n}]`),
      type: this.page.locator("//*[contains(@id,'Snip_Qualification.dropDown3')]").nth(n),
      marks: this.page.locator(`(//*[@placeholder='Enter marks in percent'])[${3 + n}]`),
      specialization: this.page.locator(`(//*[@placeholder='Enter specialization'])[${3 + n}]`),
    };
  }

  // Fills the Nth Additional Qualification block with valid data EXCEPT the
  // one field named by `omit`, which is left blank - the same shape (and the
  // same reasoning) as fill_graduationDetailsOmitting() above.
  // `omit` is one of: 'course' | 'from' | 'to' | 'type' | 'marks' | null.
  async fill_nthAdditionalQualification(n = 1, opts = {}) {
    const {
      omit = null, course = 'B.Com.', fromDate = '02/02/2019', toDate = '02/02/2020',
      type = 'Regular', marks = '82', specialization = '',
    } = opts;
    const f = this.additionalQualificationFields(n);

    await f.course.waitFor({ timeout: 10000 });
    await f.course.scrollIntoViewIfNeeded().catch(() => {});
    if (omit !== 'course') await this._selectCourseOption(f.course, course);

    await f.fromDate.fill(omit === 'from' ? '' : fromDate);
    await f.toDate.fill(omit === 'to' ? '' : toDate);
    await f.type.selectOption(omit === 'type' ? '' : type);
    await f.marks.fill(omit === 'marks' ? '' : marks);
    if (specialization) await f.specialization.fill(specialization);
    await this.page.keyboard.press('Tab');
  }

  // Removes the LAST Additional Qualification block via its own delete/trash
  // control and returns the resulting block count.
  //
  // *** Depends on the UNVERIFIED qualificationRemoveButtons locator - see
  // its comment in the constructor. *** Throws an explicit, self-describing
  // error when nothing matches, so a live failure reads as "the locator is
  // wrong" rather than as a silent timeout.
  async removeLastAdditionalQualification() {
    const before = await this.qualificationBlockCount();
    const count = await this.qualificationRemoveButtons.count();
    if (count === 0) {
      throw new Error(
        'removeLastAdditionalQualification(): no delete/trash control matched '
        + 'qualificationRemoveButtons. That locator has never been confirmed live '
        + '- capture the real markup of the Additional Qualification block\'s trash '
        + 'icon and update pages/Candidate/Phase1.js.',
      );
    }
    const target = this.qualificationRemoveButtons.last();
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.click({ force: true });

    // Confirmed by the user (screenshot, 2026-09-23): deleting does NOT remove
    // the block outright - it first opens a "Confirmation" dialog reading "Are
    // you sure you want to delete this record?" with Yes/No buttons. Without
    // clicking Yes the block stays put and the caller's count check fails for
    // a misleading reason. Kept tolerant (best-effort, short timeout) so that
    // if the dialog is ever skipped for some block type this still proceeds to
    // the count check rather than hard-failing here.
    // CONFIRMED LIVE 2026-09-23. The dialog is
    //   <div role="dialog" class="modal-dialog mx-dialog"
    //        id="mxui_widget_ConfirmationDialog_0">
    // with caption "Confirmation", body "Are you sure you want to delete this
    // record?" and two buttons, "Yes" (btn btn-primary) and "No" (btn).
    //
    // FIXED 2026-09-23 (this is what made TC_81/TC_82 fail live): the guard
    // below used `isVisible({ timeout: 5000 })`. Playwright IGNORES the
    // timeout option on isVisible() - it is a deprecated no-op - so this was
    // an instantaneous check fired microseconds after the delete click, long
    // before Mendix had rendered the dialog. It therefore returned false every
    // time, Yes was never clicked, the block was never removed, and the caller
    // saw an unchanged block count. Switched to waitFor(), which genuinely
    // waits. Still tolerant (best effort) so that a block type which somehow
    // skips the confirmation still falls through to the count check.
    const confirmYes = this.page
      .locator("div[role='dialog'], .mx-dialog")
      .filter({ hasText: 'Are you sure you want to delete this record?' })
      .getByRole('button', { name: 'Yes', exact: true });
    const appeared = await confirmYes
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      await confirmYes.click();
    }

    await this.page
      .waitForFunction(
        ({ sel, n }) => document.querySelectorAll(sel).length < n,
        { sel: "input.widget-combobox-input[role='combobox'][id*='Snip_Qualification.comboBox1']", n: before },
        { timeout: 6000, polling: 150 },
      )
      .catch(() => {});
    return this.qualificationBlockCount();
  }

  async click_NextBtn() {
    await this.nextBtn.click();
  }

  async _selectCourseOption(input, preferredValue) {
    const preferredOption = this.page.locator(`//*[@role='option' and contains(normalize-space(), '${preferredValue}')]`).first();
    const anyOption = this.page.locator("//*[@role='option']").first();

    // Fixed 2026-09-23 (found live by TC_76): the retry loop below could never
    // actually retry the case it most needed to. The popup-open waitFor was
    // unguarded, so when the "Mendix click sometimes doesn't register" issue
    // hit - the click going nowhere and the option list never appearing - the
    // waitFor THREW straight out of the loop on attempt 0 instead of falling
    // through to attempt 1. TC_76 failed exactly that way ("waiting for
    // locator //*[@role='option'] to be visible") while the surrounding tests
    // passed. The open is now a non-throwing check that simply moves on to the
    // next attempt, and the attempt count is raised from 2 to 4 (this widget
    // is the flakiest control on the page). Behaviour on the happy path - a
    // popup that opens on the first click - is unchanged, so TC_01-TC_70 and
    // TC_119 are unaffected.
    for (let attempt = 0; attempt < 4; attempt++) {
      await input.click({ timeout: 10000, force: true }).catch(() => {});
      const opened = await anyOption.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      if (!opened) {
        // Leave nothing half-open before re-clicking.
        await this.page.keyboard.press('Escape').catch(() => {});
        continue;
      }

      if (await preferredOption.count() > 0) {
        await preferredOption.click({ timeout: 10000 });
      } else {
        await anyOption.click({ timeout: 10000 });
      }

      await input.press('Tab');
      const selected = await input.inputValue();
      if (selected && selected.trim() !== '') return;
    }

    throw new Error('Unable to select a value for Graduation Course.');
  }
}

// pages/ITAP_ExperienceDetailPage.js — equivalent to ITAP_ExperienceDetailPage.java
class ITAP_ExperienceDetailPage {
  constructor(page) {
    this.page = page;
    this.experienceDetail_yes     = page.locator("(//*[contains(@name,'Experience_Details.radioButtons6')])[1]");
    this.experienceDetail_No    = page.locator("(//*[contains(@name,'Experience_Details.radioButtons6')])[2]");
    this.confirmationMsg      = page.locator("//*[@class='btn btn-primary' and text()='Yes']");
    this.acceptanceBtn        = page.locator("//*[@class='btn btn-primary' and text()='OK']");
    this.submitBtn            = page.locator("//*[contains(@data-button-id,'Experience_Details.actionButton18')]");
    this.confirmationRadioBtn = page.locator("//*[contains(@id,'Experience_Details.checkBox1')]");
    this.companyNameInput       = page.locator("//*[@placeholder='Enter company name']");
    this.Annualpackage      = page.locator("//*[@placeholder='Enter annual package']");
    this.designation         = page.locator("//*[@placeholder='Enter designation']");
    this.HQ       = page.locator("//*[@placeholder='Enter Head Quarter']");
    // Confirmed live (2026-09-24) by dumping every input on this section:
    // From = Snip_ExperienceDetails.datePicker4, To = datePicker5.
    //
    // These were previously indexed off the placeholder —
    // (//*[@placeholder='dd/mm/yyyy'])[1] and [2] — which breaks the moment
    // "Currently working here?" is checked: the app DISABLES the To field and
    // CLEARS its placeholder, so only From still carries 'dd/mm/yyyy' and the
    // [2] index matches nothing at all. Anchoring on the Mendix id instead
    // works in both the enabled and disabled states.
    this.FromDate  = page.locator("//input[contains(@id,'Snip_ExperienceDetails.datePicker4')]");
    this.ToDate    = page.locator("//input[contains(@id,'Snip_ExperienceDetails.datePicker5')]");
    this.reasonofleaving = page.locator("//*[@placeholder='Enter reason of leaving']");
    this.currentlyWorkingHere = page.locator("//*[contains(@id,'Snip_ExperienceDetails.checkBox1')]");
    this.saveBtn = page.locator("//*[contains(@data-button-id, 'Experience_Details.actionButton13')]");
    // Confirmed live (2026-09-11): mirrors Qualification Details' "Add
    // Qualification" - reveals a second, independent set of experience
    // fields (a second companyNameInput/Annualpackage/etc. instance) rather
    // than replacing the first, never exercised by any existing test.
    this.addExperienceBtn = page.locator("//button[contains(@data-button-id,'Experience_Details.actionButton36')]");

    // Same Mendix validation-message pattern used on Signup/Phase 1.
    this.validationMessages = page.locator(".mx-validation-message");
    this.dialogMessage = page.locator(".mx-dialog");

    // ---- Added 2026-09-24 for the TC_92-TC_105 batch ----
    // The "3.1 Work Experience" collapsible groupbox and its +/- toggle
    // icon. Confirmed live (2026-09-24) by dumping every [class*=mx-name-
    // groupBox] on this page: section 3 renders exactly ONE groupbox,
    // mx-name-groupBox9, header "3.1 Work Experience", whose collapse icon
    // carries mx-icon-substract while expanded and mx-icon-add once
    // collapsed - the identical pattern already used for 1.1/1.2/1.3 and
    // 10th/12th/Graduation.
    this.workExperienceSection    = page.locator('.mx-name-groupBox9');
    this.workExperienceToggleIcon = this.workExperienceSection.locator('.mx-groupbox-collapse-icon').first();

    // The submit CONFIRMATION dialog. Confirmed live (2026-09-24): clicking
    // Submit with every mandatory field validly filled opens a Mendix
    // ConfirmationDialog captioned "Confirmation" reading "Are you sure you
    // want to submit? Please ensure all the details are correct as you will
    // not be able to edit these later." with "Yes" (btn-primary) and "No"
    // buttons. A blank/invalid Submit shows NO dialog at all - just an
    // inline .mx-validation-message - so the dialog's presence is itself a
    // reliable signal that the app accepted the form.
    //
    // The pre-existing confirmationMsg locator above targets the same Yes
    // button; these are named for what they actually are, and add the No
    // button (which had no locator at all) so a test can CANCEL a
    // submission it never intended to complete - essential for the pooled
    // candidate, whose account a real submission would permanently consume.
    //
    // FIXED 2026-09-24 (found live by TC_113): this used to filter on
    // hasText: 'Confirmation'. Playwright's string hasText is a
    // CASE-INSENSITIVE SUBSTRING match, so it also matched the completely
    // different Information dialog the app raises when the acknowledgement
    // checkbox is left unticked - "Please accept confirmation to proceed with
    // the application" (OK button only). submitAndCancelIfConfirmed() then
    // reported a correctly-BLOCKED submit as `confirmed: true` and hung for
    // 30s looking for a "No" button that dialog does not have. Anchored on
    // the actual submit-confirmation sentence instead.
    this.confirmDialog    = page.locator("div[role='dialog']").filter({ hasText: 'Are you sure you want to submit' });
    this.confirmDialogYes = page.locator("//div[@role='dialog']//button[normalize-space()='Yes']");
    this.confirmDialogNo  = page.locator("//div[@role='dialog']//button[normalize-space()='No']");

    // A SECOND, different confirmation dialog, discovered live 2026-09-24:
    // switching "Are you experienced?" from Yes to No when experience data
    // has already been entered asks "Are you sure you do not have any
    // previous experience?" (Yes/No) before discarding it. On an account
    // with no experience data yet, selecting No shows no dialog at all -
    // which is why TC_96 (fresh account) never sees it.
    this.noExperienceConfirmDialog = page.locator("div[role='dialog']").filter({ hasText: 'do not have any previous experience' });

    // ---- Added 2026-09-24 for the TC_107-TC_118 batch ----
    // All CONFIRMED LIVE 2026-09-24 by dumping the real DOM of this section
    // with one and with two experience blocks rendered.
    //
    // Every widget in an experience block keeps the SAME Mendix widget name
    // across blocks and differs only by the generated suffix - block 1 is
    // Snip_ExperienceDetails.textBox6_mhe_8504, block 2 is
    // ...textBox6_mhe_8537 - so a contains()-on-the-widget-name locator
    // matches one element per block, in document order, and .nth(n) addresses
    // block n. Counting Company (textBox6) gives the block count, exactly as
    // qualificationCourseInputs does for Qualification Details.
    //
    // NOTE for anyone touching the single-block locators above
    // (companyNameInput/Annualpackage/.../FromDate/ToDate): they are
    // deliberately UNINDEXED and therefore strict-mode-violate the moment a
    // second block exists. That is fine because the pooled account is kept at
    // exactly one block - see resetToSingleExperienceBlock(), which every
    // test that adds a block calls on the way out.
    this.experienceCompanyInputs = page.locator("//input[contains(@id,'Snip_ExperienceDetails.textBox6')]");

    // The per-block delete control. Same markup as the Additional
    // Qualification one (img.mx-image[role='button'] pointing at a delete_*
    // svg), but NOT the same rule about which blocks carry it: on Experience
    // Details EVERY block has one, including the first - confirmed live, one
    // icon with one block and two icons with two. Clicking it opens the same
    // "Are you sure you want to delete this record?" Yes/No Confirmation
    // dialog.
    this.experienceRemoveButtons = page.locator("img.mx-image[role='button'][src*='delete']");
    this.deleteConfirmDialog = page.locator("div[role='dialog'], .mx-dialog")
      .filter({ hasText: 'Are you sure you want to delete this record?' });
  }

  // ---- Multi-block helpers, added 2026-09-24 for TC_110/111/112 ----

  // How many experience blocks are currently rendered (>= 1 whenever "Yes" is
  // selected; 0 while "No" is selected, since the fields do not exist at all).
  async experienceBlockCount() {
    return this.experienceCompanyInputs.count();
  }

  // Field locators for the Nth experience block, n = 0 being the first.
  // For n = 0 these resolve to exactly the same elements as the unindexed
  // companyNameInput/Annualpackage/... locators above.
  experienceFields(n = 0) {
    const byWidget = (widget) =>
      this.page.locator(`//input[contains(@id,'Snip_ExperienceDetails.${widget}')]`).nth(n);
    return {
      company: byWidget('textBox6'),
      annualPackage: byWidget('textBox13'),
      designation: byWidget('textBox12'),
      hq: byWidget('textBox7'),
      currentlyWorking: byWidget('checkBox1'),
      fromDate: byWidget('datePicker4'),
      toDate: byWidget('datePicker5'),
      reason: byWidget('textBox8'),
    };
  }

  // Fills the Nth experience block with valid data except the field named in
  // `omit`, which is actively cleared. Same shape/reasoning as
  // fillExperienceFields() above, but block-indexed.
  async fillNthExperience(n = 0, opts = {}) {
    const {
      omit = null, company = 'xyz pharma ltd.', annualPackage = '500000',
      designation = 'MR', hq = 'Delhi', fromDate = '01/01/2020',
      toDate = '31/12/2023', reason = 'Career Growth',
    } = opts;
    const f = this.experienceFields(n);

    await f.company.waitFor({ timeout: 10000 });
    await f.company.scrollIntoViewIfNeeded().catch(() => {});
    await f.company.fill(omit === 'company' ? '' : company);
    await f.annualPackage.fill(omit === 'annualPackage' ? '' : annualPackage);
    await f.designation.fill(omit === 'designation' ? '' : designation);
    await f.hq.fill(omit === 'hq' ? '' : hq);
    await f.fromDate.fill(omit === 'from' ? '' : fromDate);
    await f.fromDate.press('Tab');
    if (!(await f.toDate.isDisabled().catch(() => false))) {
      await f.toDate.fill(omit === 'to' ? '' : toDate);
      await f.toDate.press('Tab');
    }
    await f.reason.fill(omit === 'reason' ? '' : reason);
  }

  // True when "+ Add Experience" is in any of Mendix's three disabled shapes.
  // Mirrors isAddQualificationDisabled().
  async isAddExperienceDisabled() {
    if (await this.addExperienceBtn.isDisabled().catch(() => false)) return true;
    const cls = (await this.addExperienceBtn.getAttribute('class').catch(() => '')) || '';
    const aria = (await this.addExperienceBtn.getAttribute('aria-disabled').catch(() => '')) || '';
    return /disabled/i.test(cls) || aria === 'true';
  }

  // Clicks "+ Add Experience" and returns { count, messages } - the block
  // count AFTER the attempt, and any validation messages the attempt raised.
  //
  // CRITICAL, confirmed live 2026-09-24 (and the exact trap that made the
  // 2026-09-22 Add Qualification probe report a phantom cap - see
  // addFilledQualificationBlocksUntil()): "Add Experience" REFUSES to add a
  // block while any existing block is still blank, firing that block's own
  // mandatory-field validation instead ("Please enter Company Name"). A loop
  // that only counts blocks and never reads the messages cannot tell that
  // apart from hitting a maximum. The messages are returned for exactly that
  // reason - callers must look at them.
  async clickAddExperience({ attempts = 3, timeout = 6000 } = {}) {
    const before = await this.experienceBlockCount();
    for (let i = 0; i < attempts; i++) {
      await this.addExperienceBtn.scrollIntoViewIfNeeded().catch(() => {});
      await this.addExperienceBtn.click({ force: true }).catch(() => {});
      const grew = await this.page
        .waitForFunction(
          ({ n }) => document.querySelectorAll("input[id*='Snip_ExperienceDetails.textBox6']").length > n,
          { n: before },
          { timeout, polling: 150 },
        )
        .then(() => true)
        .catch(() => false);
      if (grew) {
        return { count: await this.experienceBlockCount(), messages: await this.getVisibleValidationMessages() };
      }
    }
    return { count: before, messages: await this.getVisibleValidationMessages() };
  }

  // Adds experience blocks until `target` blocks exist, FILLING each new block
  // before attempting the next add (see clickAddExperience()'s comment for why
  // that is mandatory rather than tidy). Returns
  // { count, refused, messages }: `refused` is true only when an add attempt
  // genuinely failed to grow the block count while every block on the page was
  // already validly filled - i.e. the only state that could legitimately be
  // called a cap.
  async addFilledExperienceBlocksUntil(target, { maxAttempts = 30 } = {}) {
    let count = await this.experienceBlockCount();
    // Make sure block 0 is valid before the first add, otherwise the first
    // attempt is refused for the blank-block reason, not for a cap.
    for (let i = 0; i < count; i++) {
      await this.fillNthExperience(i, {
        company: `employer ${i + 1} pvt ltd.`,
        fromDate: `01/01/${1990 + i}`,
        toDate: `31/12/${1990 + i}`,
      });
    }

    for (let i = 0; i < maxAttempts && count < target; i++) {
      let { count: grown, messages } = await this.clickAddExperience();

      if (grown <= count) {
        // Refused. Before calling that a cap, rule out the ONE other thing
        // that produces an identical symptom: some block on the page not
        // actually holding the value we thought we typed (a Mendix re-render
        // can drop a fill). Re-fill every block from scratch and try once
        // more. Only a refusal that survives that, with every block
        // demonstrably non-blank, can be a genuine maximum.
        for (let b = 0; b < count; b++) {
          await this.fillNthExperience(b, {
            company: `employer ${b + 1} pvt ltd.`,
            fromDate: `01/01/${1990 + b}`,
            toDate: `31/12/${1990 + b}`,
          });
        }
        const retry = await this.clickAddExperience();
        grown = retry.count;
        messages = retry.messages;
        if (grown <= count) {
          const companies = await this.experienceCompanyInputs.evaluateAll((els) => els.map((e) => e.value));
          return { count: grown, refused: true, messages, companies };
        }
      }

      count = grown;
      await this.fillNthExperience(count - 1, {
        company: `employer ${count} pvt ltd.`,
        fromDate: `01/01/${1990 + count - 1}`,
        toDate: `31/12/${1990 + count - 1}`,
      });
    }
    return { count: await this.experienceBlockCount(), refused: false, messages: [], companies: [] };
  }

  // Removes the LAST experience block via its own delete icon, accepting the
  // "Are you sure you want to delete this record?" confirmation. Returns the
  // resulting block count.
  async removeLastExperienceBlock(bf) {
    const before = await this.experienceBlockCount();
    if (!(await this.experienceRemoveButtons.count())) {
      throw new Error('removeLastExperienceBlock(): no delete icon matched experienceRemoveButtons.');
    }
    const target = this.experienceRemoveButtons.last();
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.click({ force: true });

    const yes = this.deleteConfirmDialog.getByRole('button', { name: 'Yes', exact: true });
    const appeared = await yes.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (appeared) await yes.first().click();

    await this.page
      .waitForFunction(
        ({ n }) => document.querySelectorAll("input[id*='Snip_ExperienceDetails.textBox6']").length < n,
        { n: before },
        { timeout: 8000, polling: 150 },
      )
      .catch(() => {});
    if (bf) await bf.hardWait(1);
    return this.experienceBlockCount();
  }

  // Deletes every experience block after the first, so the pooled candidate is
  // handed back to the next test in the one-block state its unindexed
  // companyNameInput/ToDate/... locators require. Best-effort and never
  // throws: it runs in afterEach hooks, where a throw would mask the real
  // failure. Confirmed live that this section PERSISTS added blocks across
  // sign-ins, so skipping it genuinely does break the next run.
  async resetToSingleExperienceBlock(bf, { maxRemovals = 15 } = {}) {
    for (let i = 0; i < maxRemovals; i++) {
      const count = await this.experienceBlockCount().catch(() => 0);
      if (count <= 1) return count;
      const after = await this.removeLastExperienceBlock(bf).catch(() => count);
      if (after >= count) return after;
    }
    return this.experienceBlockCount().catch(() => 0);
  }

  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map(t => t.trim()).filter(Boolean))];
  }

  // Mirrors ITAPInterviewPerformaPage.toggleSection() - force:true for the
  // same live-confirmed reason (a plain click on a Mendix groupbox collapse
  // icon doesn't always register).
  async toggleSection(icon) {
    await icon.scrollIntoViewIfNeeded();
    await icon.click({ force: true });
  }

  // Selects "No" for "Are you experienced?", answering the "Are you sure you
  // do not have any previous experience?" confirmation with Yes if the app
  // raises it (it only does so when experience data already exists). Returns
  // the dialog's text, or null if no dialog appeared.
  async selectNotExperiencedConfirming(bf) {
    await this.experienceDetail_No.click();
    await bf.hardWait(1.5);
    if (await this.noExperienceConfirmDialog.count()) {
      const text = (await this.noExperienceConfirmDialog.first().innerText()).trim();
      await this.confirmDialogYes.first().click();
      await bf.hardWait(2);
      return text;
    }
    return null;
  }

  // Fills every "Are you experienced? = Yes" field with known-valid data,
  // except the one named in `omit`, which is actively CLEARED rather than
  // merely skipped (same reasoning as
  // ITAP_QualificationDetailsPage.fill_graduationDetailsOmitting(): against a
  // pooled account, or after an earlier interaction in the same test, a
  // field can already hold a value, and "didn't type into it" is not the
  // same thing as "is blank"). Does NOT select the Yes radio (callers do
  // that themselves so they can assert on the reveal) and does NOT submit.
  //
  // omit: one of 'company' | 'annualPackage' | 'designation' | 'hq' |
  // 'from' | 'to' | 'reason'.
  async fillExperienceFields({ omit, fromDate = '01/01/2020', toDate = '31/12/2023' } = {}) {
    await this.companyNameInput.waitFor();
    await this.companyNameInput.fill(omit === 'company' ? '' : 'xyz pharma ltd.');
    await this.Annualpackage.fill(omit === 'annualPackage' ? '' : '500000');
    await this.designation.fill(omit === 'designation' ? '' : 'MR');
    await this.HQ.fill(omit === 'hq' ? '' : 'Delhi');

    await this.FromDate.fill(omit === 'from' ? '' : fromDate);
    await this.FromDate.press('Tab');
    await this.ToDate.fill(omit === 'to' ? '' : toDate);
    await this.ToDate.press('Tab');

    await this.reasonofleaving.fill(omit === 'reason' ? '' : 'Career Growth');
  }

  // Checks the confirmation checkbox (idempotently - .check() is a no-op if
  // it is already checked, unlike the pre-existing attemptSubmit()'s raw
  // .click(), which would UNCHECK it on a second call), clicks Submit, and
  // then:
  //   - if the "Are you sure you want to submit?" confirmation dialog
  //     appears, clicks "No" so the submission is CANCELLED and the
  //     candidate account survives for the next test;
  //   - otherwise collects whatever inline validation message blocked it.
  //
  // Returns { confirmed, messages, dialogText }. `confirmed: true` means the
  // app was willing to submit - i.e. it found nothing wrong with the form.
  //
  // This is the only safe way for a pooled-account test to exercise Submit:
  // a real submission is irreversible ("you will not be able to edit these
  // later") and permanently consumes the account.
  //
  // `checkConfirmation` (added 2026-09-24, default true so every pre-existing
  // caller behaves exactly as before) controls whether the "I confirm that
  // the details provided by me are accurate..." checkbox is ticked first.
  // TC_113 needs it UNTICKED, and needs it actively unchecked rather than
  // merely left alone: this section auto-commits, so the pooled candidate can
  // arrive with it already ticked from an earlier test.
  async submitAndCancelIfConfirmed(bf, { checkConfirmation = true } = {}) {
    await this.confirmationRadioBtn.scrollIntoViewIfNeeded();
    if (checkConfirmation) await this.confirmationRadioBtn.check();
    else await this.confirmationRadioBtn.uncheck();
    await bf.hardWait(1);
    await this.submitBtn.click();
    await bf.hardWait(2.5);

    if (await this.confirmDialog.count()) {
      const dialogText = (await this.confirmDialog.first().innerText()).trim();
      await this.confirmDialogNo.first().click();
      await bf.hardWait(2);
      return { confirmed: true, messages: [], dialogText, blockingDialogText: null, errorDialogText: null };
    }

    // A Mendix RUNTIME ERROR dialog ("An error occurred, please contact your
    // system administrator.") is neither a confirmation nor a validation
    // message - it is the app crashing. Captured and dismissed here rather
    // than silently ignored, so a test that hits one can report what actually
    // happened instead of just "no validation message appeared". Confirmed
    // live 2026-09-24: submitting with a blank "From" date does exactly this.
    //
    // `blockingDialogText` (added 2026-09-24) is whatever non-submit-
    // confirmation dialog the app raised, whichever kind it was;
    // `errorDialogText` is narrowed to ONLY the Mendix runtime-error dialog,
    // so the existing `expect(errorDialogText).toBeNull()` assertions keep
    // meaning "the app didn't crash" and don't start failing on the
    // perfectly legitimate "Please accept confirmation to proceed with the
    // application" Information dialog that TC_113 depends on.
    let blockingDialogText = null;
    let errorDialogText = null;
    const anyDialog = this.page.locator("div[role='dialog']");
    if (await anyDialog.count()) {
      blockingDialogText = (await anyDialog.first().innerText()).trim();
      if (/an error occurred|failed for security reasons/i.test(blockingDialogText)) {
        errorDialogText = blockingDialogText;
      }
      const ok = anyDialog.getByRole('button', { name: 'OK', exact: true });
      const close = anyDialog.locator('button.close');
      if (await ok.count()) await ok.first().click().catch(() => {});
      else if (await close.count()) await close.first().click().catch(() => {});
      else await this.page.keyboard.press('Escape');
      await bf.hardWait(1);
    }

    return {
      confirmed: false,
      messages: await this.getVisibleValidationMessages(),
      dialogText: null,
      blockingDialogText,
      errorDialogText,
    };
  }

  // See ITAPInterviewPerformaPage.getDialogTextAndDismiss() for details.
  async getDialogTextAndDismiss() {
    await this.dialogMessage.first().waitFor({ timeout: 10000 });
    const text = (await this.dialogMessage.first().textContent()).trim();
    await this.page.keyboard.press('Escape');
    return text;
  }

  async click_SaveBtn() {
    await this.saveBtn.scrollIntoViewIfNeeded();
    await this.saveBtn.click();
  }

  // TC-EX08: fills the SECOND experience entry revealed by "Add Experience"
  // (nth(1) - the first entry's own fields, declared above, stay unindexed
  // for every existing caller). Mirrors
  // ITAP_QualificationDetailsPage.fill_secondAdditionalQualificationDetails().
  async fill_SecondExperience(hardWait, fromDate = '01/01/2015', toDate = '31/12/2018', overrides = {}) {
    await this.addExperienceBtn.scrollIntoViewIfNeeded();
    await this.addExperienceBtn.click();
    await hardWait(1.5);

    const companyName = this.page.locator("//*[@placeholder='Enter company name']").nth(1);
    const annualPackage = this.page.locator("//*[@placeholder='Enter annual package']").nth(1);
    const designation = this.page.locator("//*[@placeholder='Enter designation']").nth(1);
    const hq = this.page.locator("//*[@placeholder='Enter Head Quarter']").nth(1);
    const fromDateField = this.page.locator("(//*[@placeholder='dd/mm/yyyy'])[3]");
    const toDateField = this.page.locator("(//*[@placeholder='dd/mm/yyyy'])[4]");
    const reason = this.page.locator("//*[@placeholder='Enter reason of leaving']").nth(1);

    await companyName.waitFor();
    await companyName.fill(overrides.companyName || 'second employer pvt ltd.');
    await annualPackage.fill(overrides.annualPackage || '600000');
    await designation.fill(overrides.designation || 'Senior MR');
    await hq.fill('Mumbai');
    await fromDateField.fill(fromDate);
    await fromDateField.press('Tab');
    await toDateField.fill(toDate);
    await toDateField.press('Tab');
    await reason.fill('Better opportunity');
  }

  async fill_NotExperienced(hardWait) {
    await this.experienceDetail_No.click();
    await hardWait(1);

    // Live-verified (2026-08-31): clicking "No" shows no dialog, just the
    // confirmation checkbox + Submit. The old logic here clicked
    // confirmationRadioBtn twice (once via the else branch, once
    // unconditionally after), which checks then immediately unchecks it -
    // Submit would then fail the "must confirm" validation. A single
    // check() is correct; the Submit click itself triggers a real
    // "Are you sure you want to submit?" Yes/No dialog that confirmationMsg
    // targets, so that click stays conditional on it actually appearing.
    await this.confirmationRadioBtn.check();
    await hardWait(1);

    await this.submitBtn.click();
    await hardWait(1);
    if (await this.confirmationMsg.isVisible().catch(() => false)) {
      await this.confirmationMsg.click();
    }
    await hardWait(3);
  }


  async fill_Experienced(hardWait, fromDate = '01/01/2020', toDate = '31/12/2023', overrides = {}) {

    await this.experienceDetail_yes .click();
    await hardWait(1);

    await this.companyNameInput.click();
    await this.companyNameInput.fill(overrides.companyName || 'xyz pharma ltd.');
    await hardWait(1);

    await this.Annualpackage.click();
    await this.Annualpackage.fill(overrides.annualPackage || '500000');
    await hardWait(1);

    await this.designation.click();
    await this.designation.fill(overrides.designation || 'MR');
    await hardWait(1);

    await this.HQ.click();
    await this.HQ.fill('Delhi');
    await hardWait(1);

    await this.FromDate.click();
    await this.FromDate.fill(fromDate);
    await this.FromDate.press('Tab');
    await hardWait(1);

    await this.ToDate.click();
    await this.ToDate.fill(toDate);
    await this.ToDate.press('Tab');
    await hardWait(1);

    await this.reasonofleaving.click();
    await this.reasonofleaving.fill('Career Growth');
    await hardWait(1);

    await this.currentlyWorkingHere.check();
    await hardWait(1);

    await this.confirmationRadioBtn.scrollIntoViewIfNeeded();
    await this.confirmationRadioBtn.click();
    await hardWait(1);

    await this.submitBtn.click();
    await hardWait(1);

    await this.confirmationMsg.click();
    await hardWait(3);
  }

  // TC-025/026: fills the experience form without checking "Currently working
  // here" and without submitting, so a negative test can inspect the To-Date
  // vs. "currently working" interaction (or an invalid date range) before
  // deciding whether/how to submit.
  async fill_ExperienceFormOnly(hardWait, fromDate = '01/01/2020', toDate = '31/12/2023', overrides = {}) {
    await this.experienceDetail_yes.click();
    await hardWait(1);

    await this.companyNameInput.click();
    await this.companyNameInput.fill(overrides.companyName || 'xyz pharma ltd.');
    await this.Annualpackage.click();
    await this.Annualpackage.fill(overrides.annualPackage || '500000');
    await this.designation.click();
    await this.designation.fill(overrides.designation || 'MR');
    await this.HQ.click();
    await this.HQ.fill('Delhi');

    await this.FromDate.click();
    await this.FromDate.fill(fromDate);
    await this.FromDate.press('Tab');
    await hardWait(1);

    await this.ToDate.click();
    await this.ToDate.fill(toDate);
    await this.ToDate.press('Tab');
    await hardWait(1);

    await this.reasonofleaving.click();
    await this.reasonofleaving.fill('Career Growth');
  }

  // Clicks Submit (and the acknowledgement checkbox) without assuming success,
  // so validation-message assertions can run before any confirmation dialog.
  async attemptSubmit(hardWait) {
    await this.confirmationRadioBtn.scrollIntoViewIfNeeded();
    await this.confirmationRadioBtn.click();
    await hardWait(1);
    await this.submitBtn.click();
    await hardWait(1.5);
  }

}

module.exports = { ITAPInterviewPerformaPage, ITAP_QualificationDetailsPage, ITAP_ExperienceDetailPage };
