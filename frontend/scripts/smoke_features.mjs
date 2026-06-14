import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message));

await page.goto('http://localhost:4180/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'dreams fleetwood mac');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Dreams")').first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(4000);

// --- SHARE CARD ---
await page.locator('text=share the moment').click();
await page.waitForTimeout(1500);
const cardText = await page.locator('text=the moment').count();
console.log('share modal open, card visible:', cardText > 0);
await page.screenshot({ path: '/tmp/smoke_share.png' });
await page.locator('button:has-text("close")').click();
await page.waitForTimeout(500);

// --- CRAFT MAP ---
await page.locator('text=explore the craft map').scrollIntoViewIfNeeded();
await page.locator('text=explore the craft map').click();
await page.waitForTimeout(2500); // seed + cover fetch + force settle
const circles = await page.locator('svg circle').count();
const images = await page.locator('svg image').count();
console.log('craft map open — svg circles:', circles, '| node images:', images);
await page.screenshot({ path: '/tmp/smoke_map.png' });

console.log('console/page errors:', errs.length ? errs.slice(0,4) : 'none');
await browser.close();
