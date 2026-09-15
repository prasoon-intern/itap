// pages/Training.js
//
// ⚠️ UNVERIFIED / NEEDS REWORK — do not treat this as validated coverage.
// Unlike Candidate/Interview/Onboarding, this page object was never finished:
// - searchRegID() takes no parameter and hardcodes '25566'.
// - selectCheckboxByRegID(i) and selectCandidateCheckboxInBatch(regID) both
//   accept a candidate ID and never use it — each builds an unused `row`
//   locator (hardcoded to a stale ID like '25568') and clicks the first
//   generic checkbox on the page instead of that candidate's row.
// - No config.js integration (hardcoded FC Admin URL elsewhere in
//   tests/Training.spec.js, hardcoded recipient email in this file's caller).
// - No excelReporter results tracking.
// Kept in the framework (not deleted) because Training is a real, required
// step in the candidate journey (Interview -> Training -> Onboarding) and
// needs an automated module here eventually — but this implementation needs
// the parameter-wiring fixed and stale hardcoded values replaced with real
// config-driven values before it can be trusted to pass reliably.
class ITAP_Training {
  constructor(page) {
    this.page = page;

    // Locators for login page elements
    this.usernameInput = page.locator("input[placeholder='User name']");
    this.passwordInput = page.locator("input[placeholder='Password']");
    this.signInButton = page.locator("button:has-text('Sign in')");

    // Locators for dashboard navigation
    this.appointmentButton = page.locator("//li[@role='button'][.//span[text()='Appointment']]");
    this.trainingTab = page.locator("//*[@role='tab' and text()='Training']");

    // Locators for Training page
    this.regIDFilterInput = page.locator("//div[@class='filter-container mx-name-textFilter5']//input[@type='text']");
    this.checkboxSelect = page.locator("//div[@class='mx-name-checkBox5 mx-checkbox label-after form-group no-columns']//input[@type='checkbox']");
    this.createBatchButton = page.locator("//*[@type='button' and text()='Create Batch']");

    // Locators for Create Batch page
    this.trainingBatchDropdown = page.locator("text=Training Batch").locator('..').locator('input, select, [role="combobox"]').first();
    this.checboxTrainingBatch = page.locator("//*[@type='checkbox' and @tabindex='0']");
    this.assignAndPreviewButton = page.locator("button:has-text('Assign & Preview')");

    // Locators for Email Preview page
    this.successPopup = page.locator('.alert, .notification, .toast, [role="alert"]').filter({ hasText: /success|created|sent/i });
    this.toEmailInput = page.locator('//*[@type="text" and contains(@id,"AppointementModule.TrainingBatch.textBox5")]'); // The To field
    this.addFilesButton = page.locator('text=Add files');
    this.sendMailButton = page.locator("//*[@type='button' and text()='Send Mail to Candidate']");
  }

  // Navigate to the login page
  async navigateToLoginPage() {
    await this.page.goto('https://fcadmin100-dev.apps.ap-3a.mendixcloud.com/login.html');
  }

  // Enter username
  async enterUsername(username) {
    await this.usernameInput.fill(username);
  }

  // Enter password
  async enterPassword(password) {
    await this.passwordInput.fill(password);
  }

  // Click on Sign in button
  async clickSignIn() {
    await this.signInButton.click();
  }

  // Complete login flow
  async login(username, password) {
    await this.navigateToLoginPage();
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickSignIn();
  }

  // Click on Appointment button in left sidebar
  async clickAppointment() {
    await this.appointmentButton.click();
  }

  // Click on Training tab
  async clickTraining() {
    await this.trainingTab.click();
  }

  // Search for ITAP number in RegID filter
  async searchRegID() {
    await this.regIDFilterInput.fill('25566');
    await this.page.keyboard.press('Enter');
  }

  // Select checkbox for the searched ITAP number
  async selectCheckboxByRegID(i) {
    // Locate the row containing the ITAP number and click its checkbox
    const row = this.page.locator(`tr:has-text('25568')`).first();
    await this.checkboxSelect.click();
    await this.page.waitForTimeout(2000);
  }

  // Click on Create a batch button
  async clickCreateBatch() {
    await this.createBatchButton.click();
  }

  // Click on Training Batch dropdown and select first option
  async selectFirstTrainingBatch() {
    await this.trainingBatchDropdown.click();
    await this.page.waitForTimeout(500);
    // Select the first option from dropdown
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
  }

  // Select checkbox for candidate in Create Batch page
  async selectCandidateCheckboxInBatch(regID) {
    const row = this.page.locator(`tr:has-text("${regID}")`).first();
    await this.checboxTrainingBatch.click();
  }

  // Click on Assign & Preview button
  async clickAssignAndPreview() {
    await this.assignAndPreviewButton.scrollIntoViewIfNeeded();
    await this.assignAndPreviewButton.click();
  }

  // Read and log popup message
  async readAndLogPopup() {
    await this.page.waitForTimeout(1000); // Wait for popup to appear
    const popupText = await this.successPopup.textContent();
    console.log('Popup Message:', popupText.trim());
    return popupText.trim();
  }

  // Update To email field
  async updateToEmail(email) {
    await this.toEmailInput.click();
    await this.toEmailInput.clear();
    await this.toEmailInput.fill(email);
  }

  // Add attachment file
  async addAttachment(filePath) {
    const fileInput = await this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  // Click on Send Mail to Candidate button
  async clickSendMail() {
    await this.sendMailButton.scrollIntoViewIfNeeded();
    await this.sendMailButton.click();
  }
}

module.exports = ITAP_Training;
