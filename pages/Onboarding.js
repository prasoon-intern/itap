const BasePage = require('./BasePage');

/**
 * ITAP_OnboardingGrid
 * Page object for the Appointment > Onboarding grid: page structure/UI
 * elements, search & filter controls, Export To Excel, and the per-row
 * Document Status popup. Covers the read-only test cases from
 * "Test Cases/Onboarding Test Cases.xlsx" (ONB-005 through ONB-045) - no
 * letter generation/emails here (2026-09-02: split out into their own files
 * under pages/Onboarding/ - GenOfferLetter.js, GenAppointmentLetter.js;
 * DocumentVerification.js moved again 2026-09-08 into its own pages/HR/
 * module, since it's a distinct HR-only portal, not an FC Admin page).
 *
 * Column filters are located by their HEADER TEXT rather than hardcoded
 * Mendix auto-generated widget class names (e.g. "mx-name-drop_downFilter7")
 * - confirmed live this session that those numeric suffixes don't reliably
 * map to the same column across sessions/builds (a first attempt at reading
 * "Role" options by guessed class name actually returned "SF Integration
 * Status" values instead). Locating by the header text visible in the same
 * .th is slower per-call but correct regardless of Mendix's internal ids.
 */
class ITAP_OnboardingGrid extends BasePage {
  constructor(page) {
    super(page);

    // â”€â”€ Page identity / tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.pageHeader = 'h1.mx-title.mx-name-pageTitle1';
    this.tabs = 'ul.mx-tabcontainer-tabs li a';
    this.tabListItems = 'ul.mx-tabcontainer-tabs li';
    this.onboardingTabLink = "ul.mx-tabcontainer-tabs li a:has-text('Onboarding')";

    // â”€â”€ Active pane scoping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Interview/Training/Onboarding grids all render into the DOM
    // simultaneously (only one .tab-pane carries "active") - every query
    // below is scoped to it, same pattern as ITAP_InterviewGrid.js.
    this.activePane = '.tab-pane.active';

    // â”€â”€ Actionable items / action buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.actionableItemsBadge = `${this.activePane} span.badge`;
    this.exportToExcelBtn = `${this.activePane} button:has-text("Export To Excel")`;
    this.genOfferLetterBtn = `${this.activePane} button:has-text("Gen Offer Letter")`;
    this.genAppointmentLetterBtn = `${this.activePane} button:has-text("Gen Appointment Letter")`;
    this.genApprenticeLetterBtn = `${this.activePane} button:has-text("Gen Apprentice Letter")`;

    // â”€â”€ Grid structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.columnHeaders = `${this.activePane} .widget-datagrid-grid-body .th .column-header span`;
    this.columnThs = `${this.activePane} .widget-datagrid-grid-body .th`;
    this.gridRows = `${this.activePane} .widget-datagrid-grid-body .tr[role="row"]:not(:first-child)`;

    // â”€â”€ Pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.nextPageBtn = `${this.activePane} button[aria-label="Go to next page"]`;

    // â”€â”€ Document Status popup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.documentStatusIcon = "a[data-button-id*='SNIP_DocumentStatus.actionButton37']";
    this.dialog = "[role='dialog']";
    this.hrRemarksTextarea = "[role='dialog'] textarea";
    this.documentTableRows = "[role='dialog'] .widget-datagrid-grid-body .tr[role='row']:not(:first-child)";
    this.downloadAllDocsBtn = "[role='dialog'] button:has-text('Download All Docs')";
    this.closeDialogBtn = "[role='dialog'] .modal-header button.close, [role='dialog'] button:has-text('Close')";
  }

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async clickOnboardingTab() {
    await this.waitForVisible(this.onboardingTabLink);
    await this.click(this.onboardingTabLink);
  }

  // Same rationale as ITAP_InterviewGrid.waitForAppointmentPageReady(): the
  // sidebar/tab click resolves before the page header actually swaps in.
  //
  // Confirmed live (2026-09-02): a plain hasText: 'Appointment' does
  // substring matching, not exact matching - "Generate Appointment Letter"
  // (Gen Appointment Letter's own page title) ALSO contains "Appointment".
  // Mendix doesn't unmount the old page's <h1> the instant "Back" is
  // clicked, so during that brief transition BOTH headings can exist in the
  // DOM simultaneously, and the substring filter matched both -
  // "resolved to 2 elements" (a strict-mode violation), failing this wait
  // outright instead of just taking a moment longer. An exact-text regex
  // only ever matches the real grid header.
  async waitForAppointmentPageReady(timeout = 20000) {
    await this.page.locator(this.pageHeader).filter({ hasText: /^Appointment$/ }).waitFor({ state: 'visible', timeout });
  }

  async getTabTexts() {
    return this.getAllTexts(this.tabs);
  }

  // Polls rather than checking once - confirmed live (same finding as
  // ITAP_InterviewGrid.getActiveTabText()) that the tab bar's "active" class
  // can lag slightly behind the page header appearing.
  async getActiveTabText(attempts = 10, delayMs = 300) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const items = this.page.locator(this.tabListItems);
      const total = await items.count();
      for (let i = 0; i < total; i++) {
        const item = items.nth(i);
        const cls = (await item.getAttribute('class')) || '';
        if (cls.split(/\s+/).includes('active')) {
          return (await item.locator('a').first().textContent()).trim();
        }
      }
      await this.wait(delayMs);
    }
    return null;
  }

  async waitForGridDataLoaded(timeout = 15000) {
    await this.page.locator(this.gridRows).first().waitFor({ state: 'visible', timeout });
  }

  // â”€â”€ Actionable items / buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getActionableItemsText() {
    return (await this.getText(this.actionableItemsBadge)).trim();
  }

  async getActionableItemsCount() {
    const text = await this.getActionableItemsText();
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  async areActionButtonsVisible() {
    return {
      exportToExcel: await this.isVisible(this.exportToExcelBtn),
      genOfferLetter: await this.isVisible(this.genOfferLetterBtn),
      genAppointmentLetter: await this.isVisible(this.genAppointmentLetterBtn),
      genApprenticeLetter: await this.isVisible(this.genApprenticeLetterBtn),
    };
  }

  // â”€â”€ Grid structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getColumnHeaderTexts() {
    const texts = await this.getAllTexts(this.columnHeaders);
    return texts.map(t => t.replace(/ /g, ' ').trim()).filter(t => t.length > 0);
  }

  async getVisibleRowCount() {
    return this.count(this.gridRows);
  }

  // Locates the .th whose column-header span matches headerText exactly
  // (after whitespace normalization) - the one reliable anchor across
  // sessions, since Mendix's own auto-generated widget class suffixes are
  // NOT stable (confirmed live this session).
  thForColumn(headerText) {
    return this.page.locator(this.columnThs).filter({
      has: this.page.locator('.column-header span', { hasText: new RegExp(`^\\s*${headerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }),
    });
  }

  async getFilterTypeForColumn(headerText) {
    const th = this.thForColumn(headerText);
    if (await th.locator('.filter .dropdown-container').count()) return 'dropdown';
    if (await th.locator('.filter .date-filter-container, .filter .react-datepicker-wrapper').count()) return 'date';
    if (await th.locator(".filter input[type='number']").count()) return 'number';
    if (await th.locator('.filter .widget-combobox').count()) return 'combobox';
    if (await th.locator(".filter input[type='checkbox']").count()) return 'checkbox';
    if (await th.locator(".filter input[type='text']").count()) return 'text';
    return 'none';
  }

  async fillTextFilter(headerText, value) {
    const th = this.thForColumn(headerText);
    const input = th.locator(".filter input[type='text']").first();
    await input.fill(value);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    await this.wait(1500);
  }

  // Date-picker filters (Training Date, DOJ, ExtendedDOJ) render as a plain
  // text input inside a react-datepicker wrapper - same fill+Enter mechanic
  // as a text filter, just a different inner selector.
  async fillDateFilter(headerText, value) {
    const th = this.thForColumn(headerText);
    const input = th.locator('.filter .react-datepicker-wrapper input').first();
    await input.fill(value);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    await this.wait(1500);
  }

  async fillNumberFilter(headerText, value) {
    const th = this.thForColumn(headerText);
    const input = th.locator(".filter input[type='number']").first();
    await input.fill(String(value));
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    await this.wait(1500);
  }

  // Maps a column header to its .td index for a data row. The leading
  // checkbox column has no header text (filtered out by
  // getColumnHeaderTexts()), so a matched header at array index i
  // corresponds to .td index i+1.
  async getColumnIndex(headerText) {
    const headers = await this.getColumnHeaderTexts();
    const idx = headers.findIndex(h => h === headerText);
    if (idx === -1) throw new Error(`getColumnIndex(): column "${headerText}" not found in headers [${headers.join(', ')}]`);
    return idx + 1;
  }

  async getColumnValueForRowIndex(rowIndex, headerText) {
    const colIndex = await this.getColumnIndex(headerText);
    const cell = this.page.locator(this.gridRows).nth(rowIndex).locator('.td').nth(colIndex);
    return (await cell.textContent()).replace(/\s+/g, ' ').trim();
  }

  async isNextPageEnabled() {
    const btn = this.page.locator(this.nextPageBtn).first();
    if (!(await btn.count())) return false;
    return btn.isEnabled();
  }

  async goToNextPage() {
    await this.page.locator(this.nextPageBtn).first().click();
    await this.wait(1200);
  }

  // Scans every page of the currently-applied filter for the first row with
  // a non-empty value in the given column, returning {regId, value} or null
  // if no page has one. Needed because a single page (10 rows) of "Demo"
  // candidates can easily all be missing a given column's data by chance -
  // this is a real, moving-target dataset, not fixed test fixtures.
  async findFirstNonEmptyColumnValueAcrossPages(headerText, maxPages = 10) {
    for (let page = 0; page < maxPages; page++) {
      // waitForGridDataLoaded() only confirms the FIRST row's skeleton is
      // visible - individual cell text (e.g. Employee ID) can still be a
      // render-tick behind that (same class of lag documented elsewhere in
      // this project: "Actionable Items: 0" momentarily even once pagination
      // already shows "1 to 10"). Confirmed live this is inconsistent
      // between runs even with a fixed wait - re-scans this same page up to
      // 3 times, 500ms apart, before concluding it's genuinely empty and
      // moving on, rather than trusting a single read.
      let found = null;
      for (let attempt = 0; attempt < 3 && !found; attempt++) {
        if (attempt > 0) await this.wait(500);
        const rowCount = await this.getVisibleRowCount();
        for (let i = 0; i < rowCount; i++) {
          const value = await this.getColumnValueForRowIndex(i, headerText);
          if (value) {
            const regId = await this.getColumnValueForRowIndex(i, 'Reg ID');
            found = { regId, value, page };
            break;
          }
        }
      }
      if (found) return found;
      if (!(await this.isNextPageEnabled())) break;
      await this.goToNextPage();
    }
    return null;
  }

  async filterByRegId(value) {
    await this.fillTextFilter('Reg ID', value);
  }

  async filterByName(value) {
    await this.fillTextFilter('Candidate Name', value);
  }

  async getDropdownFilterOptions(headerText) {
    const th = this.thForColumn(headerText);
    const trigger = th.locator('input.dropdown-triggerer');
    await trigger.click();
    await this.wait(500);
    const options = await this.getAllTexts("[role='listbox'] li, .dropdown-list li, ul[id*='dropdown-list'] li");
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    return options.map(o => o.trim()).filter(Boolean);
  }

  async filterByDropdown(headerText, optionText) {
    const th = this.thForColumn(headerText);
    const trigger = th.locator('input.dropdown-triggerer');
    await trigger.click();
    await this.wait(500);
    await this.page.locator("[role='listbox'] li, .dropdown-list li, ul[id*='dropdown-list'] li", { hasText: optionText }).first().click();
    await this.wait(1500);
  }

  async clearDropdownFilter(headerText) {
    const th = this.thForColumn(headerText);
    const trigger = th.locator('input.dropdown-triggerer');
    await trigger.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    await this.wait(1000);
  }

  // Sweeps EVERY column's filter (text/number/date + dropdown), clearing
  // any that currently holds a value - not just a fixed short list.
  // Confirmed live this project: a narrower, hardcoded-list version of this
  // (matching ITAP_InterviewGrid.clearAllFilters()'s deliberate scoping,
  // which only ever needs 2 text filters on that grid) let a leftover
  // Preference HQ/Training Date/DOJ/Salary filter from an EARLIER test in
  // the same file silently narrow a LATER, unrelated "Demo" query almost to
  // nothing - the exact failure mode ONB-038 exists to guard against, which
  // this suite was itself briefly guilty of. Onboarding's grid has far more
  // filter columns than Interview's, so a generic full sweep is the safer
  // default here.
  async clearAllFilters() {
    const thCount = await this.page.locator(this.columnThs).count();
    for (let i = 0; i < thCount; i++) {
      const th = this.page.locator(this.columnThs).nth(i);
      const textOrNumberInput = th.locator(".filter input[type='text']:not(.dropdown-triggerer), .filter input[type='number']").first();
      if (await textOrNumberInput.count()) {
        const current = await textOrNumberInput.inputValue().catch(() => '');
        if (current !== '') {
          await textOrNumberInput.fill('');
          await this.page.keyboard.press('Enter');
          await this.waitForPageLoad();
          await this.wait(800);
        }
        continue;
      }
      const dateInput = th.locator('.filter .react-datepicker-wrapper input').first();
      if (await dateInput.count()) {
        const current = await dateInput.inputValue().catch(() => '');
        if (current !== '') {
          await dateInput.fill('');
          await this.page.keyboard.press('Enter');
          await this.waitForPageLoad();
          await this.wait(800);
        }
        continue;
      }
      const dropdownTrigger = th.locator('input.dropdown-triggerer').first();
      if (await dropdownTrigger.count()) {
        const current = await dropdownTrigger.inputValue().catch(() => '');
        if (current !== '') {
          await dropdownTrigger.click();
          await this.page.keyboard.press('Control+A');
          await this.page.keyboard.press('Backspace');
          await this.page.keyboard.press('Enter');
          await this.waitForPageLoad();
          await this.wait(800);
        }
      }
    }
  }

  // â”€â”€ Row selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async checkFirstRowCheckbox() {
    await this.page.locator(this.gridRows).first().locator("input[type='checkbox']").check({ force: true });
    await this.wait(500);
  }

  async checkRowByIndex(index) {
    await this.page.locator(this.gridRows).nth(index).locator("input[type='checkbox']").check({ force: true });
    await this.wait(500);
  }

  // Confirmed live this project: row selection is NOT reset by changing the
  // grid's filter - a row checked while filtered to candidate A stays
  // checked (just off-screen) after re-filtering to candidate B, and a
  // subsequent Gen Letter click can then act on BOTH selected candidates at
  // once (surfaced as the wrong validation dialog winning). Any test that
  // switches between candidates within the same session must uncheck the
  // previous row - while it's still visible/filtered-in - before moving on.
  async uncheckAllVisibleRows() {
    const count = await this.getVisibleRowCount();
    for (let i = 0; i < count; i++) {
      const cb = this.page.locator(this.gridRows).nth(i).locator("input[type='checkbox']");
      if (await cb.isChecked().catch(() => false)) {
        await cb.uncheck({ force: true });
        await this.wait(300);
      }
    }
  }

  // Finds a row index among currently-visible rows matching the given
  // Role/Division, skipping any Reg ID already in avoidRegIds - same
  // "never trust a hardcoded candidate value" discipline as
  // getFirstRowRegId(), used to pick a not-yet-mutated "Demo User Alpha"
  // row across multiple test files in the same suite.
  async findRowIndexByRoleDivision(role, division, avoidRegIds = []) {
    const rowCount = await this.getVisibleRowCount();
    for (let i = 0; i < rowCount; i++) {
      const cells = await this.page.locator(this.gridRows).nth(i).locator('.td').allTextContents();
      const regId = cells[1]?.trim();
      const rowRole = cells[3]?.trim();
      const rowDivision = cells[4]?.trim();
      if (rowRole === role && rowDivision === division && !avoidRegIds.includes(regId)) {
        return { index: i, regId };
      }
    }
    return { index: -1, regId: null };
  }

  async getFirstRowCellsText() {
    const cells = await this.page.locator(this.gridRows).first().locator('.td').allTextContents();
    return cells.map(c => c.replace(/\s+/g, ' ').trim());
  }

  // Reg ID is confirmed cell index 1 (index 0 is the checkbox column) -
  // same convention as ITAP_InterviewGrid.getFirstRowRegId(), including the
  // same defensive numeric check so a bad read fails loudly instead of
  // silently propagating into a per-row action on the wrong candidate.
  async getFirstRowRegId() {
    const cell = this.page.locator(`${this.gridRows} .td`).nth(1);
    const text = (await cell.textContent()).trim();
    if (!/^\d+$/.test(text)) {
      throw new Error(`getFirstRowRegId(): expected a numeric Reg ID, got "${text}" - check the filter actually matched a row first.`);
    }
    return text;
  }

  // Confirmed live: a plain click on this button can occasionally not
  // register at all (same class of "Mendix click sometimes silently doesn't
  // register" issue documented repeatedly elsewhere in this project, e.g.
  // ITAP_InterviewSchedule.clickScheduleInterview()) - verify the letter
  // page actually loaded (page title changes to "Generate Offer Letter"),
  // retry with a raw JS click otherwise.
  async clickGenOfferLetterAndWaitForPage(attempts = 4) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const btn = this.page.locator(this.genOfferLetterBtn);
      if (attempt === 0) await btn.click();
      else await btn.evaluate(el => el.click()).catch(() => {});
      await this.wait(2000);
      const title = await this.page.title();
      if (/Generate Offer Letter/i.test(title)) return true;
    }
    return false;
  }

  // Same verify-and-retry click pattern as clickGenOfferLetterAndWaitForPage,
  // but ALSO distinguishes "didn't register yet" from a genuine validation
  // dialog (e.g. "Documents are not verified...", "Please select only MCPPL
  // division...") - a real business-rule block should be reported once and
  // dismissed, not retried, since retrying a real validation block wastes
  // time and can leave stray dialogs open for the next test.
  async clickGenAppointmentLetterAndWaitForPage(attempts = 4) {
    return this._clickGenLetterButtonAndWaitForPage(this.genAppointmentLetterBtn, /Generate Appointment Letter/i, attempts);
  }

  async clickGenApprenticeLetterAndWaitForPage(attempts = 4) {
    return this._clickGenLetterButtonAndWaitForPage(this.genApprenticeLetterBtn, /Generate Apprentice Letter/i, attempts);
  }

  async _clickGenLetterButtonAndWaitForPage(buttonSelector, titleRegex, attempts) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const btn = this.page.locator(buttonSelector);
      if (attempt === 0) await btn.click();
      else await btn.evaluate(el => el.click()).catch(() => {});
      await this.wait(2000);

      const title = await this.page.title();
      if (titleRegex.test(title)) return { opened: true, dialogText: null };

      const dialog = this.page.locator("[role='dialog']").first();
      const dialogVisible = await dialog.isVisible({ timeout: 1500 }).catch(() => false);
      if (dialogVisible) {
        const dialogText = (await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        // This dialog can auto-dismiss/detach on its own within a couple
        // seconds (same "modal vs. self-dismissing toast" inconsistency
        // documented elsewhere in this app) - confirmed live: an unbounded
        // click() here retried for the entire test timeout before the
        // browser got force-closed out from under it. Bounded and
        // swallowed - dialogText above is already captured either way.
        const okBtn = this.page.locator("[role='dialog'] button:has-text('OK'), [role='dialog'] button:has-text('Ok')");
        await okBtn.first().click({ timeout: 3000 }).catch(() => {});
        return { opened: false, dialogText };
      }
    }
    return { opened: false, dialogText: null };
  }

  // â”€â”€ Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async clickExportToExcel() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 10000 }),
      this.click(this.exportToExcelBtn),
    ]);
    return download;
  }

  // â”€â”€ Document Status popup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async openDocumentStatusPopupForFirstRow() {
    await this.click(`${this.gridRows} >> nth=0 >> ${this.documentStatusIcon}`);
    await this.wait(1500);
  }

  async getDocumentStatusPopupTitle() {
    return (await this.getText("[role='dialog'] .modal-header h4, [role='dialog'] h4")).trim();
  }

  async getDocumentStatusPopupSummary() {
    const text = await this.getText(this.dialog);
    return text.replace(/\s+/g, ' ').trim();
  }

  async getHrRemarksValue() {
    return this.page.locator(this.hrRemarksTextarea).first().inputValue();
  }

  async isDownloadAllDocsVisible() {
    return this.isVisible(this.downloadAllDocsBtn);
  }

  async closeDocumentStatusPopup() {
    await this.click(this.closeDialogBtn);
    await this.wait(500);
  }
}

module.exports = { ITAP_OnboardingGrid };
