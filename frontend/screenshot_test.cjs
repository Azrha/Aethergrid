const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    console.log('Navigating to localhost:5173...');

    try {
        // Don't wait for networkidle, just load and wait
        await page.goto('http://localhost:5173/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('Page loaded, waiting 25 seconds for rendering...');
        await new Promise(r => setTimeout(r, 25000));

        console.log('Taking screenshot...');
        await page.screenshot({
            path: 'living_world_test.png',
            fullPage: false
        });

        console.log('Screenshot saved to living_world_test.png');

    } catch (e) {
        console.error('Error:', e.message);
    }

    await browser.close();
    console.log('Done!');
})();
