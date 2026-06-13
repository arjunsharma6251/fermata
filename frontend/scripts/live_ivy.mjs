import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });

await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.waitForSelector('text=matches', { timeout: 20000 });
await page.waitForTimeout(1000);

// list the results to confirm the real Ivy is present
const rows = await page.locator('button:has(img)').allInnerTexts();
console.log('RESULTS:');
rows.slice(0,8).forEach(r => console.log('  ', r.replace(/\n/g,' ')));
const realIvy = rows.find(r => /^Ivy\b/.test(r) && /Frank Ocean/.test(r));
console.log('\nreal Ivy present:', !!realIvy);

// click the real Ivy and analyze
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click();
console.log('analyzing Ivy...');
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(4000);
console.log('headline:', await page.locator('h2').first().textContent());
console.log('console errors:', errs.length ? errs.slice(0,2) : 'none');
await page.screenshot({ path: '/tmp/live_ivy.png' });
await browser.close();
