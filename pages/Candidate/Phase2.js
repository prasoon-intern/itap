// pages/Candidate/Phase2.js — Candidate Phase 2 page object. Contains 1 class,
// unchanged from the previous consolidated pages/Candidate.js:
//   - ITAP_ContinueToPhase2Page: ITAP number popup + Phase 2 other details

// pages/ITAP_ContinueToPhase2Page.js — equivalent to ITAP_ContinueToPhase2Page.java
class ITAP_ContinueToPhase2Page {
  constructor(page) {
    this.page = page;

    this.continueToPhase2Btn       = page.locator("//*[contains(@data-button-id,'ITAP_Number_PopupPage.actionButton18')]");
    // Scoped to //select (not a bare //*): once a validation message is
    // showing (e.g. "Blood group is mandatory"), Mendix renders that error
    // <div> with an id that also contains 'OtherDetails.dropDown1'/'dropDown5',
    // which turns a bare //*[contains(@id,...)] locator into a strict-mode
    // multi-match — same class of bug already fixed for the Signup/Sign-In
    // locators in pages/Candidate/SignUpSignIn.js.
    this.bloodGroup                = page.locator("//select[contains(@id,'OtherDetails.dropDown1')]");
    this.religion                  = page.locator("//select[contains(@id,'OtherDetails.dropDown5')]");
    // Father's and Mother's DOB share the same placeholder-based locator;
    // they are disambiguated by index (.nth(0) / .nth(2)) where used below.
    this.dobFields                 = page.locator("input[placeholder='dd/mm/yyyy']");
    this.nominee                   = page.locator("div.hide-phone input[id*='DependentDetails.checkBox1']").nth(0);
    this.uan_number                = page.locator("div.mx-name-textBox1.mx-textbox.form-group.no-columns > input.form-control[type='text'][maxlength='12']");
    this.emergencyContactName      = page.locator("(//div[contains(@class,'hide-phone')]//input[contains(@id,'EmergencyContact.textBox1')])[1]");
    this.emergencyContactName2     = page.locator("(//div[contains(@class,'hide-phone')]//input[contains(@id,'EmergencyContact.textBox1')])[2]");
    // Same //select scoping fix as bloodGroup/religion above — "Relation is
    // mandatory" renders an error <div> whose id also contains
    // 'EmergencyContact.dropDown1' once that validation message is showing.
    this.emergencyContactRelation  = page.locator("(//select[contains(@id,'EmergencyContact.dropDown1')])[1]");
    this.emergencyContactRelation2 = page.locator("(//select[contains(@id,'EmergencyContact.dropDown1')])[2]");
    this.emergencyContactNum1      = page.locator("(//div[contains(@class,'hide-phone')]//input[contains(@id,'EmergencyContact.textBox3')])[1]");
    // Confirmed live: unlike its Num1 sibling above, this one was a bare
    // //* — once "Duplicate Contact Number" is showing, that error <div>'s
    // id also contains 'EmergencyContact.textBox3', which shifts the [2]
    // positional index onto the error div instead of the real input. Scoped
    // to //input for the same reason as every other fix in this file.
    this.emergencyContactNum2      = page.locator("(//input[contains(@id,'EmergencyContact.textBox3')])[2]");
    this.nextBtn                   = page.locator("//*[contains(@data-button-id,'CandidatePhase2_OtherDetails.actionButton13')]");
    this.pfmember_toggle_yes           = page.locator("//*[contains(@id,'MR.Snip_UAN_Details.radioButtons1') and @value='_true']");
    this.pfmember_toggle_no            = page.locator("//*[contains(@id,'MR.Snip_UAN_Details.radioButtons1') and @value='_false']");

    // Same Mendix validation-message pattern used on Signup/Phase 1.
    this.validationMessages            = page.locator(".mx-validation-message");
  }

  async getVisibleValidationMessages() {
    const texts = await this.validationMessages.allTextContents();
    return [...new Set(texts.map(t => t.trim()).filter(Boolean))];
  }

  async click_continueToPhase2Btn() {
    if (await this.continueToPhase2Btn.isVisible()) {
      await this.continueToPhase2Btn.click();
    }
  }

 async Extract_itap_number() {
  const text = await this.page
    .locator('h4:has-text("Your iTAP Number")')
    .textContent();

  const itapNumber = text.match(/\d+/)[0];
   console.log("Itap number :" + itapNumber);
  return itapNumber;
}



  async otherDetails() {
    await this.bloodGroup.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');

    await this.religion.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  async dependantDetails(hardWait) {
    await hardWait(2);

    await this.dobFields.nth(0).scrollIntoViewIfNeeded();
    await this.dobFields.nth(0).click();
    await this.dobFields.nth(0).fill('15/08/1995');
    await this.dobFields.nth(0).press('Tab');

    await this.nominee.check();

    await this.dobFields.nth(2).scrollIntoViewIfNeeded();
    await this.dobFields.nth(2).click();
    await this.dobFields.nth(2).fill('15/08/1997');
    await this.dobFields.nth(2).press('Tab');

    await hardWait(2);
  }

    async pfmemeber_toggle() {
    await this.pfmember_toggle_no.scrollIntoViewIfNeeded();
    await this.pfmember_toggle_no.click();
  }

  async uanDetails(uanNumber = '123456789012') {
    await this.uan_number.first().scrollIntoViewIfNeeded();
    await this.uan_number.first().click();
    await this.uan_number.first().fill(uanNumber);
  }

  async emergencyContact() {
    await this.emergencyContactName.scrollIntoViewIfNeeded();
    await this.emergencyContactName.click();
    await this.emergencyContactName.fill('Kumar Saurabh');

    await this.emergencyContactRelation.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');

    await this.emergencyContactNum1.fill('9876543218');

    await this.emergencyContactName2.click();
    await this.emergencyContactName2.fill('Asha Rani');

    await this.emergencyContactRelation2.click();
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');

    await this.emergencyContactNum2.fill('9876543219');
  }

  async clickNextBtn() {
    await this.nextBtn.scrollIntoViewIfNeeded();
    await this.nextBtn.click();
  }
}

module.exports = { ITAP_ContinueToPhase2Page };
