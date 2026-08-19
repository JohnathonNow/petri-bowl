const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Starting Playwright...');
    const browser = await chromium.launch();
    const context = await browser.newContext({
        recordVideo: {
            dir: './videos/',
            size: { width: 480, height: 320 }
        }
    });
    const page = await context.newPage();
    console.log('Navigating to game...');
    await page.goto('http://localhost:3000/');

    // Wait for the game to load
    await page.waitForTimeout(1000);

    // Click to start from MENU -> KICKOFF
    console.log('Clicking to start game (MENU -> KICKOFF)');
    await page.mouse.click(240, 160);
    await page.waitForTimeout(500);

    // Take a screenshot of Kickoff alignment
    await page.screenshot({ path: 'kickoff.png' });
    console.log('Saved kickoff.png');

    // Play the kickoff
    await page.mouse.click(240, 160);
    await page.waitForTimeout(1500); // Wait for ball to land

    // Take screenshot of first play
    await page.screenshot({ path: 'first_play.png' });

    // Let's force a field goal click
    // FG button is roughly around x: GAME_WIDTH/2 + 50, y: GAME_HEIGHT - 25
    console.log('Clicking Field Goal Button');
    await page.mouse.click(290, 295);
    await page.waitForTimeout(1000); // Wait for kick to happen

    await page.screenshot({ path: 'fg_kick.png' });
    console.log('Saved fg_kick.png');

    await context.close();
    await browser.close();

    // Print out video path
    const files = fs.readdirSync('./videos/');
    console.log('Video saved to:', files[0]);
    console.log('Verification complete.');
})();