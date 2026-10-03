// Starts a Chromium without downloading one: first a locally preinstalled one, then the system Chrome
// (present on GitHub's ubuntu runners), last Playwright's own if it is installed.
const { chromium } = require('playwright');
const tries = [{ executablePath: '/opt/pw-browsers/chromium' }, { channel: 'chrome' }, {}];
module.exports = async function launch() {
  let err;
  for (const opts of tries) {
    try { return await chromium.launch(opts); } catch (e) { err = e; }
  }
  throw err;
};
