const BasePage = require('./BasePage');
const config = require('../config');

/**
 * ITAP_Login (LoginPage)
 * Handles login and navigation to the Appointment tab.
 * Shared across the Interview and Onboarding modules (both live behind the
 * same FC Admin login + "Appointment" tab).
 * Replaces: ITAP_LoginPage.java
 */
class ITAP_Login extends BasePage {
  constructor(page) {
    super(page);

    // Locators
    this.usernameField   = "xpath=//*[@placeholder='User name']";
    this.passwordField   = "xpath=//*[@placeholder='Password']";
    this.loginButton     = "xpath=//*[@class='btn btn-success btn-lg']";
    this.appointmentTab  = "xpath=//*[text()='Appointment']/parent::li";
  }

  /**
   * Enter username.
   * @param {string} username
   */
  async enterUsername(username) {
    console.log(`Entering username: ${username}`);
    await this.fill(this.usernameField, username);
    return this;
  }

  /**
   * Enter password.
   * @param {string} password
   */
  async enterPassword(password) {
    console.log('Entering password');
    await this.fill(this.passwordField, password);
    return this;
  }

  /**
   * Click the login button.
   */
  async clickLogin() {
    console.log('Clicking login button');
    await this.click(this.loginButton);
    // Mendix is an SPA - waitForPageLoad()'s networkidle can resolve before
    // the URL has actually changed away from login.html (confirmed live
    // 2026-08-26 after reducing headed-mode slowMo exposed this race).
    // Wait explicitly for the URL to move off login.html first. Bounded and
    // swallowed like waitForPageLoad(), because a genuinely failed login
    // (wrong credentials) correctly stays on login.html forever - that's
    // asserted by other tests in this file, not an error here.
    await this.page.waitForURL((url) => !url.toString().includes('login.html'), { timeout: 15000 }).catch(() => {});
    await this.waitForPageLoad();
  }

  /**
   * Click the Appointment tab.
   */
  async clickAppointmentTab() {
    console.log('Clicking Appointment tab');
    await this.waitForVisible(this.appointmentTab);
    await this.click(this.appointmentTab);
  }

  /**
   * Perform full login using credentials from config.
   */
  async performLogin(username = config.username, password = config.password) {
    console.log(`Performing login for user: ${username}`);
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLogin();
    await this.waitForVisible(this.appointmentTab);
  }

  /**
   * Navigate to the Appointment tab.
   */
  async navigateToAppointment() {
    console.log('Navigating to Appointment tab');
    await this.clickAppointmentTab();
    await this.waitForPageLoad();
  }

  /**
   * Full login + navigate to Appointment tab (convenience method).
   */
  async loginAndNavigateToAppointment() {
    await this.performLogin();
    await this.navigateToAppointment();
  }
}

module.exports = ITAP_Login;
