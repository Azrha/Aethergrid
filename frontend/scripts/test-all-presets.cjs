/**
 * Test all world presets by clicking each preset button and taking screenshots
 */
const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');

const PRESETS = [
    'Living World',
    'Fantasy Kingdom',
    'Dinosaur Era',
    'Emberfall Reach',
    'Frostbound Frontier',
    'Deep Space',
    'Oceanic Realm'
];

async function testAllPresets() {
    console.log('Launching browser...');

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--use-gl=swiftshader',
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            console.error('[console error]', msg.text());
        }
    });
    page.on('pageerror', (err) => {
        console.error('[pageerror]', err.message);
    });
    page.on('requestfailed', (req) => {
        const failure = req.failure();
        if (failure) {
            console.error('[requestfailed]', req.url(), failure.errorText);
        }
    });

    console.log('Ensuring backend is ready...');
    await waitForUrl('http://127.0.0.1:8000/api/health', 30000);
    console.log('Backend ready.');

    console.log('Navigating to http://localhost:5173...');

    try {
        console.log('Waiting for Vite...');
        await waitForUrl('http://127.0.0.1:5173', 30000);
        console.log('Loading page...');
        await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
        console.error('Navigation failed:', err.message);
        await browser.close();
        return;
    }

    console.log('Allowing app to hydrate...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await page.waitForFunction(() => {
        const header = document.querySelector('h1');
        return header && header.textContent && header.textContent.toLowerCase().includes('worldforge');
    }, { timeout: 30000 }).catch(() => null);
    await page.waitForSelector('.app-shell', { timeout: 30000 }).catch(() => null);

    // Wait for page to load and backend health indicator
    await new Promise(r => setTimeout(r, 2000));
    await page.waitForFunction(() => {
        const pill = document.querySelector('.status-pill.ok');
        return pill && pill.textContent && pill.textContent.toLowerCase().includes('core online');
    }, { timeout: 30000 }).catch(() => null);

    for (const preset of PRESETS) {
        console.log(`\nTesting: ${preset}`);

        try {
            // Find and click the preset card
            const cards = await page.$$('.preset-card');
            let clicked = false;

            for (const card of cards) {
                const text = await page.evaluate(el => el.textContent, card);
                if (text && text.toLowerCase().includes(preset.toLowerCase())) {
                    await card.click();
                    clicked = true;
                    console.log(`  Clicked: ${text.trim()}`);
                    break;
                }
            }

            if (!clicked) {
                // Try by partial text match
                for (const card of cards) {
                    const text = await page.evaluate(el => el.textContent, card);
                    if (text && preset.toLowerCase().includes(text.toLowerCase().split(' ')[0])) {
                        await card.click();
                        clicked = true;
                        console.log(`  Clicked: ${text.trim()}`);
                        break;
                    }
                }
            }

            // Wait for Apply button and click it
            await new Promise(r => setTimeout(r, 500));
            const buttons = await page.$$('button');
            for (const button of buttons) {
                const text = await page.evaluate(el => el.textContent, button);
                if (text && text.trim().toLowerCase() === "apply") {
                    await button.click();
                    console.log('  Applied');
                    break;
                }
            }

            await waitForFieldsReady(15000);
            // Wait for render
            await new Promise(r => setTimeout(r, 1200));
            await waitForFunctionSafe(page, () => {
                const canvas = document.querySelector('.viewer-card canvas');
                if (!canvas) return false;
                const waiting = Array.from(document.querySelectorAll('.viewer-card *'))
                    .some(el => (el.textContent || '').includes('Waiting for world data'));
                return !waiting;
            }, 15000);

            // Take screenshot from main canvas to avoid blank full-page renders
            const filename = preset.toLowerCase().replace(/\s+/g, '_') + '.png';
            const screenshotPath = path.join(__dirname, '..', 'test-screenshots', filename);
            const canvas = await page.$('.viewer-card canvas');
            if (canvas) {
                await canvas.screenshot({ path: screenshotPath });
                console.log(`  Screenshot: ${filename}`);
            } else {
                console.warn('  Canvas missing, capturing full page instead.');
                await page.screenshot({ path: screenshotPath });
            }

        } catch (err) {
            console.error(`  Error: ${err.message}`);
        }
    }

    // Final full screenshot
    const finalPath = path.join(__dirname, '..', 'test-screenshot.png');
    const finalCanvas = await waitForSelectorSafe(page, '.viewer-card canvas', 15000);
    if (finalCanvas) {
        await finalCanvas.screenshot({ path: finalPath });
    } else {
        await page.screenshot({ path: finalPath });
    }
    console.log('\nFinal screenshot saved');

    await browser.close();
    console.log('Done!');
}

function waitForUrl(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const attempt = () => {
            const req = http.get(url, (res) => {
                res.resume();
                if (res.statusCode && res.statusCode < 500) {
                    resolve();
                } else if (Date.now() - start > timeoutMs) {
                    reject(new Error(`Timeout waiting for ${url}`));
                } else {
                    setTimeout(attempt, 500);
                }
            });
            req.on('error', () => {
                if (Date.now() - start > timeoutMs) {
                    reject(new Error(`Timeout waiting for ${url}`));
                } else {
                    setTimeout(attempt, 500);
                }
            });
        };
        attempt();
    });
}

function waitForFieldsReady(timeoutMs) {
    return new Promise((resolve) => {
        const start = Date.now();
        const attempt = () => {
            const req = http.get('http://127.0.0.1:8000/api/fields?step=2', (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200 && data.includes('"terrain"')) {
                        resolve(true);
                    } else if (Date.now() - start > timeoutMs) {
                        resolve(false);
                    } else {
                        setTimeout(attempt, 500);
                    }
                });
            });
            req.on('error', () => {
                if (Date.now() - start > timeoutMs) {
                    resolve(false);
                } else {
                    setTimeout(attempt, 500);
                }
            });
        };
        attempt();
    });
}

async function waitForSelectorSafe(page, selector, timeoutMs) {
    return Promise.race([
        page.waitForSelector(selector, { timeout: timeoutMs }).catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
}

async function waitForFunctionSafe(page, fn, timeoutMs) {
    return Promise.race([
        page.waitForFunction(fn, { timeout: timeoutMs }).catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
}

// Create screenshots directory
const fs = require('fs');
const screenshotsDir = path.join(__dirname, '..', 'test-screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

testAllPresets().catch(console.error);
