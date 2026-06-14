import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1900, height: 900 } });
await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(3500);
// read the marker label (the mono text above the waveform)
const markerLabel = await page.locator('span.mono', { hasText: 'clip' }).first().textContent().catch(()=>null);
console.log('marker label:', markerLabel);
await page.screenshot({ path: '/tmp/check_marker.png', clip: { x: 0, y: 0, width: 1900, height: 520 } });
await browser.close();
