const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Starting Playwright for Human PAT and CPU Kickoff test...');
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

    // 1. Kickoff
    console.log('Clicking to start game (MENU -> KICKOFF)');
    await page.mouse.click(240, 160);
    await page.waitForTimeout(500);

    // Kicking ball (Human Kickoff action)
    console.log('Kicking off (Human Kickoff)');
    await page.mouse.click(240, 160);
    await page.waitForTimeout(1500); // Wait for ball to land/play over

    // 2. Play over screen
    console.log('Clicking past Play Over screen');
    await page.mouse.click(240, 160);
    await page.waitForTimeout(500);

    // 3. Inject a Touchdown to trigger PAT
    console.log('Injecting Touchdown state via JS to force PAT');
    await page.evaluate(() => {
        // Force the ball into the endzone
        ball.x = 10;
        ball.y = 160;
        ball.z = 0;
        ball.state = 'grounded';
        currentState = GameState.PLAY_OVER;
    });
    await page.waitForTimeout(500);

    // 4. Click past Play Over screen to enter PAT setup
    console.log('Clicking past TD Play Over screen');
    await page.mouse.click(240, 160);
    await page.waitForTimeout(500);

    // Screenshot PAT UI
    await page.screenshot({ path: 'pat_ui.png' });
    console.log('Saved pat_ui.png');

    // 5. Click 1 PT (KICK) button
    console.log('Clicking 1 PT (KICK) button');
    // x: GAME_WIDTH / 2, y: GAME_HEIGHT - 25
    await page.mouse.click(240, 295);
    await page.waitForTimeout(1500); // wait for kick play over

    // Screenshot PAT Kick
    await page.screenshot({ path: 'pat_kick.png' });
    console.log('Saved pat_kick.png');

    // Click past Play Over screen
    await page.mouse.click(240, 160);
    await page.waitForTimeout(500);

    // 6. CPU Kickoff
    console.log('Checking CPU Kickoff state');
    await page.screenshot({ path: 'cpu_kickoff.png' });
    console.log('Saved cpu_kickoff.png');

    // CPU should automatically kick if we just tap to start play
    await page.mouse.click(240, 160);
    await page.waitForTimeout(1000); // wait for CPU kick

    await context.close();
    await browser.close();

    console.log('Verification 2 complete.');
})();