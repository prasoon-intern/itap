/**
 * BasePage
 * Base class for all Page Object Model classes.
 * Provides common helper methods for page interactions.
 */
class BasePage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Fill a field with text.
   * @param {string} locator - Locator string (supports xpath=, css=, or direct selector)
   * @param {string} value - Text to fill
   */
  async fill(locator, value) {
    const selector = this.normalizeLocator(locator);
    await this.page.fill(selector, value);
  }

  /**
   * Click an element.
   * @param {string} locator - Locator string
   */
  async click(locator) {
    const selector = this.normalizeLocator(locator);
    await this.page.click(selector);
  }

  /**
   * Wait for element to be visible.
   * @param {string} locator - Locator string
   * @param {number} timeout - Optional timeout in ms
   */
  async waitForVisible(locator, timeout = 30000) {
    const selector = this.normalizeLocator(locator);
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Wait for page to load (network idle).
   */
  async waitForPageLoad() {
    // 'networkidle' can hang indefinitely on Mendix pages - they keep a
    // persistent long-polling connection open for live updates, so "zero
    // in-flight requests for 500ms" isn't guaranteed to ever occur. Bounded
    // with a timeout and swallowed: by the time this fires, the grid/filter
    // has already re-rendered in practice (confirmed live via a hang that
    // consumed a whole test's timeout budget with this exact call pending).
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  /**
   * Normalize locator string to Playwright format.
   * Converts "xpath=//" to just the xpath.
   * @param {string} locator
   * @returns {string}
   */
  normalizeLocator(locator) {
    if (locator.startsWith('xpath=')) {
      return locator.substring(6);
    }
    if (locator.startsWith('css=')) {
      return locator.substring(4);
    }
    return locator;
  }

  /**
   * Get page title.
   * @returns {Promise<string>}
   */
  async getTitle() {
    return await this.page.title();
  }

  /**
   * Navigate to URL.
   * @param {string} url
   */
  async goto(url) {
    await this.page.goto(url);
  }

  /**
   * Wait for specified time.
   * @param {number} ms - Milliseconds to wait
   */
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Check if element is visible.
   * @param {string} locator
   * @returns {Promise<boolean>}
   */
  async isVisible(locator) {
    const selector = this.normalizeLocator(locator);
    try {
      return await this.page.isVisible(selector);
    } catch (e) {
      return false;
    }
  }

  /**
   * Get element text.
   * @param {string} locator
   * @returns {Promise<string>}
   */
  async getText(locator) {
    const selector = this.normalizeLocator(locator);
    return await this.page.textContent(selector);
  }

  /**
   * Type text into an element (slower than fill, simulates real typing).
   * @param {string} locator - Locator string
   * @param {string} text - Text to type
   * @param {number} delay - Optional delay between keystrokes in ms
   */
  async type(locator, text, delay = 100) {
    const selector = this.normalizeLocator(locator);
    await this.page.type(selector, text, { delay });
  }

  /**
   * Scroll element into view.
   * @param {string} locator - Locator string
   */
  async scrollIntoView(locator) {
    const selector = this.normalizeLocator(locator);
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Click element using JavaScript (for elements that are hard to click normally).
   * @param {string} locator - Locator string
   */
  async clickJS(locator) {
    const selector = this.normalizeLocator(locator);
    await this.page.locator(selector).evaluate(el => el.click());
  }

  /**
   * Check if element is visible (alias used by some FC Admin page objects).
   * @param {string} locator
   * @returns {Promise<boolean>}
   */
  async isElementVisible(locator) {
    return this.isVisible(locator);
  }

  /**
   * Select an option from a native <select> element.
   * @param {string} locator
   * @param {string} value - option value or label
   */
  async selectOption(locator, value) {
    const selector = this.normalizeLocator(locator);
    await this.page.selectOption(selector, value);
  }

  /**
   * Count elements matching a locator.
   * @param {string} locator
   * @returns {Promise<number>}
   */
  async count(locator) {
    const selector = this.normalizeLocator(locator);
    return this.page.locator(selector).count();
  }

  /**
   * Get text content of every element matching a locator.
   * @param {string} locator
   * @returns {Promise<string[]>}
   */
  async getAllTexts(locator) {
    const selector = this.normalizeLocator(locator);
    return this.page.locator(selector).allTextContents();
  }

  /**
   * Get an attribute value from an element.
   * @param {string} locator
   * @param {string} name
   * @returns {Promise<string|null>}
   */
  async getAttribute(locator, name) {
    const selector = this.normalizeLocator(locator);
    return this.page.locator(selector).first().getAttribute(name);
  }

  /**
   * Wait for an overlay to disappear.
   * @param {string} overlaySelector - CSS selector for the overlay
   * @param {number} timeout - Optional timeout in ms
   */
  async waitForOverlayToDisappear(overlaySelector, timeout = 30000) {
    try {
      await this.page.waitForSelector(overlaySelector, { state: 'hidden', timeout });
    } catch (e) {
      // Overlay might not exist or already hidden
      console.log('Overlay not found or already hidden');
    }
  }
}

module.exports = BasePage;
