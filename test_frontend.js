const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        recordVideo: {
            dir: 'videos/'
        }
    });
    const page = await context.newPage();

    console.log("Navigating to proxy page...");
    await page.goto('http://localhost:8080/retro-football/');

    // Tap to start
    console.log("Starting game...");
    await page.mouse.click(240, 160);
    await page.waitForTimeout(1000);

    // Change play
    console.log("Changing play...");
    await page.mouse.click(240, 260); // Roughly where the "Change Play" button is
    await page.waitForTimeout(500);

    // Snap ball
    console.log("Snapping ball...");
    await page.mouse.click(240, 160); // Snap ball
    await page.waitForTimeout(1500); // Let players run routes

    console.log("Taking screenshot of routes...");
    await page.screenshot({ path: 'routes_test.png' });

    console.log("Throwing pass...");
    await page.mouse.down({ x: 240, y: 160 });
    await page.mouse.move(140, 160, { steps: 10 }); // Drag back to throw forward
    await page.mouse.up();

    await page.waitForTimeout(2000); // Wait for pass to complete

    await context.close();
    await browser.close();
    console.log("Test finished.");
})();
