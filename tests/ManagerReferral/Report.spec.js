const { test, expect } = require('@playwright/test');
const config = require('../../config');
const BrowserFactory = require('../../utils/BrowserFactory');
const { ManagerReferralPage } = require('../../pages/ManagerReferral/Page');
const { ManagerReferralReportPage } = require('../../pages/ManagerReferral/Report');

// Built from Test Cases/ManagerReferral_TestCases.xlsx, sheet
// "ManagerReferralReport_TestCases" (18 rows, Excel IDs TC_01..TC_18 - this
// file's own numbering, restarting from Page.spec.js's, matching the
// workbook's own separate sheet). Each title carries the literal Excel
// Testcase_id plus a [Positive]/[Negative]/[Edge] tag, since the dashboard's
// classifyTest() reads that bracket tag (the same convention already used
// by the Interview/Onboarding modules) to color-code category badges.
//
// Grid-filter tests (TC_10-TC_15) assert relative behavior (filtered count
// < baseline, restores after clearing) rather than the exact row counts
// recorded in the workbook (e.g. "1142 rows") - that's live, constantly
//-changing referral data, not a fixed fixture.
const NO_RECORD_MODAL = 'No Record Found!';

test.describe('Manager Referral Report - Search', () => {
  let bf;
  let report;

  // One shared tab for every test in this group, instead of relaunching per
  // test - see BrowserFactory.resetForNextTest()'s own comment for why this
  // stays just as isolated per-test as a fresh tab would be. report itself
  // is built once here since it just wraps bf.page, which doesn't change
  // across tests in this group - only the page's URL/state does, reset in
  // beforeEach below.
  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.MANAGER_REFERRAL_URL, config.browser, { shared: true });
    await new ManagerReferralPage(bf.page).clickOn_ViewReport();
    report = new ManagerReferralReportPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.MANAGER_REFERRAL_URL);
    await new ManagerReferralPage(bf.page).clickOn_ViewReport();
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const issue = bf.getEnvironmentIssuesSummary();
      if (issue) await testInfo.attach('environment-issue', { body: issue, contentType: 'text/plain' });
    }
  });

  test.afterAll(async () => {
    await bf.closeBrowser();
  });

  // Excel TC_01
  test('TC_01: every UI component on the Manager Referral Report page is present', async () => {
    await expect(report.referenceIdSearch).toBeVisible();
    await expect(report.getRecordsBtn).toBeVisible();
    const headers = await report.getColumnHeaders();
    for (const name of ['Referral date', 'iTAP Number', 'Candidate name', 'Email ID', 'Mobile number', 'Aadhaar number']) {
      expect(headers).toContain(name);
    }
    await expect(report.paginationCountText).toBeVisible();
  });

  // Excel TC_02
  test('TC_02: Get Records displays matching records for a valid, DB-known SAP ID', async () => {
    await report.searchByReferenceId(config.ManagerRefID);
    const rowCount = await report.getRowCount();
    expect(rowCount).toBeGreaterThan(0);
    await expect(report.paginationCountText).toBeVisible();
  });

  // Excel TC_03
  test('TC_03: Get Records shows "No Record Found!" for a valid-format SAP ID not in the database', async () => {
    await report.searchByReferenceId('12345678');
    const dialogText = await report.getResultDialogText();
    expect(dialogText).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();
  });

  // Excel TC_04
  test('TC_04: Get Records rejects a Reference ID with fewer than 8 digits', async () => {
    await report.searchByReferenceId('1000155'); // 7 digits
    const dialogText = await report.getResultDialogText();
    expect(dialogText).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();
  });

  // Excel TC_05
  test('TC_05: Get Records rejects a Reference ID with more than 8 digits', async () => {
    await report.searchByReferenceId('122334567'); // 9 digits
    const dialogText = await report.getResultDialogText();
    expect(dialogText).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();
  });

  // Excel TC_06
  test('TC_06: Get Records rejects alphabetic characters', async () => {
    await report.searchByReferenceId('abcdefgh');
    const dialogText = await report.getResultDialogText();
    expect(dialogText).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();
  });

  // Excel TC_07
  test('TC_07: Get Records rejects special characters', async () => {
    await report.searchByReferenceId('1000@#56');
    const dialogText = await report.getResultDialogText();
    expect(dialogText).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();
  });

  // Excel TC_08
  test('TC_08: Get Records on an empty submission shows no records', async () => {
    await report.getRecordsBtn.click();
    await report.waitForSearchResult();
    const dialogText = await report.getResultDialogText();
    expect(dialogText).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();
  });

  // Excel TC_09
  test('TC_09: safely rejects script/SQL-injection style input in the Report search', async () => {
    await report.searchByReferenceId('<script>alert(1)</script>');
    const dialogText = await report.getResultDialogText();
    expect(dialogText).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();

    // Secondary payload, exactly as recorded in the workbook.
    await report.searchByReferenceId("' OR '1'='1");
    const dialogText2 = await report.getResultDialogText();
    expect(dialogText2).toContain(NO_RECORD_MODAL);
    await report.closeResultDialog();
  });

  // Excel TC_18 - verifies the page's own fixed UI copy (header, title,
  // field label, button text, all column headers, and footer) is present
  // and correctly worded - distinct from TC_01, which only checks component
  // presence and a subset of column headers, not any of the surrounding
  // page text. Every string below confirmed live (2026-09-15) via a
  // throwaway Playwright probe against the actual page. That probe also
  // turned up a real typo: the live page actually reads "Initital feedback"
  // (missing the "a") - this asserts the correct "Initial feedback"
  // spelling on purpose, so this test genuinely flags that as a defect
  // instead of quietly encoding the typo as correct.
  test('TC_18: header, footer, and all static UI text on the Manager Referral Report page are correct', async () => {
    await expect(report.headerLogo).toBeVisible();

    const text = await report.getPageText();
    const expectedStrings = [
      'Manager Referral Report',
      'Reference ID (Manager SAP code)',
      'Get Records',
      '© Mankind@2026. All rights reserved.',
    ];
    for (const expected of expectedStrings) {
      expect(text).toContain(expected);
    }

    const headers = await report.getColumnHeaders();
    const expectedHeaders = ['Referral date', 'iTAP Number', 'Candidate name', 'Email ID', 'Mobile number', 'Aadhaar number', 'Initial feedback'];
    for (const expected of expectedHeaders) {
      expect(headers).toContain(expected);
    }
  });
});

test.describe('Manager Referral Report - Grid Filters & Pagination', () => {
  let bf;
  let report;

  test.beforeAll(async () => {
    bf = new BrowserFactory();
    await bf.launchBrowser(config.MANAGER_REFERRAL_URL, config.browser, { shared: true });
    await new ManagerReferralPage(bf.page).clickOn_ViewReport();
    report = new ManagerReferralReportPage(bf.page);
  });

  test.beforeEach(async () => {
    await bf.resetForNextTest(config.MANAGER_REFERRAL_URL);
    await new ManagerReferralPage(bf.page).clickOn_ViewReport();
    // Confirmed live: the grid starts genuinely empty ("0 to 0 of 0") until
    // a real search actually runs - every filter/pagination test needs a
    // freshly populated grid to work with. config.ManagerRefID is the same
    // known-real SAP ID already confirmed to return real records (TC_02).
    await report.searchByReferenceId(config.ManagerRefID);
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const issue = bf.getEnvironmentIssuesSummary();
      if (issue) await testInfo.attach('environment-issue', { body: issue, contentType: 'text/plain' });
    }
  });

  test.afterAll(async () => {
    await bf.closeBrowser();
  });

  // Shared filter-column assertion: filter narrows the grid to only
  // matching rows, then clearing restores the original baseline count.
  async function assertColumnFilterWorks(headerText, matchingValue) {
    const baseline = await report.getRowCount();
    await report.filterByColumn(headerText, matchingValue);
    const filteredCount = await report.getRowCount();
    expect(filteredCount).toBeLessThanOrEqual(baseline);

    if (filteredCount > 0) {
      const values = await report.getColumnValues(headerText);
      for (const value of values) {
        expect(value.toLowerCase()).toContain(matchingValue.toLowerCase());
      }
    }

    await report.clearColumnFilter(headerText);
    const restoredCount = await report.getRowCount();
    expect(restoredCount).toBe(baseline);
  }

  // Excel TC_10 - Referral date's own filter format/widget is confirmed on
  // the first live run; falls back to whatever getFilterInput() resolves.
  test('TC_10: the Referral date column filter narrows and restores the grid', async () => {
    const baseline = await report.getRowCount();
    expect(baseline).toBeGreaterThan(0);
    const rows = report.gridRows;
    const firstDate = (await rows.first().locator('.td').nth(await report.getColumnIndex('Referral date')).textContent() || '').trim();
    await assertColumnFilterWorks('Referral date', firstDate);
  });

  // Excel TC_11
  test('TC_11: the iTAP Number column filter narrows and restores the grid', async () => {
    const rows = report.gridRows;
    await report.getRowCount();
    const idx = await report.getColumnIndex('iTAP Number');
    const sampleValue = (await rows.first().locator('.td').nth(idx).textContent() || '').trim();
    await assertColumnFilterWorks('iTAP Number', sampleValue);
  });

  // Excel TC_12
  test('TC_12: the Candidate name column filter narrows and restores the grid', async () => {
    const rows = report.gridRows;
    const idx = await report.getColumnIndex('Candidate name');
    const sampleValue = (await rows.first().locator('.td').nth(idx).textContent() || '').trim();
    await assertColumnFilterWorks('Candidate name', sampleValue);
  });

  // Excel TC_13
  test('TC_13: the Email ID column filter narrows and restores the grid', async () => {
    const rows = report.gridRows;
    const idx = await report.getColumnIndex('Email ID');
    const sampleValue = (await rows.first().locator('.td').nth(idx).textContent() || '').trim();
    await assertColumnFilterWorks('Email ID', sampleValue);
  });

  // Excel TC_14
  test('TC_14: the Mobile number column filter narrows and restores the grid', async () => {
    const rows = report.gridRows;
    const idx = await report.getColumnIndex('Mobile number');
    const sampleValue = (await rows.first().locator('.td').nth(idx).textContent() || '').trim();
    await assertColumnFilterWorks('Mobile number', sampleValue);
  });

  // Excel TC_15
  test('TC_15: the Aadhaar number column filter narrows and restores the grid', async () => {
    const rows = report.gridRows;
    const idx = await report.getColumnIndex('Aadhaar number');
    const sampleValue = (await rows.first().locator('.td').nth(idx).textContent() || '').trim();
    await assertColumnFilterWorks('Aadhaar number', sampleValue);
  });

  // Excel TC_16 - deferred in the workbook itself: "Initital feedback data
  // does not exist yet; will be tested later per instruction." Uses the
  // inside-body test.skip(condition, description) form (not the
  // test.skip(title, body) modifier) specifically so that description
  // reaches Playwright's own skip annotation - server.js's finalizeRun
  // already reads test.annotations[].description for a skipped test's
  // reason, so this alone is what makes the dashboard's Reason column show
  // "Pending" instead of falling back to its generic "Skipped (no reason
  // given)" text.
  test('TC_16: the Initial feedback column filter works correctly', async () => {
    test.skip(true, 'Pending');
  });

  // Excel TC_17
  test('TC_17: pagination controls navigate and enable/disable correctly', async () => {
    await expect(report.firstPageBtn).toBeDisabled();
    await expect(report.prevPageBtn).toBeDisabled();
    await expect(report.nextPageBtn).toBeEnabled();
    await expect(report.lastPageBtn).toBeEnabled();

    await report.nextPageBtn.click();
    await bf.page.waitForTimeout(1000);
    await expect(report.firstPageBtn).toBeEnabled();
    await expect(report.prevPageBtn).toBeEnabled();

    await report.lastPageBtn.click();
    await bf.page.waitForTimeout(1000);
    await expect(report.nextPageBtn).toBeDisabled();
    await expect(report.lastPageBtn).toBeDisabled();

    await report.firstPageBtn.click();
    await bf.page.waitForTimeout(1000);
    await expect(report.firstPageBtn).toBeDisabled();
    await expect(report.prevPageBtn).toBeDisabled();
  });
});
