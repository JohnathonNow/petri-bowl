const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8080');

  // Wait for the scene to load and draw
  await page.waitForTimeout(3000);

  // Take a screenshot
  await page.screenshot({ path: 'football_screenshot.png' });
  await browser.close();
})();
