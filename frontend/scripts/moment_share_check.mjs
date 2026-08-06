// Verify the moment-share loop end to end against the Next dev server:
// analyze a song, copy a moment link from the rail, open it cold, and
// confirm the playhead parks on the moment + the rail marks it as shared.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
  });
});

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // let React hydrate so the form doesn't native-submit
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(2500);

// copy the first moment's link from the rail
const linkBtn = page.getByRole('button', { name: 'link ⎘', exact: true }).first();
await linkBtn.scrollIntoViewIfNeeded();
await linkBtn.click();
await page.waitForTimeout(300);
const url = await page.evaluate(() => window.__copied);
console.log('copied moment url:', url);
if (!url || !url.includes('/m/')) throw new Error('no moment link copied');

// open the link cold (analysis is now cached, so this is fast)
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 120000 });
await page.waitForTimeout(3500); // let reveal + initial seek settle

const timeText = await page.locator('span.mono', { hasText: '/' }).first().textContent();
console.log('playhead time:', timeText?.trim());
const shared = await page.locator('text=shared with you').count();
console.log('"shared with you" tag count:', shared);
const callout = await page.locator('text=the moment ·').first().textContent();
console.log('callout:', callout?.trim());

await page.screenshot({
  path: process.env.SHOT ?? '/tmp/moment_share_check.png',
  fullPage: false,
});
await browser.close();
