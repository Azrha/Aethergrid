/**
 * Screenshot test script using Puppeteer
 * Run with: node scripts/screenshot-test.cjs
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function takeScreenshot() {
    console.log('Launching browser...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    console.log('Navigating to http://localhost:5173...');

    try {
    page.setDefaultTimeout(240000);
    page.setDefaultNavigationTimeout(240000);
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 240000 });
    } catch (err) {
        console.error('Failed to navigate:', err.message);
        await browser.close();
        return;
    }

    // Wait for canvas to be ready
    console.log('Waiting for canvas...');
    try {
    await page.waitForSelector('canvas', { timeout: 240000 });
    } catch (err) {
        console.error('Canvas not found:', err.message);
        await browser.close();
        return;
    }

    if (process.env.APPLY_DEFAULT === '1') {
        console.log('Applying default world...');
        await page.waitForSelector('.preset-card', { timeout: 120000 });
        await page.$$eval('.preset-card', (nodes) => {
            const target = nodes.find((n) => (n.textContent || '').toLowerCase().includes('ai village')) || nodes[0];
            if (target && target.click) target.click();
        });
        await new Promise((r) => setTimeout(r, 1200));
        await page.evaluate(async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60000);
            try {
                await fetch('http://127.0.0.1:8000/api/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({ run: true, tick_ms: 33, steps: 1 })
                });
            } finally {
                clearTimeout(timeout);
            }
        });
        await new Promise((r) => setTimeout(r, 3000));
    }

    // Wait for render: detect non-empty pixels on canvas
    console.log('Waiting for render...');
    const start = Date.now();
    while (Date.now() - start < 240000) {
        const ready = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return false;
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;
            const width = canvas.width;
            const height = canvas.height;
            const samplePoints = [];
            for (let i = 0; i < 16; i++) {
                const px = Math.floor(width * 0.2 + (i % 4) * width * 0.18);
                const py = Math.floor(height * 0.45 + Math.floor(i / 4) * height * 0.12);
                samplePoints.push([px, py]);
            }
            const sky = [135, 206, 235]; // #87CEEB
            let hits = 0;
            for (const [px, py] of samplePoints) {
                const data = ctx.getImageData(px, py, 1, 1).data;
                const dr = Math.abs(data[0] - sky[0]);
                const dg = Math.abs(data[1] - sky[1]);
                const db = Math.abs(data[2] - sky[2]);
                if (dr + dg + db > 30) hits += 1;
            }
            return hits >= 2;
        });
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Take screenshot
    const screenshotPath = path.join(__dirname, '..', 'test-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log('Screenshot saved to:', screenshotPath);

    await browser.close();
    console.log('Done!');
}

takeScreenshot().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
