import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(3000);
await page.locator('text=explore the craft map').scrollIntoViewIfNeeded();
await page.locator('text=explore the craft map').click();
await page.waitForTimeout(3000);
const info = await page.locator('svg image').first().evaluate(el => ({
  clipAttr: el.getAttribute('clip-path'),
  computed: getComputedStyle(el).clipPath,
}));
console.log('image clip-path attr:', info.clipAttr);
console.log('computed clipPath:', info.computed);
const cp = await page.locator('svg clipPath').count();
console.log('clipPath defs in svg:', cp);
await browser.close();
