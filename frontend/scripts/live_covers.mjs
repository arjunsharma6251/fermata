import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'dancing on my own robyn');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Dancing On My Own")').first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(4000);
await page.locator('text=if this moved you').scrollIntoViewIfNeeded({ timeout: 15000 });
await page.waitForTimeout(3000); // let covers fetch + load

// how many suggestion cards have a loaded <img>?
const imgs = await page.locator('button[title^="analyze"] img').count();
const loaded = await page.locator('button[title^="analyze"] img').evaluateAll(
  els => els.filter(i => i.naturalWidth > 0).length
);
console.log('suggestion cards with cover <img>:', imgs, '| actually loaded:', loaded);

const box = await page.locator('text=if this moved you').locator('xpath=..').boundingBox();
await page.screenshot({ path: '/tmp/live_covers.png', clip: { x: box.x-20, y: box.y-10, width: 1300, height: 240 } });
await browser.close();
