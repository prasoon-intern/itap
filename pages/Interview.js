const BasePage = require('./BasePage');
const config = require('../config');

/**
 * Consolidated Interview-module (FC Admin > Appointment > Interview) page
 * object. Contains 2 classes:
 * ITAP_InterviewGrid (grid UI/search/filters) and ITAP_ReScheduleInterview
 * (Re-Schedule Interview page). The rest of the module's page objects were
 * split out (2026-09-02) into pages/Interview/: Setup.js
 * (ITAP_InterviewSetup - search/select candidate, Schedule Interview form,
 * Allocate/Submit/Confirm), PreviewInterviewerEmail.js
 * (ITAP_PreviewInterviewerEmail), PreviewCandidateEmail.js
 * (ITAP_PreviewCandidateEmail), and StatusFeedback.js
 * (ITAP_InterviewStatusFeedback + ITAP_fillFeedbackform).
 */
/**
 * ITAP_InterviewGrid
 * Page object for the Appointment > Interview grid: page structure/UI
 * elements and the search & filter controls. Covers the Phase 1 test cases
 * from "Fc_admin interview.xlsx" (Page Structure & UI Elements + Interview
 * Grid - Search & Filters modules) - all read-only, no scheduling/emails.
 */
class ITAP_InterviewGrid extends BasePage {
  constructor(page) {
    super(page);

    // ── Page identity ────────────────────────────────────────────────────
    this.pageHeader = 'h1.mx-title.mx-name-pageTitle1';
    this.loggedInUserName = '.layout_username';
    this.sidebarLogo = '.LogoNoShow img.mx-image';

    // ── Sidebar navigation ───────────────────────────────────────────────
    this.sidebarItems = 'ul.mx-navigationlist li.mx-navigationlist-item span.mx-text';
    this.sidebarNavItems = 'ul.mx-navigationlist li.mx-navigationlist-item';
    this.sidebarToggle = '.mx-name-sidebarToggle1';

    // ── Tabs ─────────────────────────────────────────────────────────────
    this.tabs = 'ul.mx-tabcontainer-tabs li a';
    this.tabListItems = 'ul.mx-tabcontainer-tabs li';

    // ── Actionable items / action buttons ───────────────────────────────
    // Scoped to the active tab-pane for the same reason as the grid
    // structure below - Training/Onboarding render the same widget names.
    this.actionableItemsBadge = '.tab-pane.active span.badge';
    this.exportToExcelBtn = '.tab-pane.active button:has-text("Export To Excel")';
    this.feedbacksExportBtn = '.tab-pane.active button:has-text("Feedbacks Export")';
    this.reScheduleBtn = '.tab-pane.active button:has-text("Re-Schedule Interview")';
    this.scheduleInterviewBtn = '.tab-pane.active .mx-name-actionButton13';

    // ── Grid structure ───────────────────────────────────────────────────
    // Scoped to ".tab-pane.active" because Training/Onboarding grids are
    // also present (but hidden) in the DOM under their own inactive
    // tab-panes, and Playwright's text queries don't care about visibility.
    this.activeTabPane = '.tab-pane.active';
    this.columnHeaders = '.tab-pane.active .widget-datagrid-grid-body .th .column-header span';
    this.gridRows = '.tab-pane.active .widget-datagrid-grid-body .tr[role="row"]:not(:first-child)';
    this.firstRowChevron = '.tab-pane.active .mx-name-actionButton6.chevron';
    this.firstRowCheckbox = '.tab-pane.active .mx-name-checkBox4 input[type="checkbox"]';
    this.firstRowEdit = '.tab-pane.active .mx-name-actionButton38';
    this.firstRowRefresh = '.tab-pane.active .mx-name-actionButton44';
    this.paginationRange = '.widget-datagrid-content ~ * , .paging-status';
    this.paginationText = 'text=/\\d+ to \\d+ of \\d+/';

    // ── Filters ──────────────────────────────────────────────────────────
    // Scoped to the active tab-pane - Training/Onboarding grids reuse the
    // same auto-generated Mendix widget names (confirmed live: unscoped
    // column-header/text queries picked up all three tabs' hidden markup).
    this.regIdFilter = ".tab-pane.active .mx-name-textFilter4 input[type='text']";
    this.nameFilter = ".tab-pane.active .mx-name-textFilter7 input[type='text']";
    this.applicationCountFilter = ".tab-pane.active .mx-name-numberFilter2 input";
    this.dateFilterInput = ".tab-pane.active .mx-name-dateFilter4 input";
    this.dropdownFilters = {
      Role: '.tab-pane.active .mx-name-drop_downFilter26',
      Division: '.tab-pane.active .mx-name-drop_downFilter23',
      Experienced: '.tab-pane.active .mx-name-drop_downFilter27',
      'Final Status': '.tab-pane.active .mx-name-drop_downFilter22',
      'Current Round': '.tab-pane.active .mx-name-drop_downFilter24',
      'Next round': '.tab-pane.active .mx-name-drop_downFilter21',
    };
  }

  // ── Page identity ────────────────────────────────────────────────────────

  // The sidebar's "active" class flips as soon as the Appointment link is
  // clicked, but the main content pane (still showing the Home Dashboard
  // tile launcher at that instant) swaps in asynchronously afterward - a
  // fixed short wait isn't reliable. Wait for the actual header text instead.
  async waitForAppointmentPageReady(timeout = 20000) {
    await this.page.locator(this.pageHeader).filter({ hasText: 'Appointment' }).waitFor({ state: 'visible', timeout });
  }

  // The header appears before the grid's candidate rows finish loading
  // (confirmed live: "Actionable Items: 0" and zero rendered rows for a
  // moment right after navigation, even though pagination already shows
  // "1 to 10"). Row-dependent checks need to wait for actual data, not just
  // the page shell.
  async waitForGridDataLoaded(timeout = 15000) {
    await this.page.locator(this.gridRows).first().waitFor({ state: 'visible', timeout });
  }

  async getBrowserTabTitle() {
    return this.getTitle();
  }

  async getPageHeaderText() {
    return (await this.getText(this.pageHeader)).trim();
  }

  async getLoggedInUserNameText() {
    return (await this.getText(this.loggedInUserName)).trim();
  }

  async isSidebarLogoVisible() {
    return this.isVisible(this.sidebarLogo);
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────
  async getSidebarItemTexts() {
    const texts = await this.getAllTexts(this.sidebarItems);
    return texts.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  // Confirmed live: unlike the Interview/Training/Onboarding tabs (which
  // genuinely carry class="active"), the sidebar's highlight on the current
  // item is NOT backed by an "active" class at all - inspecting the real DOM
  // showed plain class="mx-navigationlist-item" even while visibly
  // highlighted. So "is this item marked active" is checked by comparing its
  // rendered background color against an item known not to be selected,
  // rather than by class name.
  // Confirmed live (standalone, immediately after login) that this correctly
  // resolves to a distinct background for the truly active item vs. every
  // other one. A dashboard-triggered headed run once saw this flake (a
  // different, unclicked item appeared highlighted instead) - most likely a
  // rendering-timing race under the heavier load of several sequential
  // BrowserFactory sessions in one long headed+slowMo command, since the
  // page header text (waited on beforehand) can settle before the sidebar's
  // own highlight style finishes applying. Retries briefly rather than
  // checking only once.
  async isSidebarItemVisuallyHighlighted(itemText, contrastItemText = 'Home Dashboard', attempts = 5, delayMs = 500) {
    const target = this.page.locator(this.sidebarNavItems).filter({ hasText: itemText }).first();
    const other = this.page.locator(this.sidebarNavItems).filter({ hasText: contrastItemText }).first();
    for (let i = 0; i < attempts; i++) {
      const targetBg = await target.evaluate(el => getComputedStyle(el).backgroundColor);
      const otherBg = await other.evaluate(el => getComputedStyle(el).backgroundColor);
      if (targetBg !== otherBg) return true;
      if (i < attempts - 1) await this.wait(delayMs);
    }
    return false;
  }

  async toggleSidebar() {
    await this.click(this.sidebarToggle);
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  async getTabTexts() {
    return this.getAllTexts(this.tabs);
  }

  async getActiveTabText() {
    // Confirmed live: waitForAppointmentPageReady() only waits for the page
    // HEADER ("Appointment") to appear, not for the tab bar (Interview/
    // Training/Onboarding) to finish rendering its "active" class - calling
    // this immediately after can genuinely see zero tabs marked active yet.
    // Poll briefly rather than returning null on the first (possibly too
    // early) check.
    for (let attempt = 0; attempt < 10; attempt++) {
      const items = this.page.locator(this.tabListItems);
      const total = await items.count();
      for (let i = 0; i < total; i++) {
        const item = items.nth(i);
        const cls = (await item.getAttribute('class')) || '';
        if (cls.split(/\s+/).includes('active')) {
          return (await item.locator('a').first().textContent()).trim();
        }
      }
      await this.wait(300);
    }
    return null;
  }

  // ── Actionable items / buttons ─────────────────────────────────────────
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
      feedbacksExport: await this.isVisible(this.feedbacksExportBtn),
      reSchedule: await this.isVisible(this.reScheduleBtn),
      scheduleInterview: await this.isVisible(this.scheduleInterviewBtn),
    };
  }

  // ── Grid structure ───────────────────────────────────────────────────────
  async getColumnHeaderTexts() {
    const texts = await this.getAllTexts(this.columnHeaders);
    return texts.map(t => t.replace(/\u00a0/g, ' ').trim()).filter(t => t.length > 0);
  }

  async getVisibleRowCount() {
    return this.count(this.gridRows);
  }

  // Reg ID is confirmed the first column (see INT-83). Used to pull a
  // real, currently-valid Reg ID off a live row instead of hardcoding one -
  // fixed Reg IDs go stale as soon as that day's dummy candidate rotates out.
  async getFirstRowRegId() {
    // Confirmed live: cell 0 is the icon column (chevron/checkbox/edit/
    // refresh, always empty text) - Reg ID is cell 1, not the first cell.
    // A caller that trusts an empty return here without checking can end up
    // acting on an unfiltered/wrong grid row - always validate the result.
    const cell = this.page.locator(`${this.gridRows} .td`).nth(1);
    const text = (await cell.textContent()).trim();
    if (!/^\d+$/.test(text)) {
      throw new Error(`getFirstRowRegId(): expected a numeric Reg ID, got "${text}" - check the filter actually matched a row first.`);
    }
    return text;
  }

  // "Interview Batch" is the shared middle/last name every daily fresh
  // dummy candidate gets (see AutoAssignFreshCandidateName.spec.js) - but
  // the "testNN" first-name part recycles across different days (the
  // counter resets daily), so multiple candidates named e.g. "Test12
  // Interview Batch" can coexist from different days. Reg IDs are
  // monotonically increasing on creation, so the highest one among all
  // "Interview Batch" rows is always today's freshest candidate.
  async findFreshestInterviewBatchCandidate() {
    await this.filterByName('Interview Batch');
    await this.wait(1500);
    const rowCount = await this.getVisibleRowCount();
    let best = null;
    for (let i = 0; i < rowCount; i++) {
      const regIdText = (await this.page.locator(this.gridRows).nth(i).locator('.td').nth(1).textContent()).trim();
      const regId = parseInt(regIdText, 10);
      if (Number.isFinite(regId) && (!best || regId > best)) best = regId;
    }
    await this.clearAllFilters();
    return best !== null ? String(best) : null;
  }

  /**
   * Same idea as findFreshestInterviewBatchCandidate(), but returns the N
   * highest Reg IDs among all "Interview Batch" rows (for multi-candidate
   * batch scheduling tests, which need 2+ still-eligible candidates at
   * once).
   */
  async findFreshestInterviewBatchCandidates(n = 2) {
    await this.filterByName('Interview Batch');
    await this.wait(1500);
    const rowCount = await this.getVisibleRowCount();
    const regIds = [];
    for (let i = 0; i < rowCount; i++) {
      const regIdText = (await this.page.locator(this.gridRows).nth(i).locator('.td').nth(1).textContent()).trim();
      const regId = parseInt(regIdText, 10);
      if (Number.isFinite(regId)) regIds.push(regId);
    }
    await this.clearAllFilters();
    return regIds.sort((a, b) => b - a).slice(0, n).map(String);
  }

  // Confirmed live: this is NOT an inline row expand - it opens an
  // "Interview rounds detail" MODAL (Reg ID / Candidate Name / Role /
  // Division / Rounds / Date & Time of Interview / Interviewers / Status).
  async clickFirstRowChevron() {
    await this.click(this.firstRowChevron);
    await this.wait(800);
  }

  async getInterviewRoundsDialogTitle() {
    // Confirmed live: the popup is a Mendix modal window, title lives in
    // ".modal-header h4", not a semantic heading tag.
    const title = await this.getText("[role='dialog'] .modal-header h4");
    return title ? title.trim() : null;
  }

  async closeInterviewRoundsDialog() {
    await this.click("[role='dialog'] .modal-header button.close");
    await this.wait(500);
  }

  // Re-Schedule Interview's "Search by Interviewer" flow needs an
  // interviewer + date that actually match an existing SCHEDULED round -
  // confirmed live, hardcoding one goes stale exactly like the INT-07 bug
  // did. Scans the "Test Can" rows' rounds-detail modals (Reg ID / Candidate
  // Name / Role / Division / Rounds / Date & Time of Interview / Interviewers
  // / Status / Feedback columns) for the first row whose Status button reads
  // "Scheduled", and returns its interviewer + date converted to dd/mm/yyyy
  // (the modal shows "dd-mm-yyyy, hh:mm AM-hh:mm AM"; the Re-Schedule page's
  // Date field takes dd/mm/yyyy).
  async findScheduledRoundInterviewerAndDate(maxRowsToCheck = 5) {
    await this.filterByName('Test Can');
    await this.wait(2000);
    const rowCount = Math.min(await this.getVisibleRowCount(), maxRowsToCheck);

    for (let i = 0; i < rowCount; i++) {
      await this.page.locator(this.firstRowChevron).nth(i).click();
      await this.wait(800);

      const modalRows = this.page.locator("[role='dialog'] .widget-datagrid-grid-body .tr[role='row']:not(:first-child)");
      const modalRowCount = await modalRows.count();
      for (let r = 0; r < modalRowCount; r++) {
        const cells = modalRows.nth(r).locator('.td');
        const statusText = (await cells.nth(7).innerText()).trim();
        if (/scheduled/i.test(statusText) && !/not scheduled/i.test(statusText)) {
          const regId = (await cells.nth(0).innerText()).trim();
          const dateTimeRaw = (await cells.nth(5).innerText()).trim(); // "dd-mm-yyyy, hh:mm AM-hh:mm AM"
          const interviewer = (await cells.nth(6).innerText()).trim();
          const dateOnly = dateTimeRaw.split(',')[0].trim().replace(/-/g, '/');
          await this.closeInterviewRoundsDialog();
          await this.clearAllFilters();
          // regId is the specific candidate this interviewer+date belongs
          // to - confirmed live that the Re-Schedule page's Schedule Slot
          // search is scoped to whichever row was checked before opening
          // it, so callers MUST filter/check this exact regId, not just
          // any "Test Can" row, or the slot search comes back empty.
          return { regId, interviewer, date: dateOnly };
        }
      }
      await this.closeInterviewRoundsDialog();
    }

    await this.clearAllFilters();
    return null;
  }

  async isFirstRowCheckboxChecked() {
    return this.page.locator(this.firstRowCheckbox).first().isChecked();
  }

  async checkFirstRowCheckbox() {
    await this.page.locator(this.firstRowCheckbox).first().check({ force: true });
    await this.wait(500);
  }

  async uncheckFirstRowCheckbox() {
    await this.page.locator(this.firstRowCheckbox).first().uncheck({ force: true }).catch(() => {});
    await this.wait(500);
  }

  // Confirmed live: data-disabled is a static attribute that always reads
  // "false" regardless of actual state - the real signal is the computed
  // pointer-events value ("none" when disabled, "auto" when enabled), which
  // tracks a CSS class swap between "disableScheduleinterviewbutton" and
  // "ScheduleInterviewButton".
  async isScheduleInterviewButtonEnabled() {
    const pointerEvents = await this.page.locator(this.scheduleInterviewBtn).evaluate(el => getComputedStyle(el).pointerEvents);
    return pointerEvents !== 'none';
  }

  // Same real disabled-state signal as isScheduleInterviewButtonEnabled()
  // above (data-disabled is always "false"; pointer-events tracks the
  // actual enable/disable class swap) - confirmed live for this button too.
  async isReScheduleButtonEnabled() {
    const pointerEvents = await this.page.locator(this.reScheduleBtn).evaluate(el => getComputedStyle(el).pointerEvents);
    return pointerEvents !== 'none';
  }

  // Confirmed live: this is the same "Candidate Status" popup reachable via
  // the status icon elsewhere in the flow, not a separate editor. Opens it
  // and leaves it open for the caller to close (via cancelEditDialog()).
  async clickFirstRowEditIcon() {
    await this.click(this.firstRowEdit);
    await this.wait(1000);
  }

  async isDialogOpen() {
    return (await this.count("[role='dialog']:visible")) > 0;
  }

  async cancelEditDialog() {
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await this.wait(1000);
  }

  // Confirmed live: the Candidate Status popup always has exactly one
  // toggle ("Next Round Required"), one <select> with "Cleared"/"Rejected"/
  // "On Hold" options (Final Status - disabled while the toggle is ON,
  // since you don't pick a final status while another round is still
  // required), and one remarks <textarea> with maxlength="200".
  async getStatusPopupControls() {
    return {
      hasToggle: (await this.count("[role='dialog'] .mx-name-switch1 .widget-switch-btn-wrapper")) > 0,
      hasFinalStatusDropdown: (await this.count("[role='dialog'] .mx-name-dropDown1 select")) > 0,
      hasRemarksField: (await this.count("[role='dialog'] textarea")) > 0,
    };
  }

  async getRemarksMaxLength() {
    return this.getAttribute("[role='dialog'] textarea", 'maxlength');
  }

  async typeIntoRemarks(text) {
    // Real keystrokes rather than fill() - maxlength truncation is only
    // enforced by the browser on actual typed input, not a scripted value
    // assignment, and that's exactly the behavior INT-34 needs to observe.
    const field = this.page.locator("[role='dialog'] textarea").first();
    await field.click();
    await field.pressSequentially(text);
  }

  async getRemarksValue() {
    return this.page.locator("[role='dialog'] textarea").first().inputValue();
  }

  // ── Candidate Status popup - toggle / final status / save (mutating) ────

  async toggleNextRoundRequiredInPopup(enable) {
    // Confirmed live: a single click on this toggle occasionally doesn't
    // register (stays at its old aria-checked value) - retry rather than
    // silently proceeding with the wrong state.
    const toggle = this.page.locator("[role='dialog'] .mx-name-switch1 .widget-switch-btn-wrapper");
    await toggle.first().waitFor({ state: 'visible' });
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = (await toggle.first().getAttribute('aria-checked')) === 'true';
      if (current === enable) return;
      await toggle.first().click();
      // Confirmed live: the switch has a visible CSS transition - a
      // screenshot mid-animation shows a half-toggled purple state, and
      // aria-checked can lag slightly behind that. 1500ms clears it
      // reliably; the earlier 800ms didn't.
      await this.wait(1500);
    }
    throw new Error(`toggleNextRoundRequiredInPopup(${enable}): toggle did not reach the expected state after retries.`);
  }

  async isFinalStatusDropdownEnabled() {
    return this.page.locator("[role='dialog'] .mx-name-dropDown1 select").first().isEnabled();
  }

  async selectFinalStatusInPopup(label) {
    await this.page.locator("[role='dialog'] .mx-name-dropDown1 select").first().selectOption({ label });
  }

  async clickSaveChangesInPopup() {
    await this.click("[data-button-id*='CandidateInterview_newedit.actionButton1']:has-text('Save Changes')");
    await this.wait(1500);
  }

  // Text of the inline "Final Status is mandatory field" validation message
  // (confirmed live), or null if not shown.
  async getFinalStatusValidationError() {
    const el = this.page.locator("text=/Final Status is mandatory field/i");
    if (await el.count()) return (await el.first().textContent()).trim();
    return null;
  }

  // Cell texts for a specific Reg ID's row, filtering fresh each time so
  // callers always read the current, correct row rather than trusting
  // whatever was "first" before some other action changed the sort order.
  async getRowCellsByRegId(regId) {
    await this.filterByRegId(regId);
    await this.wait(1000);
    const texts = await this.page.locator(this.gridRows).first().locator('.td').allTextContents();
    await this.clearAllFilters();
    return texts.map((t) => t.trim());
  }

  // Confirmed live: this icon is NOT a passive "refresh" - it shows a real
  // confirmation ("You are incrementing current application count. Would
  // you like to proceed?") before mutating the candidate's Application
  // Count. Always cancels rather than proceeding, to avoid altering data.
  async clickFirstRowIncrementCountIconAndCancel() {
    await this.click(this.firstRowRefresh);
    await this.wait(500);
    const dialogText = await this.getText("[role='dialog'], .modal");
    await this.page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await this.wait(500);
    return dialogText;
  }

  async areFirstRowIconsVisible() {
    return {
      chevron: await this.isVisible(this.firstRowChevron),
      checkbox: await this.isVisible(this.firstRowCheckbox),
      edit: await this.isVisible(this.firstRowEdit),
      refresh: await this.isVisible(this.firstRowRefresh),
    };
  }

  // Confirmed live: no select-all checkbox exists in the column header row
  // for this grid (count is always 0) - not a missing-feature bug, just the
  // real, current design.
  async hasHeaderSelectAllCheckbox() {
    return (await this.count(`${this.activeTabPane} .th input[type="checkbox"]`)) > 0;
  }

  async clickExportToExcel() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 10000 }),
      this.click(this.exportToExcelBtn),
    ]);
    return download;
  }

  // Confirmed live: with a candidate that has no recorded feedback (our
  // "Test Can" dummies), this does not trigger a download event at all and
  // shows no error either - it simply has nothing to export. Only asserts
  // "no error dialog," not "a file downloaded."
  async clickFeedbacksExport() {
    await this.click(this.feedbacksExportBtn);
    await this.wait(2000);
  }

  async getPaginationRangeText() {
    try {
      return (await this.page.locator(this.paginationText).first().textContent()).trim();
    } catch (e) {
      return null;
    }
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  async filterByRegId(value) {
    await this.fill(this.regIdFilter, value);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    await this.wait(1500);
  }

  async filterByName(value) {
    await this.fill(this.nameFilter, value);
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    await this.wait(1500);
  }

  async filterByApplicationCount(value) {
    await this.fill(this.applicationCountFilter, value);
    await this.page.keyboard.press('Enter');
    await this.wait(1500);
  }

  async getApplicationCountFilterValue() {
    return this.page.locator(this.applicationCountFilter).inputValue();
  }

  async getDropdownFilterOptions(columnName) {
    const trigger = `${this.dropdownFilters[columnName]} input.dropdown-triggerer`;
    await this.click(trigger);
    await this.wait(500);
    const options = await this.getAllTexts("[role='listbox'] li, .dropdown-list li, ul[id*='dropdown-list'] li");
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    return options.map(o => o.trim()).filter(Boolean);
  }

  async filterByDropdown(columnName, optionText) {
    const trigger = `${this.dropdownFilters[columnName]} input.dropdown-triggerer`;
    await this.click(trigger);
    await this.wait(500);
    await this.page.locator("[role='listbox'] li, .dropdown-list li, ul[id*='dropdown-list'] li", { hasText: optionText }).first().click();
    await this.wait(1500);
  }

  // Dropdown filters hold their selected label as plain text in the
  // triggerer input - no "x"/clear affordance was found on it, so this
  // selects-all and deletes the text directly rather than assuming one
  // exists. Any test that applies a dropdown filter MUST call this
  // afterward: confirmed live that a leftover dropdown filter (e.g.
  // Current Round = 5) silently narrows every later test in the same run.
  async clearDropdownFilter(columnName) {
    const trigger = `${this.dropdownFilters[columnName]} input.dropdown-triggerer`;
    await this.click(trigger);
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.press('Enter');
    await this.waitForPageLoad();
    await this.wait(1000);
  }

  async clearAllFilters() {
    // Deliberately does NOT look for a generic "Clear" text/button anywhere
    // on the page - a prior version did, and it was too easy for that to
    // match something unrelated and click it instead of actually clearing
    // our filters (confirmed live: leftover filter text from one test then
    // silently broke the next test's search). Each known filter is cleared
    // and submitted individually instead.
    for (const sel of [this.regIdFilter, this.nameFilter, this.applicationCountFilter]) {
      const loc = this.page.locator(sel);
      if (await loc.count()) {
        await loc.fill('');
        await this.page.keyboard.press('Enter');
        await this.waitForPageLoad();
        await this.wait(1000);
      }
    }
    // Safety net: sweep every dropdown filter too, in case a test applied
    // one and didn't clean up after itself (see clearDropdownFilter above).
    for (const columnName of Object.keys(this.dropdownFilters)) {
      const trigger = this.page.locator(`${this.dropdownFilters[columnName]} input.dropdown-triggerer`);
      if (await trigger.count() && (await trigger.inputValue().catch(() => '')) !== '') {
        await this.clearDropdownFilter(columnName);
      }
    }
  }
}

/**
 * ITAP_ReScheduleInterview
 * Confirmed live: "Re-Schedule Interview" (reached via the grid's
 * Re-Schedule button after checking a row) is NOT a popup tied to that row -
 * it's a separate full page with its own independent search. It defaults to
 * "Search by Interviewer" mode (Interviewer + Date + Schedule Slot, all of
 * which must resolve to a real existing SCHEDULED round before "Apply"
 * reveals the actual edit panel). "Search by Candidate" mode shows a
 * read-only "Schedule Slot" preview text (not a real selector) and - even
 * with a candidate that has a real scheduled round - Apply always fails with
 * a mandatory-fields error through that mode. Confirmed real, not a
 * selector bug: tested with multiple candidates, both keyboard and mouse
 * selection.
 */
class ITAP_ReScheduleInterview extends BasePage {
  constructor(page) {
    super(page);

    // ── Search bar (top of page) ────────────────────────────────────────
    this.searchByInterviewerCheckbox = 'input[type="checkbox"]:visible >> nth=0';
    this.searchByCandidateCheckbox = 'input[type="checkbox"]:visible >> nth=1';
    this.searchComboInput = '.widget-combobox-input:visible >> nth=0';
    this.searchDateInput = 'input[placeholder="dd/mm/yyyy"]:visible >> nth=0';
    // Not suffixed with " >> nth=0" like the other locators here - this one
    // gets composed with a trailing " option" in getScheduleSlotOptions(),
    // and appending text after an "nth=" chain segment produces an invalid
    // selector that silently matches nothing (confirmed live: this exact
    // bug made Schedule Slot look permanently empty). .first() is applied
    // explicitly at each call site instead.
    this.scheduleSlotSelect = 'select:visible';
    this.candidateModeSlotPreview = 'input[id*="textBox6"]';
    this.applyBtn = "button:has-text('Apply')";
    this.clearFilterLink = "a:has-text('Clear Filter')";

    // ── Revealed edit panel (after a valid Apply) ───────────────────────
    this.allocateTimeSlotBtn = "button:has-text('Allocate Time Slot')";
    this.clearAllLink = "a:has-text('Clear All')";
    this.moveDownBtn = "button:has-text('Move Down')";
    this.moveUpBtn = "button:has-text('Move Up')";
    // Same Mendix div-based grid structure as the main Interview grid
    // (.tr[role="row"] rows, .td cells) - not a real <table> element.
    // Confirmed live: an unscoped ".widget-datagrid-grid-body .tr[role='row']"
    // also matches hidden grids in the "Preview Interviewer/Candidate Email"
    // tabs on this same page (6 total matches, only 1 real). This panel's
    // actual data row is the only one carrying a real "aria-selected"
    // value ("false") - the header row and the other tabs' rows all have
    // aria-selected=null - so filtering on the attribute's presence
    // reliably isolates just this grid's real row(s).
    this.candidateTableRows = ".widget-datagrid-grid-body .tr[role='row'][aria-selected]";
    this.cancelBtn = "button:has-text('Cancel')";
    this.updateAndPreviewBtn = "button:has-text('Update & Preview')";
    this.cancelConfirmYesBtn = "[role='dialog'] button:has-text('Yes')";
    this.cancelConfirmNoBtn = "[role='dialog'] button:has-text('No')";

    // Top-left "‹" icon - confirmed live as the same button[title="Back"]
    // pattern used elsewhere in this app (e.g. ITAP_InterviewSetup).
    this.backToGridBtn = "button[title='Back']";
  }

  async clickBackToGrid() {
    await this.click(this.backToGridBtn);
    await this.wait(1000);
  }

  // ── Search bar ─────────────────────────────────────────────────────────

  async isSearchByInterviewerChecked() {
    return this.page.locator(this.searchByInterviewerCheckbox).isChecked();
  }

  async isSearchByCandidateChecked() {
    return this.page.locator(this.searchByCandidateCheckbox).isChecked();
  }

  async checkSearchByCandidate() {
    // Same class of unreliable single-click-on-toggle issue documented
    // elsewhere in this app (e.g. ITAP_InterviewGrid's Next Round Required
    // toggle) - confirmed live 2026-08-26 that a single click here can
    // silently not register, leaving the page in Interviewer mode while the
    // rest of the flow blindly assumes Candidate mode. That previously
    // caused a hang: the code went on to search "Test Can" as an
    // *interviewer* name (no match) and then waited forever for the
    // candidate-mode-only Schedule Slot preview field, which never appears
    // in Interviewer mode. Verify-and-retry instead of a single click.
    const cb = this.page.locator(this.searchByCandidateCheckbox);
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await cb.isChecked()) return;
      await cb.click();
      await this.wait(500);
    }
    throw new Error('checkSearchByCandidate(): checkbox still not checked after 4 attempts.');
  }

  // The two checkboxes are mutually exclusive (checking one unchecks the
  // other) but this page's state persists across grid<->page navigations
  // within the same browser session - confirmed live that a prior test
  // leaving "Search by Candidate" checked breaks a later test's Interviewer-
  // mode flow (Schedule Slot never populates). Call this before any
  // Interviewer-mode interaction to guarantee a clean starting state.
  async ensureSearchByInterviewerMode() {
    const cb = this.page.locator(this.searchByInterviewerCheckbox);
    if (!(await cb.isChecked())) await cb.click();
    await this.wait(500);
  }

  /**
   * Types into the top search combobox (Interviewer, in default mode, or
   * Candidate Name once "Search by Candidate" is checked) and clicks the
   * nth suggestion (0-based) via mouse - confirmed live that keyboard
   * ArrowDown+Enter does NOT always commit the underlying reference value
   * for this widget, while a direct mouse click on the suggestion does.
   */
  async selectSearchSuggestion(text, optionIndex = 0) {
    const combo = this.page.locator(this.searchComboInput);
    await combo.click();
    await combo.fill(text);
    await this.wait(800);
    await this.page.locator('.widget-combobox-menu li, [role="option"]').nth(optionIndex).click();
    await this.wait(800);
    // Unlike ITAP_InterviewSetup's selectInterviewer(), do NOT press
    // Escape here - confirmed live it silently breaks this page's
    // dependent Schedule Slot lookup (the <select> comes back with no real
    // options), even though the combobox's own value is still set
    // correctly. Root cause not fully understood; documented as a real,
    // reproducible quirk of this specific widget instance.
  }

  async fillSearchDate(dateDDMMYYYY) {
    const input = this.page.locator(this.searchDateInput);
    await input.click();
    await input.fill(dateDDMMYYYY);
    await this.page.keyboard.press('Tab');
    await this.wait(1000);
  }

  async getScheduleSlotOptions() {
    return this.page.locator(this.scheduleSlotSelect).first().locator('option').allTextContents();
  }

  async selectScheduleSlotByIndex(index) {
    await this.page.locator(this.scheduleSlotSelect).first().selectOption({ index });
    await this.wait(500);
  }

  /**
   * Read-only preview text shown in "Search by Candidate" mode ("No
   * Interview Scheduled" or an actual "dd/mm/yyyy hh:mm AM - hh:mm" slot).
   * Confirmed live: this is a disabled display field, not a real selector -
   * Apply cannot succeed through candidate mode regardless of its value.
   */
  async getCandidateModeSlotPreviewText() {
    return (await this.page.locator(this.candidateModeSlotPreview).first().inputValue()).trim();
  }

  async clickApply() {
    // .first() rather than this.click() (strict mode) - confirmed live that
    // button text locators on this page also match hidden duplicates in the
    // "Preview Interviewer/Candidate Email" tabs.
    await this.page.locator(this.applyBtn).first().click();
    await this.wait(1500);
  }

  async clickClearFilter() {
    await this.page.locator(this.clearFilterLink).first().click();
    await this.wait(500);
  }

  /**
   * The "please fill in required fields" error banner. Confirmed live: the
   * exact wording is inconsistent between modes - "Please fill all
   * mandatory fields to proceed." in candidate mode vs "Please fill all the
   * mandotary fileds to proceed." (sic) in interviewer mode - so this
   * matches loosely rather than asserting one exact string.
   */
  async getMandatoryFieldsErrorText() {
    const banner = this.page.locator("text=/please fill all( the)?.*(mandatory fields|mandotary fileds)/i");
    if (await banner.count()) {
      return (await banner.first().textContent()).trim();
    }
    return null;
  }

  async dismissErrorBanner() {
    const closeBtn = this.page.locator(".close:visible").first();
    if (await closeBtn.count()) {
      await closeBtn.click();
      await this.wait(300);
    }
  }

  // ── Revealed edit panel ──────────────────────────────────────────────────

  /**
   * The Start Date field inside the revealed edit panel (the second
   * dd/mm/yyyy-placeholder input on the page - the first is the search
   * bar's Date field).
   */
  async fillPanelStartDate(dateDDMMYYYY) {
    const dateInputs = this.page.locator('input[placeholder="dd/mm/yyyy"]:visible');
    await dateInputs.nth(1).click();
    await dateInputs.nth(1).fill(dateDDMMYYYY);
    await this.page.keyboard.press('Tab');
    await this.wait(800);
  }

  /**
   * Inline "Please Select Future Date" validation under Start Date -
   * confirmed live to be the exact same message/behavior as the Schedule
   * Interview form's TC-037 check, reused here.
   */
  async getDateValidationInlineText() {
    const inline = this.page.locator("text=/Please Select Future Date/i");
    if (await inline.count()) {
      return (await inline.first().textContent()).trim();
    }
    return null;
  }

  async isMoveDownVisible() {
    return this.isVisible(this.moveDownBtn);
  }

  async isMoveUpVisible() {
    return this.isVisible(this.moveUpBtn);
  }

  /**
   * Reg IDs currently listed in the revealed panel's candidate table.
   */
  async getPanelCandidateRegIds() {
    // Reg ID is the second cell (the first is the delete/trash icon) - scan
    // all cells rather than hardcoding an index, since that icon-only first
    // cell has no real text to false-positive against.
    const rows = this.page.locator(this.candidateTableRows);
    const count = await rows.count();
    const ids = [];
    for (let i = 0; i < count; i++) {
      const cellTexts = await rows.nth(i).locator('.td').allInnerTexts();
      const regId = cellTexts.map(t => t.trim()).find(t => /^\d+$/.test(t));
      if (regId) ids.push(regId);
    }
    return ids;
  }

  /**
   * Clicks Cancel and confirms the "Are you sure you would like to cancel?"
   * dialog - confirmed live this is always a two-step confirm, never an
   * immediate discard. Also confirmed live: this only discards the revealed
   * edit panel and returns to the search bar view (with the search fields
   * still populated) - it does NOT navigate away from the Re-Schedule
   * Interview page. Call clickBackToGrid() afterwards to actually return to
   * the Interview grid.
   */
  async cancelAndConfirm() {
    // .first() rather than this.click() (strict mode) - confirmed live 3
    // "Cancel" buttons exist on this page (one per tab: Interview Setup,
    // Preview Interviewer Email, Preview Candidate Email), only the first
    // is the visible/active one.
    await this.page.locator(this.cancelBtn).first().click();
    await this.wait(500);
    await this.page.locator(this.cancelConfirmYesBtn).first().click();
    await this.wait(1000);
  }
}

module.exports = { ITAP_InterviewGrid, ITAP_ReScheduleInterview };