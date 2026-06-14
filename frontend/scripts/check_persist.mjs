import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('fermata.discovery.v1'));
await page.reload();
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(2000);
// reload -> back to home -> is the map link present?
await page.reload();
await page.waitForTimeout(1500);
const homeLink = await page.locator('button:has-text("open your craft map")').count();
console.log('home-screen map link after reload:', homeLink > 0 ? 'PRESENT ✓' : 'missing');
await browser.close();
