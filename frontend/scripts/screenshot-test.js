/**
 * Screenshot test script using Puppeteer
 * Takes a screenshot of the app to verify rendering
 * Run with: npx ts-node scripts/screenshot-test.ts
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function takeScreenshot() {
    console.log('Launching browser...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for canvas to be ready
    console.log('Waiting for canvas...');
    await page.waitForSelector('canvas', { timeout: 10000 });

    // Wait a bit more for rendering
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    const screenshotPath = path.join(__dirname, '..', 'test-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Check for checkered pattern (transparency) by analyzing pixels
    // The canvas should NOT have the grey/white checkered pattern

    await browser.close();
    console.log('Done!');
}

takeScreenshot().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
