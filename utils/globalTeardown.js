// utils/globalTeardown.js — closes BrowserFactory's opt-in shared browser
// session (see ManagerReferral's Page.spec.js/Report.spec.js and
// BrowserFactory.launchBrowser's `{ shared: true }` option), if one was ever
// opened during this run. A no-op for every other module, which never opts
// into shared mode, so this has no effect outside ManagerReferral runs.
const BrowserFactory = require('./BrowserFactory');

module.exports = async function globalTeardown() {
  await BrowserFactory.closeSharedSession();
};
