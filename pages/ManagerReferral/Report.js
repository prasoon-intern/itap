// pages/ManagerReferral/Report.js — the "Manager Referral Report" view,
// reached from the referral form via ManagerReferralPage.clickOn_ViewReport().
//
// The data grid uses the same Mendix datagrid widget/markup convention as
// the Onboarding/Interview grids elsewhere in this suite (see
// pages/Onboarding.js's own comment on this): one .th per column, a
// .column-header span for the header text, and a .filter input inside each
// .th for that column's filter. Reused here rather than reinvented.
class ManagerReferralReportPage {
  constructor(page) {
    this.page = page;

    this.referenceIdSearch = page.locator("//input[contains(@id,'ManagerReport.textBox1')]");
    // Confirmed live: two "Get Records" buttons exist in the DOM (one is
    // presumably a duplicate/alternate layout state) - .first() avoids a
    // strict-mode multi-match, matching the same defensive pattern used for
    // Mendix validation-message locators elsewhere in this codebase.
    this.getRecordsBtn = page.locator("//*[contains(@data-button-id,'ManagerReport.actionButton15')]").first();

    this.resultDialog = page.locator("div[role='dialog']").first();

    this.columnThs = this.page.locator('.widget-datagrid-grid-body .th');
    this.gridRows = this.page.locator('.widget-datagrid-grid-body .tr[role="row"]:not(:first-child)');

    // First-of-4 assumed DOM order first/previous/next/last - confirmed
    // live during the first headed pass; flagged here since none of the 4
    // pagination buttons expose a distinguishing class or label of their own.
    this.paginationButtons = page.locator('.pagination-button');
    this.firstPageBtn = this.paginationButtons.nth(0);
    this.prevPageBtn  = this.paginationButtons.nth(1);
    this.nextPageBtn  = this.paginationButtons.nth(2);
    this.lastPageBtn  = this.paginationButtons.nth(3);

    // Confirmed live: renders twice (a visible div plus a duplicate
    // sr-only span for accessibility) - .first() avoids a strict-mode
    // multi-match, same as elsewhere in this file.
    this.paginationCountText = page.locator('.paging-status').first();

    // Confirmed live: same Mankind header image used on the referral form
    // (ManagerReferralPage.headerLogo) - has no alt text, so it can only be
    // checked by visibility, identified by its src instead.
    this.headerLogo = page.locator('img[src*="MankindUIResources"]');
  }

  /**
   * Full page's visible text, for checking the fixed UI copy on the page
   * (title, field label, button text, footer) is present and correctly
   * worded - not covered by getColumnHeaders() or the component-visibility
   * check in TC_01.
   */
  async getPageText() {
    return (await this.page.locator('body').innerText()).trim();
  }

  // Confirmed live: a search that actually matches real records triggers a
  // genuine server round trip (observed 4-10s+, variable) followed by a
  // full grid reload - slower, and less consistent, than every other
  // action in this suite. Waits for whichever outcome actually happens
  // first (a populated grid, or the "No Record Found!" modal) instead of a
  // fixed sleep, since a flat timeout long enough for the slow case made
  // the fast case unnecessarily slow and still occasionally lost the race.
  async waitForSearchResult() {
    await Promise.race([
      this.gridRows.first().waitFor({ state: 'visible', timeout: 25000 }).catch(() => {}),
      this.resultDialog.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {}),
    ]);
    // Small settle buffer for the grid/header re-render right after the
    // first row becomes visible.
    await this.page.waitForTimeout(800);
  }

  async searchByReferenceId(value) {
    await this.referenceIdSearch.fill(value);
    await this.getRecordsBtn.click();
    await this.waitForSearchResult();
  }

  async getResultDialogText() {
    await this.resultDialog.waitFor({ state: 'visible', timeout: 10000 });
    return (await this.resultDialog.innerText()).trim();
  }

  async closeResultDialog() {
    await this.resultDialog.getByRole('button', { name: 'OK' }).click();
    await this.page.waitForTimeout(300);
  }

  async getRowCount() {
    return this.gridRows.count();
  }

  // Per-.th header lookup (not a flat page-level query for every
  // .column-header span) - confirmed live that headers render twice in the
  // DOM per column (a hidden duplicate), which would otherwise double-count.
  async getColumnHeaders() {
    await this.columnThs.first().waitFor({ state: 'visible', timeout: 15000 });
    const count = await this.columnThs.count();
    const headers = [];
    for (let i = 0; i < count; i++) {
      const text = await this.columnThs.nth(i).locator('.column-header span').first().textContent();
      headers.push((text || '').trim());
    }
    return headers.filter(Boolean);
  }

  // Locates the .th whose header text matches exactly.
  async getColumnTh(headerText) {
    const headers = await this.getColumnHeaders();
    const idx = headers.indexOf(headerText);
    if (idx === -1) throw new Error(`getColumnTh(): column "${headerText}" not found in headers [${headers.join(', ')}]`);
    return this.columnThs.nth(idx);
  }

  // Text filter, or a date-picker filter (react-datepicker convention, same
  // as pages/Onboarding.js's date columns) - whichever this column actually
  // renders.
  async getFilterInput(headerText) {
    const th = await this.getColumnTh(headerText);
    const textInput = th.locator(".filter input[type='text']").first();
    if (await textInput.count()) return textInput;
    return th.locator('.filter .react-datepicker-wrapper input').first();
  }

  async filterByColumn(headerText, value) {
    const input = await this.getFilterInput(headerText);
    await input.fill(value);
    await this.page.waitForTimeout(1000);
  }

  async clearColumnFilter(headerText) {
    const input = await this.getFilterInput(headerText);
    await input.fill('');
    await this.page.waitForTimeout(1000);
  }

  async getColumnIndex(headerText) {
    const headers = await this.getColumnHeaders();
    const idx = headers.indexOf(headerText);
    if (idx === -1) throw new Error(`getColumnIndex(): column "${headerText}" not found in headers [${headers.join(', ')}]`);
    return idx;
  }

  // Every visible row's text for one column - used to confirm a filter's
  // results all genuinely match the typed value.
  async getColumnValues(headerText) {
    const idx = await this.getColumnIndex(headerText);
    const count = await this.gridRows.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const cell = this.gridRows.nth(i).locator('.td').nth(idx);
      values.push((await cell.textContent() || '').trim());
    }
    return values;
  }
}

module.exports = { ManagerReferralReportPage };
