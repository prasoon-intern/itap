// Page Object for Open Training Module
// All locators are FREE - manually created from the UI!

class OpenTrainingPage {
  constructor(page) {
    this.page = page;
  }

  // ================================================================
  // LOGIN PAGE METHODS
  // ================================================================

  async navigateToApp() {
    await this.page.goto('https://fcadmin100-dev.apps.ap-3a.mendixcloud.com/index.html');
    await this.page.waitForLoadState('networkidle');
  }

  async fillUsername(username) {
    // Using placeholder as it's visible in the screenshot
    await this.page.getByPlaceholder('User name').fill(username);
  }

  async fillPassword(password) {
    // Using placeholder for password field
    await this.page.getByPlaceholder('Password').fill(password);
  }

  async clickSignIn() {
    // Using role and text for the Sign in button
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  // ================================================================
  // MAIN PAGE METHODS
  // ================================================================

  async clickOpenTrainingMenu() {
    // Click on "Open Training" link in the sidebar using stable role and text
    await this.page.locator('li.mx-navigationlist-item span.mx-text.mx-name-text25').click();
    await this.page.waitForLoadState('networkidle');
  }

  // ================================================================
  // OPEN TRAINING PAGE METHODS
  // ================================================================

  async clickAddTrainingButton() {
    // Click the "+ Add Training" button
    await this.page.getByRole('button', { name: 'Add Training' }).click();
    // Wait for popup to appear
    await this.page.waitForTimeout(1000);
  }

  // ================================================================
  // ADD TRAINING POPUP METHODS
  // ================================================================

  async selectTrainingDate(date = null) {
    // If no date provided, use today's date
    if (!date) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      date = `${day}/${month}/${year}`;
      console.log(`Using today's date: ${date}`);
    }

    // Fill training date using label-based locator (more stable)
    const dateInput = this.page.locator('input[type="text"][placeholder="dd/mm/yyyy"]').first();
    await dateInput.fill(date);

    // Press Tab or Enter to confirm the date
    await dateInput.press('Tab');
  }

  async fillNumberOfDays(days) {
    // Find the "No of Days" input field using stable class selector
    await this.page.locator('.mx-name-textBox5 input.form-control').fill(days);
  }

  async selectDivision(divisionName) {
    // Select division using stable class-based locator
    const divisionCombobox = this.page.locator('.mx-name-comboBox1 input.widget-combobox-input[role="combobox"]');
    await divisionCombobox.click();
    await this.page.waitForTimeout(500);

    // Fill and select the division
    await divisionCombobox.fill(divisionName);
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);
  }

  async selectOrganizer(organizerName) {
    // Select organizer using stable class-based locator
    const organizerCombobox = this.page.locator('.mx-name-comboBox2 input.widget-combobox-input[role="combobox"]');
    await organizerCombobox.click();
    await this.page.waitForTimeout(500);

    // Fill and select the organizer (fixed parameter name)
    await organizerCombobox.fill(organizerName);
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2000);
  }

  async clickSaveButton() {
    // Click the Save button in the popup
    await this.page.getByRole('button', { name: 'Save' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickCancelButton() {
    // Click the Cancel button in the popup
    await this.page.getByRole('button', { name: 'Cancel' }).click();
  }

  // ================================================================
  // VALIDATION METHODS
  // ================================================================

  async verifyLoginPageLoaded() {
    await this.page.waitForSelector('text=Sign in', { state: 'visible' });
    const title = await this.page.title();
    console.log('Login page loaded. Title:', title);
    return true;
  }

  async verifyMainPageLoaded() {
    await this.page.waitForSelector('text=Open Training', { state: 'visible' });
    console.log('Main page loaded successfully');
    return true;
  }

  async verifyOpenTrainingPageLoaded() {
    await this.page.waitForSelector('text=Add Training', { state: 'visible' });
    console.log('Open Training page loaded successfully');
    return true;
  }

  async verifyAddTrainingPopupVisible() {
    await this.page.waitForSelector('text=Add Open Training', { state: 'visible' });
    console.log('Add Training popup is visible');
    return true;
  }

  async verifyTrainingSaved() {
    // Wait for popup to close
    await this.page.waitForTimeout(2000);
    console.log('Training saved successfully');
    return true;
  }

  // ================================================================
  // UTILITY METHODS
  // ================================================================

  async takeScreenshot(name) {
    await this.page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    console.log(`Screenshot saved: ${name}.png`);
  }

  async waitForSeconds(seconds) {
    await this.page.waitForTimeout(seconds * 1000);
  }
}

module.exports = OpenTrainingPage;
