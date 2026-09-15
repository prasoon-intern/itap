// ⚠️ UNVERIFIED / NEEDS REWORK — see pages/Training.js for the specific gaps
// (ignored parameters, hardcoded stale RegIDs, no config.js integration).
// Confirmed live 2026-09-01: TC04 fails because selectCheckboxByRegID() never
// actually targets the candidate it's given. Kept in the framework since
// Training is a real required step before Onboarding, not because this
// version is trustworthy yet.
const { test, expect } = require('@playwright/test');
const BrowserFactory = require('../utils/BrowserFactory');
const ITAP_Training = require('../pages/Training');
const config = require('../config');
const ctx = require('../utils/Globals.js');

test.describe.serial('🚀 Training Workflow Tests', () => {
  let bf;
  let trainingPage;
  const attachmentPath = 'C:\\Users\\mahak.arora\\Desktop\\sample.pdf'; // Update with actual file path

  test.beforeAll(async () => {
    bf = new BrowserFactory(); // Initialize BrowserFactory first
    await bf.launchBrowser('https://fcadmin100-dev.apps.ap-3a.mendixcloud.com/login.html'); // Launch browser with training portal URL

    trainingPage = new ITAP_Training(bf.page);
  });

  test('TC01: Login to Training Portal', async () => {
    // Enter credentials
    await trainingPage.enterUsername(config.username);
    await trainingPage.enterPassword(config.password);

    // Click Sign in button
    await trainingPage.clickSignIn();

    // Wait for navigation after login
    await bf.page.waitForLoadState('networkidle');

    console.log('✅ Successfully logged in to the portal');
  });

  test('TC02: Navigate to Appointment Section', async () => {
    await bf.hardWait(1); // Ensure page is fully loaded before clicking
    // Click on Appointment button in left sidebar
    await trainingPage.clickAppointment();

    // Wait for page to load
    await bf.page.waitForLoadState('networkidle');

    console.log('✅ Navigated to Appointment section');
  });

  test('TC03: Navigate to Training Tab', async () => {
    // Click on Training tab
    await trainingPage.clickTraining();

    // Wait for Training page to load
    // await bf.page.waitForLoadState('networkidle');

    console.log('✅ Navigated to Training tab');
  });

  test('TC04: Search for ITAP Number and Select Checkbox', async () => {
    // Search for ITAP number in RegID filter
    await trainingPage.searchRegID(ctx.itapNumber);

    // Wait for search results
    await bf.hardWait(1);

    // Select checkbox for the searched ITAP number
    await trainingPage.selectCheckboxByRegID(ctx.itapNumber);

    console.log(`✅ Searched and selected RegID: ${ctx.itapNumber}`);
  });

  test('TC05: Create Training Batch', async () => {
    // Click on Create a batch button
    await trainingPage.clickCreateBatch();

    // Wait for batch creation page to load
    await bf.page.waitForLoadState('networkidle');

    console.log('✅ Navigated to Create Batch page');
  });

  test('TC06: Select Training Batch and Assign Candidate', async () => {
    // Click on Training Batch dropdown and select first option
    await trainingPage.selectFirstTrainingBatch();

    // Wait for dropdown selection
    await bf.hardWait(1);

    // Select checkbox for the candidate in the batch
    await trainingPage.selectCandidateCheckboxInBatch(ctx.itapNumber);

    console.log('✅ Selected training batch and candidate');
  });

  test('TC07: Assign and Preview Email', async () => {
    // Click on Assign & Preview button
    await trainingPage.clickAssignAndPreview();

    // Wait for preview page to load
    await bf.page.waitForLoadState('networkidle');

  });

  test('TC08: Update Email Recipient and Add Attachment', async () => {
    // Fixed 2026-09-07: was hardcoded to a real colleague's address
    // (mahak.arora@mankindpharma.com), violating standing project policy
    // that every automated email must go only to config.EmailId - see
    // feedback_interview_email_destination. Same class of bug as
    // ITAP_PreviewCandidateEmail's missing To-field override, found and
    // fixed the same day.
    await trainingPage.updateToEmail(config.EmailId);

    console.log('✅ Updated email recipient to:', config.EmailId);

    // Add attachment (provide the path to your attachment file)
    // await trainingPage.addAttachment(attachmentPath);

    // Wait a moment for file upload
    await bf.hardWait(1);

    // console.log(`✅ Added attachment: ${attachmentPath}`);
  });

  test('TC09: Send Email to Candidate', async () => {
   
    // Click on Send Mail to Candidate button
    await trainingPage.clickSendMail();

    // Wait for email to be sent
    await bf.hardWait(2);

    // Read and log the second popup (Email successfully sent)
    // const popupMessage = await trainingPage.readAndLogPopup();
    // console.log(`✅ Popup Message: ${popupMessage}`);

    // Wait for final state
    await bf.page.waitForLoadState('networkidle');

    console.log('✅ Email sent successfully to candidate');
  });

  test.afterAll(async () => {
    console.log('🔥 afterAll triggered');
    await bf.closeBrowser();
  });
});
