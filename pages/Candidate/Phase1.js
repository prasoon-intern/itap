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
    this.role            = page.locator("//*[contains(@id, 'BasicDetails.dropDown3')]");
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
    this.maritalStatus   = page.locator("//*[contains(@id, 'PersonalDetails.dropDown6')]");
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
    this.state           = page.locator("//*[contains(@id,'PersonalDetails.referenceSelector1')]");
    this.district        = page.locator("//*[contains(@id, 'PersonalDetails.referenceSelector2')]");
    this.perAddRadioBtn  = page.locator("//*[contains(@id, 'PersonalDetails.checkBox1')]");

    this.currAddLine1     = page.locator("[placeholder='Enter current address']");
    this.currAddLine2     = page.locator("[placeholder='Enter current address line 2']");
    this.currAddLine3     = page.locator("[placeholder='Enter current address line 3']");
    this.currCity         = page.locator("(//*[@placeholder='Enter city'])[2]");
    this.currPin          = page.locator("(//*[@placeholder='Enter pin code'])[2]");
    this.currState        = page.locator("//*[contains(@id,'Snip_PersonalDetails.referenceSelector3')]");
    this.currDistrict     = page.locator("//*[contains(@id, 'Snip_PersonalDetails.referenceSelector5')]");
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

  async fill_PersonalDetails(dob = '2/2/1993') {
    await this.DOB.scrollIntoViewIfNeeded();
    await this.DOB.fill(dob);
    await this.maritalStatus.scrollIntoViewIfNeeded();
    await this.maritalStatus.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  async fill_ParentDetails(fatherName = 'Amandeep Singh') {
    await this.fatherName.scrollIntoViewIfNeeded();
    await this.fatherName.fill(fatherName);
    await this.fatherOcc.fill('Service');
    await this.fatherIncome.fill('500000');
    await this.motherName.fill('Kashish Kaur');
    await this.motherOcc.fill('Home Maker');
    await this.motherIncome.fill('0');
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

  async select_StateDistrict(hardWait) {
    await this.state.scrollIntoViewIfNeeded();
    await this.state.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    await hardWait(3);
    await this.district.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  async click_PerAddRadioBtn() {
    await this.perAddRadioBtn.scrollIntoViewIfNeeded();
    await this.perAddRadioBtn.click();
  }

    async fillCurrentAddress() {
    await this.currAddLine1.scrollIntoViewIfNeeded();
    await this.currAddLine1.fill('Flat No. 204, Green Residency');
    await this.currCity.fill('Gujarat');
    await this.currPin.fill('136131');
  }


  async selectCurr_StateDistrict(hardWait) {
    await this.currState.scrollIntoViewIfNeeded();
    await this.currState.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
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
    this.addcourseBtn       = page.getByRole('button', { name: 'Add Qualification' });
    this.additional_course = page.locator("input.widget-combobox-input[role='combobox'][id*='Snip_Qualification.comboBox1']").nth(1);
    this.additionalQualificationHeader = page.locator("h6:has-text('Additional Qualification')");
    this.addcourse_FromDate = page.locator("(//*[@placeholder='dd/mm/yyyy'])[7]");
    this.addcourse_ToDate   = page.locator("(//*[@placeholder='dd/mm/yyyy'])[8]");
    this.addcourse_Type     = page.locator("//*[contains(@id,'Snip_Qualification.dropDown3')]").nth(1);
    this.addcourse_Marks    = page.locator("(//*[@placeholder='Enter marks in percent'])[4]");

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

  async fill_XthDetails(fromDate = '02/02/2010', toDate = '02/02/2011', marks = '80') {
    await this.Xth_FromDate.waitFor();
    await this.Xth_FromDate.fill(fromDate);
    await this.Xth_ToDate.fill(toDate);
    await this.Xth_Marks.fill(marks);
    await this.page.keyboard.press('Tab');
  }

  async fill_XIIthDetails(fromDate = '02/02/2012', toDate = '02/02/2013', marks = '85') {
    await this.XII_FromDate.waitFor();
    await this.XII_FromDate.fill(fromDate);
    await this.XII_ToDate.fill(toDate);
    await this.XII_Marks.fill(marks);
    await this.page.keyboard.press('Tab');
  }

  async fill_graduationDetails(fromDate = '02/02/2014', toDate = '02/02/2018', marks = '90') {
    await this.page.mouse.wheel(0, 800);
    await this.graduation_FromDate.scrollIntoViewIfNeeded();
    await this.graduation_course.waitFor();
    await this._selectCourseOption(this.graduation_course, 'B.Sc');
    await this.graduation_FromDate.waitFor();
    await this.graduation_FromDate.fill(fromDate);
    await this.graduation_ToDate.fill(toDate);
    await this.graduation_Type.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    await this.graduation_Marks.fill(marks);
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

  async click_NextBtn() {
    await this.nextBtn.click();
  }

  async _selectCourseOption(input, preferredValue) {
    const preferredOption = this.page.locator(`//*[@role='option' and contains(normalize-space(), '${preferredValue}')]`).first();
    const anyOption = this.page.locator("//*[@role='option']").first();

    for (let attempt = 0; attempt < 2; attempt++) {
      await input.click({ timeout: 10000, force: true });
      await anyOption.waitFor({ timeout: 10000 });

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
    this.FromDate  = page.locator("(//*[@placeholder='dd/mm/yyyy'])[1]");
    this.ToDate    = page.locator("(//*[@placeholder='dd/mm/yyyy'])[2]");
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
