const BasePage = require('../BasePage');

/**
 * ITAP_DocumentVerification
 * The HR-role (nimisha) "Document Verification" portal - a separate page
 * from the FC Admin (akshay.gupta) Onboarding grid, reached via its own
 * sidebar item. Two tab-panes share DOM structure (Verification Pending /
 * Verification Completed), same pattern as every other tab pair in this
 * app - every locator here scopes to ".tab-pane.active".
 *
 * The verification mechanism (live-verified 2026-08-31): check every
 * per-document "Verify" checkbox, select a Field Coordinator (a custom
 * Mendix combobox, not a native <select>), optionally fill Comments, click
 * the page-level Verify button, then confirm the "Are you sure you want to
 * proceed?" dialog via its "Proceed" button.
 */
class ITAP_DocumentVerification extends BasePage {
  constructor(page) {
    super(page);

    this.activePane = '.tab-pane.active';
    this.sidebarDocVerifLink = "ul.mx-navigationlist li.mx-navigationlist-item span.mx-text:text-is('Document Verification')";
    this.tabLink = (label) => this.page.locator('a', { hasText: label }).first();
    this.gridRows = this.page.locator(`${this.activePane} .widget-datagrid-grid-body .tr[role='row']`);
    this.rowCheckbox = (row) => row.locator("input[type='checkbox']");
    this.viewDocsBtn = this.page.locator(`${this.activePane} button:has-text('View Docs')`);
    this.backBtn = this.page.locator("button:has-text('Back')");
    this.downloadAllDocsBtn = this.page.locator(`${this.activePane} button:has-text('Download All Docs')`);

    // View Docs detail page. A "label:has-text('Verify')" scoped attempt
    // (trying to avoid a suspected stray-checkbox match elsewhere in this
    // SPA's shared DOM) returned ZERO matches live - the checkbox and
    // "Verify" text here are NOT wrapped in a real <label> element, so that
    // assumption was wrong. Back to the bare selector, which DID reliably
    // match exactly 12 real document checkboxes in earlier live exploration
    // (hr-verify-fresher-250349-action.js) - the earlier miscount is now
    // diagnosed via getDocumentCheckboxDebugInfo() instead of blind re-guessing.
    this.docCheckboxes = this.page.locator("input[type='checkbox']:visible");
    // One "Add Remarks" text input sits alongside each document's Verify
    // checkbox (confirmed live 1:1, same indexing as docCheckboxes) -
    // required for Send Back To Candidate specifically (confirmed live via
    // network inspection: omitting it fails server-side validation with
    // "Remarks is mandatory" per document, silently, with a 200 HTTP status
    // but empty commits - Verify itself does not require this).
    this.docRemarksInputs = this.page.locator("input[placeholder='Add Remarks']:visible");
    this.fieldCoordinatorLabel = this.page.getByText('Field Coordinator', { exact: false }).first();
    this.fieldCoordinatorCombo = this.page.locator(
      "xpath=//*[contains(text(),'Field Coordinator')]/following::*[contains(@class,'dropdown') or @role='combobox' or @role='listbox'][1]"
    );
    this.comboOptionItems = this.page.locator(
      "ul[role='listbox'] li, div[role='listbox'] div, .dropdown-menu li, .mx-listbox-item, li[role='option'], div[role='option']"
    );
    this.commentsBox = this.page.locator('textarea:visible').last();
    this.verifyBtn = this.page.getByRole('button', { name: 'Verify', exact: true });
    this.sendBackBtn = this.page.getByRole('button', { name: 'Send Back To Candidate', exact: true });
    this.saveAsDraftBtn = this.page.getByRole('button', { name: 'Save As Draft', exact: true });
    this.cancelBtn = this.page.getByRole('button', { name: 'Cancel', exact: true });
    this.confirmDialog = this.page.locator("[role='dialog']");
    this.confirmProceedBtn = this.page.locator("[role='dialog'] button:has-text('Proceed')");
    this.confirmCancelBtn = this.page.locator("[role='dialog'] button:has-text('Cancel')");
  }

  async navigateToDocumentVerification() {
    await this.page.locator(this.sidebarDocVerifLink).click();
    await this.waitForPageLoad();
    await this.wait(1000);
  }

  /** Switches to 'Verification Pending' or 'Verification Completed'. */
  async switchToTab(label) {
    await this.tabLink(label).click({ timeout: 8000 }).catch(() => {});
    await this.wait(1200);
  }

  /** Returns the active tab's real column header labels, in order (excludes the leading checkbox column). */
  async getColumnHeaders() {
    const headers = await this.page.locator(`${this.activePane} .th .column-header span`).allTextContents();
    return headers.map((h) => h.trim()).filter(Boolean);
  }

  /**
   * Locator for a grid column's header+filter cell (".th"), matched by its
   * exact header text - same "locate by header text, not auto-generated
   * widget class" convention already used for the FC Admin Onboarding grid's
   * own filters (ITAP_OnboardingGrid.js).
   */
  columnCell(label) {
    return this.page.locator(`${this.activePane} .th`).filter({
      has: this.page.locator('.column-header span', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }

  /**
   * Fills a text-type column filter (Division/ITAP Number/Candidate Name -
   * confirmed live as plain "filter-container" text inputs, NOT dropdowns
   * despite the FC Admin Onboarding grid's own Division filter being a
   * dropdown there - this is a different grid) and presses Enter.
   */
  async filterColumnText(label, value) {
    const input = this.columnCell(label).locator("input[type='text']").first();
    await input.fill(value, { timeout: 8000 }).catch(() => {});
    await this.page.keyboard.press('Enter');
    await this.wait(1000);
  }

  /** Clears a text-type column filter and presses Enter. */
  async clearColumnTextFilter(label) {
    await this.filterColumnText(label, '');
  }

  /**
   * Opens a dropdown-type column filter (e.g. Candidate Status - confirmed
   * live as a "dropdown-container" widget with an
   * `input.dropdown-triggerer`, not a native <select>) and returns its
   * option texts, then closes it via Escape.
   */
  async getDropdownFilterOptions(label) {
    const trigger = this.columnCell(label).locator('input.dropdown-triggerer').first();
    await trigger.click({ timeout: 5000 }).catch(() => {});
    await this.wait(700);
    const listboxId = await trigger.getAttribute('aria-controls').catch(() => null);
    const options = listboxId
      ? await this.page.locator(`#${listboxId} li, #${listboxId} div[role='option']`).allTextContents()
      : [];
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    return options.map((o) => o.trim()).filter(Boolean);
  }

  /** True if a column's filter is a real date-picker widget (react-datepicker), confirmed live for Training Date/Document Verification Date. */
  async isDateFilter(label) {
    return (await this.columnCell(label).locator('.react-datepicker-wrapper').count()) > 0;
  }

  /** Parses the "Currently showing X to Y of Z" pagination text into the total row count Z (null if not found). */
  async getGridTotalCount() {
    const text = await this.page
      .locator(this.activePane)
      .locator('text=/\\d+ (to|-) \\d+ of \\d+/i')
      .first()
      .innerText({ timeout: 5000 })
      .catch(() => '');
    const match = text.match(/of\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  nextPageBtn() { return this.page.locator(`${this.activePane} button[aria-label='Go to next page']`).first(); }
  prevPageBtn() { return this.page.locator(`${this.activePane} button[aria-label='Go to previous page']`).first(); }
  firstPageBtn() { return this.page.locator(`${this.activePane} button[aria-label='Go to first page']`).first(); }
  lastPageBtn() { return this.page.locator(`${this.activePane} button[aria-label='Go to last page']`).first(); }

  /**
   * Returns real data-row texts for the active tab, excluding the
   * header-echoing phantom row confirmed live (2026-09-07): dv.gridRows can
   * include a row whose innerText is literally the concatenated column
   * labels (e.g. right after a filter or a page-navigation click) - neither
   * a stable index nor .first() is safe against it, so every row is read
   * and the header-shaped one is filtered out here, once, for every caller.
   */
  async getRealRowTexts() {
    const texts = await this.gridRows.allInnerTexts();
    const headerLike = /^\s*Division\s+ITAP Number/i;
    return texts.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => t && !headerLike.test(t));
  }

  /**
   * Scans the active tab's grid (paging forward if needed) for a row
   * containing itapNumber. Returns { index, text } or { index: -1 }.
   */
  async findRowByItapNumber(itapNumber, maxPages = 20) {
    // Confirmed live: this hung for the full test timeout with no explicit
    // per-call timeouts (the same recurring class of bug fixed repeatedly
    // elsewhere in this session) - a single stale/lagging row or pagination
    // button reference would otherwise inherit a huge default wait instead
    // of failing fast and letting the loop move on.
    for (let page = 0; page <= maxPages; page++) {
      const count = await this.gridRows.count();
      for (let i = 0; i < count; i++) {
        const text = await this.gridRows.nth(i).innerText({ timeout: 5000 }).catch(() => '');
        if (text.includes(itapNumber)) {
          return { index: i, text: text.replace(/\s+/g, ' ').trim() };
        }
      }
      const nextBtn = this.page.locator(`${this.activePane} button[aria-label='Go to next page']`).first();
      const enabled = await nextBtn.isEnabled({ timeout: 5000 }).catch(() => false);
      if (!enabled) break;
      await nextBtn.click({ timeout: 5000 }).catch(() => {});
      await this.wait(1200);
    }
    return { index: -1, text: null };
  }

  /**
   * Filters the active tab's grid to a specific ITAP Number via the grid's
   * own "ITAP Number" column filter, then returns { index, text } for the
   * (now sole) matching row, or { index: -1 } if none.
   *
   * Confirmed live (2026-09-04): findRowByItapNumber()'s brute-force page
   * scan stopped being reliable once Verification Completed grew past ~85
   * rows from this project's own accumulated test runs (verification is a
   * ONE-WAY transition, so this list only ever grows) - it's sorted by
   * Document Verification Date, which is empty for every row observed live,
   * so ties sort in some unstable order NOT correlated with insertion time.
   * A just-verified candidate can land anywhere in that tie-order, not
   * reliably on the last page - confirmed live as 4 consecutive failures
   * where the scan reached the true last page without ever finding a
   * candidate that (per the grid's own growing total count) really was
   * there. Filtering directly sidesteps needing to know where it landed,
   * and stays fast regardless of how large this list grows over time.
   */
  async findRowByItapNumberFiltered(itapNumber) {
    const th = this.page.locator(`${this.activePane} .th`).filter({
      has: this.page.locator('.column-header span', { hasText: /^\s*ITAP Number\s*$/ }),
    });
    const input = th.locator("input[type='text']").first();
    await input.fill(itapNumber, { timeout: 8000 }).catch(() => {});
    await this.page.keyboard.press('Enter');
    await this.wait(1200);

    const count = await this.gridRows.count();
    for (let i = 0; i < count; i++) {
      const text = await this.gridRows.nth(i).innerText({ timeout: 5000 }).catch(() => '');
      if (text.includes(itapNumber)) {
        await input.fill('', { timeout: 8000 }).catch(() => {});
        await this.page.keyboard.press('Enter');
        await this.wait(800);
        return { index: 0, text: text.replace(/\s+/g, ' ').trim() };
      }
    }
    await input.fill('', { timeout: 8000 }).catch(() => {});
    await this.page.keyboard.press('Enter');
    await this.wait(800);
    return { index: -1, text: null };
  }

  async selectRow(index) {
    // Confirmed live: an out-of-range/negative index (e.g. from a caller
    // that forgot to confirm findRowByItapNumber actually found something)
    // resolves to zero elements, and .check() on that retries for the
    // FULL test timeout rather than failing fast - fail fast instead.
    if (index < 0) {
      throw new Error(`selectRow(): invalid index ${index} - caller must confirm a row was actually found first.`);
    }
    await this.rowCheckbox(this.gridRows.nth(index)).check({ force: true, timeout: 8000 });
    await this.wait(500);
  }

  async isViewDocsEnabled() {
    return this.viewDocsBtn.isEnabled({ timeout: 5000 }).catch(() => false);
  }

  async clickViewDocs() {
    await this.viewDocsBtn.click();
    await this.wait(2500);

    // Confirmed live (2026-09-04): re-opening View Docs for a candidate
    // already in "Sent Back" status re-shows the same "Information: Sent
    // to candidate to reupload unverified documents" dialog from that
    // action, even though nothing was clicked to trigger it this time -
    // it blocks every later interaction on this page (Field Coordinator,
    // Verify, etc.) behind its modal overlay if left undismissed.
    const staleInfoDialog = this.confirmDialog.filter({ hasText: /sent to candidate/i });
    const staleInfoVisible = await staleInfoDialog.first().isVisible({ timeout: 2000 }).catch(() => false);
    if (staleInfoVisible) {
      const okBtn = staleInfoDialog.first().locator("button:has-text('OK'), button:has-text('Ok')");
      await okBtn.first().click({ timeout: 5000 }).catch(() => {});
      await this.wait(800);
    }
  }

  /** Returns the "(X/Y) Verified" counters currently shown, e.g. ["(5/5) Verified", ...]. */
  async getVerifiedCounts() {
    const bodyText = await this.page.locator('body').innerText().catch(() => '');
    return bodyText.match(/\(\d+\/\d+\) Verified/g) || [];
  }

  async getDocumentCheckboxCount() {
    return this.docCheckboxes.count();
  }

  /**
   * Debug helper: dumps each matched checkbox's nearest surrounding text, so
   * a miscount (e.g. a stray checkbox from elsewhere in this SPA's shared
   * DOM winning a positional "first()") is immediately diagnosable instead
   * of requiring another blind live re-run to investigate.
   */
  async getDocumentCheckboxDebugInfo() {
    const count = await this.docCheckboxes.count();
    const info = [];
    for (let i = 0; i < count; i++) {
      const cb = this.docCheckboxes.nth(i);
      const context = await cb.evaluate(el => {
        const container = el.closest('div');
        return container ? container.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '(no container)';
      }).catch(() => '(evaluate failed)');
      info.push({ index: i, nearbyText: context });
    }
    return info;
  }

  /** Checks every visible per-document "Verify" checkbox. Returns how many were checked. */
  async checkAllDocumentCheckboxes() {
    const count = await this.docCheckboxes.count();
    for (let i = 0; i < count; i++) {
      const cb = this.docCheckboxes.nth(i);
      if (!(await cb.isChecked().catch(() => false))) {
        await cb.check({ force: true });
        await this.wait(200);
      }
    }
    return count;
  }

  /** Fills every visible per-document "Add Remarks" input with the same text. Returns how many were filled. */
  async fillAllDocumentRemarks(text) {
    const count = await this.docRemarksInputs.count();
    for (let i = 0; i < count; i++) {
      await this.docRemarksInputs.nth(i).fill(text);
      await this.wait(150);
    }
    return count;
  }

  /** Opens the Field Coordinator combobox and selects the option matching name (exact). */
  async selectFieldCoordinator(name) {
    await this.fieldCoordinatorCombo.first().click();
    await this.wait(700);
    const option = this.comboOptionItems.filter({ hasText: name });
    const found = await option.count();
    if (!found) {
      await this.page.keyboard.press('Escape');
      return false;
    }
    await option.first().click();
    await this.wait(700);
    return true;
  }

  /**
   * Ground truth confirmed live via raw DOM dump: fieldCoordinatorCombo
   * IS the real <input class="widget-combobox-input" ... value="Akshay
   * Gupta"> itself - not a wrapping container with a nested input, which
   * is what every earlier attempt here wrongly assumed (hence innerText
   * always "", a child "input" search always finding zero elements, and
   * getByText never matching since input values aren't text content).
   * .inputValue() directly on the locator is the correct, simple read.
   */
  async getFieldCoordinatorValue() {
    return this.fieldCoordinatorCombo.first().inputValue().catch(() => '');
  }

  async isFieldCoordinatorShowing(name) {
    return (await this.getFieldCoordinatorValue()) === name;
  }

  async fillComments(text) {
    await this.commentsBox.fill(text);
    await this.wait(300);
  }

  async isVerifyEnabled() {
    const count = await this.verifyBtn.count();
    if (!count) return false;
    return this.verifyBtn.first().isEnabled().catch(() => false);
  }

  /** Clicks Verify, then confirms the "Are you sure...Proceed" dialog if it appears. */
  async clickVerifyAndConfirm() {
    await this.verifyBtn.first().click();
    await this.wait(2000);
    const dialogVisible = await this.confirmDialog.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!dialogVisible) return null;

    const dialogText = await this.confirmDialog.first().innerText().catch(() => '');
    await this.confirmProceedBtn.click();
    await this.wait(2000);

    // Confirmed live: Proceed leads to a SECOND, separate "Information -
    // Candidate Documents verified successfully" dialog - left undismissed,
    // it blocks every subsequent click (e.g. clickBack()) behind its modal
    // overlay, hanging for the full test timeout rather than failing fast.
    const successDialog = this.page.locator("[role='dialog']").filter({ hasText: /verified successfully/i });
    const successVisible = await successDialog.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (successVisible) {
      const okBtn = successDialog.locator("button:has-text('OK'), button:has-text('Ok')");
      await okBtn.first().click({ timeout: 5000 }).catch(() => {});
      await this.wait(1000);
    }

    return dialogText.replace(/\s+/g, ' ').trim();
  }

  /**
   * Clicks Verify (confirming the "Are you sure...Proceed" dialog, which
   * appears UNCONDITIONALLY regardless of whether every document is checked
   * or Field Coordinator is set - it is not itself a validation gate) and
   * inspects the actual backend response body for a real commit, same
   * "don't trust HTTP status alone" discipline as clickSendBackAndGetResult()
   * below. Confirmed live (2026-09-07) via two separate throwaway
   * candidates: a blank Field Coordinator is genuinely rejected server-side
   * ("Field Coordinator is manadatory" [sic], same typo as Send Back's own
   * message) with an empty commits array; submitting with only SOME
   * documents checked (Field Coordinator properly set) returns 200 with
   * NEITHER a validation message NOR a commit - a silent no-op with zero
   * visible dialog/toast, the same undetectable-without-network-inspection
   * trap Send Back's original investigation found (see
   * feedback_dont_trust_http_status_alone). Dismisses any dialog left open
   * afterward (a real success shows a second "verified successfully"
   * dialog; a blocked/no-op attempt showed none in live testing, but this
   * defensively covers either case rather than assuming).
   */
  async clickVerifyAndGetResult(timeoutMs = 10000) {
    const responsePromise = this.page.waitForResponse((res) => res.url().includes('/xas/'), { timeout: timeoutMs }).catch(() => null);
    await this.verifyBtn.first().click();
    await this.wait(1500);
    const dialogVisible = await this.confirmDialog.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (dialogVisible) {
      await this.confirmProceedBtn.click({ timeout: 5000 }).catch(() => {});
    }
    const response = await responsePromise;
    if (!response) return { status: null, hasValidationErrors: false, validationMessages: [], committedAnything: false };

    const status = response.status();
    let body = {};
    try { body = await response.json(); } catch (e) { /* non-JSON response */ }
    const datavalidation = Array.isArray(body.datavalidation) ? body.datavalidation : [];
    const validationMessages = datavalidation.flatMap((d) => (d.errorFields || []).map((f) => f.message));
    const committedAnything = Array.isArray(body.commits) && body.commits.length > 0;

    await this.wait(1500);
    const anyDialog = this.confirmDialog.first();
    const stillVisible = await anyDialog.isVisible({ timeout: 3000 }).catch(() => false);
    if (stillVisible) {
      const okBtn = anyDialog.locator("button:has-text('OK'), button:has-text('Ok')");
      await okBtn.first().click({ timeout: 5000 }).catch(() => {});
      await this.wait(1000);
    }

    return { status, hasValidationErrors: validationMessages.length > 0, validationMessages, committedAnything };
  }

  /**
   * Clicks Cancel on the View Docs page and confirms the "Are you sure you
   * want to cancel?" dialog (Yes/No - a different, distinct dialog from
   * Verify/Save As Draft's own "Information" dialogs). Confirmed live
   * (2026-09-07): confirming this discards ALL unsaved per-document
   * checkbox progress and returns to the grid - contrasts directly with
   * Save As Draft, which persists the exact same kind of partial progress.
   */
  async clickCancelAndConfirm() {
    await this.cancelBtn.click({ timeout: 8000 });
    await this.wait(1200);
    const confirmCancelDialog = this.confirmDialog.filter({ hasText: /sure you want to cancel/i });
    const visible = await confirmCancelDialog.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await confirmCancelDialog.first().locator("button:has-text('Yes')").first().click({ timeout: 5000 }).catch(() => {});
      await this.wait(1200);
    }
    return visible;
  }

  /**
   * Clicks "Send Back To Candidate" and returns { status, hasValidationErrors,
   * validationMessages, committedAnything } describing what the backend call
   * actually did - NOT just its HTTP status, which is misleading here. Also
   * dismisses the success dialog if one appears.
   *
   * Confirmed live (2026-09-04): a 200 HTTP response is NOT proof of
   * success on its own - a first attempt without per-document Remarks
   * filled in returned 200 with an EMPTY commits array and a datavalidation
   * array full of "Remarks is mandatory" errors (then, once Remarks were
   * filled, "Field Coordinator is manadatory" [sic, real app typo]) -
   * meaning nothing was actually saved. That silently-failing case shows
   * NO dialog/toast/status change at all, which is what made this action
   * look unobservable at first. Once both real preconditions (per-document
   * Remarks AND Field Coordinator) are met, it genuinely succeeds - and
   * DOES show an "Information: Sent to candidate to reupload unverified
   * documents" dialog after all, confirming the user-described real-world
   * behavior (this is what emails the selected documents back to the
   * candidate for resubmission) - it just never appeared in earlier
   * attempts because those never reached a real success.
   */
  async clickSendBackAndGetResult(timeoutMs = 8000) {
    const responsePromise = this.page.waitForResponse(
      (res) => res.url().includes('/xas/') && res.request().postData()?.includes('CandidateDocumentsVerificationListUnverified'),
      { timeout: timeoutMs }
    ).catch(() => null);
    await this.sendBackBtn.click();
    const response = await responsePromise;
    if (!response) return { status: null, hasValidationErrors: false, validationMessages: [], committedAnything: false };

    const status = response.status();
    let body = {};
    try { body = await response.json(); } catch (e) { /* non-JSON response */ }
    const datavalidation = Array.isArray(body.datavalidation) ? body.datavalidation : [];
    const validationMessages = datavalidation.flatMap((d) => (d.errorFields || []).map((f) => f.message));
    // "changes" alone isn't proof of a real commit - confirmed live the
    // FAILED attempt still returned non-empty "changes" (changedDate/
    // System.changedBy bookkeeping fields) even though nothing was actually
    // saved. "commits" is what's empty specifically when validation blocks
    // the save - that's the real signal.
    const committedAnything = Array.isArray(body.commits) && body.commits.length > 0;

    // On a genuine success, an "Information: Sent to candidate to reupload
    // unverified documents" dialog appears - left undismissed, it blocks
    // clickBack() and everything after it behind its modal overlay, same
    // class of issue as clickVerifyAndConfirm()'s own success dialog.
    const successDialog = this.confirmDialog.filter({ hasText: /sent to candidate/i });
    const successVisible = await successDialog.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (successVisible) {
      const okBtn = successDialog.first().locator("button:has-text('OK'), button:has-text('Ok')");
      await okBtn.first().click({ timeout: 5000 }).catch(() => {});
      await this.wait(1000);
    }

    return { status, hasValidationErrors: validationMessages.length > 0, validationMessages, committedAnything };
  }

  async clickBack() {
    // Confirmed live: an unbounded click() here can hang for this
    // environment's full test timeout rather than Playwright's normal 30s
    // default when the button is momentarily absent/covered (e.g. right
    // after a dialog dismiss) - a caller-side .catch() alone doesn't help,
    // since .catch() only handles rejection, it doesn't impose a timeout.
    await this.backBtn.first().click({ timeout: 8000 }).catch(() => {});
    await this.wait(1500);
  }
}

module.exports = { ITAP_DocumentVerification };
