const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: './videos/',
      size: { width: 800, height: 600 }
    }
  });

  const page = await context.newPage();

  // Go to retro football page (served by proxy.py typically on 8080)
  await page.goto('http://localhost:8080/retro-football/');

  // Take screenshot of main menu
  await page.screenshot({ path: 'menu.png' });

  // Start the game
  await page.mouse.click(400, 300);

  // Wait a moment for players to snap
  await page.waitForTimeout(500);

  // Snap ball
  await page.mouse.click(400, 300);

  // Wait some time to let blocking happen
  await page.waitForTimeout(3000);

  // Take screenshot of blocking in action
  await page.screenshot({ path: 'blocking.png' });

  await browser.close();
  console.log('Playwright test completed.');
})();
