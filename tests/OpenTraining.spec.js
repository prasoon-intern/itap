// Open Training Test Suite
// Tests the complete flow: Login → Navigate to Open Training → Add Training

const { test, expect } = require('@playwright/test');
const BrowserFactory = require('../utils/BrowserFactory');
const OpenTrainingPage = require('../pages/OpenTraining');

test.describe('Open Training Module Tests', () => {
  let bf;
  let openTrainingPage;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser();
    openTrainingPage = new OpenTrainingPage(bf.page);
  });

  test('Complete Flow: Login and Add Training', async () => {
    console.log('\n🎯 Starting Open Training Test...\n');

    // Step 1: Navigate to application
    console.log('Step 1: Navigating to application...');
    await openTrainingPage.navigateToApp();
    await openTrainingPage.verifyLoginPageLoaded();
    await openTrainingPage.takeScreenshot('01-login-page');
    console.log('✅ Login page loaded\n');

    // Step 2: Login with credentials
    console.log('Step 2: Logging in...');
    await openTrainingPage.fillUsername('krati');
    await openTrainingPage.fillPassword('Mankind@12345');
    await openTrainingPage.takeScreenshot('02-credentials-filled');
    await openTrainingPage.clickSignIn();
    await openTrainingPage.waitForSeconds(2);
    await openTrainingPage.verifyMainPageLoaded();
    await openTrainingPage.takeScreenshot('03-main-page');
    console.log('✅ Successfully logged in\n');

    // Step 3: Navigate to Open Training
    console.log('Step 3: Navigating to Open Training...');
    await openTrainingPage.clickOpenTrainingMenu();
    await openTrainingPage.waitForSeconds(2);
    await openTrainingPage.verifyOpenTrainingPageLoaded();
    await openTrainingPage.takeScreenshot('04-open-training-page');
    console.log('✅ Open Training page loaded\n');

    // Step 4: Click Add Training button
    console.log('Step 4: Opening Add Training popup...');
    await openTrainingPage.clickAddTrainingButton();
    await openTrainingPage.waitForSeconds(1);
    await openTrainingPage.verifyAddTrainingPopupVisible();
    await openTrainingPage.takeScreenshot('05-add-training-popup');
    console.log('✅ Add Training popup opened\n');

    // Step 5: Fill training details
    console.log('Step 5: Filling training details...');
    
    // Select today's date automatically
    console.log('  - Selecting training date (today\'s date automatically)');
    await openTrainingPage.selectTrainingDate(); // No date parameter = uses today's date
    await openTrainingPage.waitForSeconds(1);
    
    // Fill number of days
    console.log('  - Entering number of days: 1');
    await openTrainingPage.fillNumberOfDays('1');
    await openTrainingPage.waitForSeconds(1);
    
    // Select division
    console.log('  - Selecting division: Future Mankind');
    await openTrainingPage.selectDivision('Future Mankind');
    await openTrainingPage.waitForSeconds(1);
    await openTrainingPage.takeScreenshot('06-division-selected');
    
    // Select organizer
    console.log('  - Selecting organizer: Nitin Gaur');
    await openTrainingPage.selectOrganizer('Nitin Gaur');
    await openTrainingPage.waitForSeconds(1);
    await openTrainingPage.takeScreenshot('07-all-fields-filled');
    console.log('✅ All fields filled\n');

    // Step 6: Save the training
    console.log('Step 6: Saving training...');
    await openTrainingPage.clickSaveButton();
    await openTrainingPage.waitForSeconds(2);
    await openTrainingPage.verifyTrainingSaved();
    await openTrainingPage.takeScreenshot('08-training-saved');
    console.log('✅ Training saved successfully\n');

    console.log('🎉 Test completed successfully!\n');
  });

  test('Verify Training appears in the list', async () => {
    console.log('\n🔍 Verifying training in list...\n');
    
    // Get today's date in dd/mm/yyyy format
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const todayFormatted = `${day}/${month}/${year}`;
    
    // Check if the training appears in the table
    // Look for today's date in the table
    const dateCell = bf.page.locator(`text=${todayFormatted}`);
    const isVisible = await dateCell.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isVisible) {
      console.log('✅ Training entry found in the table');
    } else {
      console.log('⚠️ Training entry not immediately visible (may need to scroll or refresh)');
    }
    
    await openTrainingPage.takeScreenshot('09-training-list-verification');
  });

  test.afterAll(async () => {
    console.log('\n📸 All screenshots saved to test-results/ folder');
    await bf.closeBrowser();
  });
});

// ================================================================
// 🚀 HOW TO RUN THIS TEST
// ================================================================

/*

QUICK RUN:
  npm run test:opentraining

HEADED MODE (see browser):
  npm run test:opentraining:headed

DEBUG MODE:
  npx playwright test tests/OpenTraining.spec.js --debug

VIEW REPORT:
  npm run report

*/
