// axe's Puppeteer peer dependency must not download a browser during deploy
// installs. Browser QA uses an existing Chrome/Chromium via puppeteer-core.
module.exports = { skipDownload: true };
