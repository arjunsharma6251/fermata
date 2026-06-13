// Drive the REAL live site (hearfermata.com) end to end as a visitor would.
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'dreams fleetwood mac');
await page.keyboard.press('Enter');
console.log('searched; waiting for results...');
await page.locator('button:has-text("Dreams")').first().click({ timeout: 30000 });
console.log('picked a track; waiting for analysis (HF cold start + ~60s analysis)...');

await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(4500);
const headline = await page.locator('h2').first().textContent();
const bars = await page.locator('div[role="slider"] > div').count();
console.log('\nRESULT:');
console.log('  headline:', headline);
console.log('  waveform bars rendered:', bars);
console.log('  console errors:', errors.length ? errors.slice(0,3) : 'none');
await page.screenshot({ path: '/tmp/live_result.png', fullPage: false });
await browser.close();
