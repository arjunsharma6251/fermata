import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,120)); });
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,120)));

await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(3500);

// SHARE
await page.locator('text=share the moment').click();
await page.waitForTimeout(1800);
console.log('share modal: card has "the moment" text:', await page.locator('div >> text=the moment').count() > 0);
await page.screenshot({ path: '/tmp/smoke_share.png' });
// try a download (verifies html-to-image render works)
const dl = page.waitForEvent('download', { timeout: 20000 }).catch(()=>null);
await page.locator('button:has-text("download png")').click();
const d = await dl;
console.log('download fired:', !!d, d ? '('+d.suggestedFilename()+')' : '');
await page.locator('button:has-text("close")').click();
await page.waitForTimeout(500);

// MAP
await page.locator('text=explore the craft map').scrollIntoViewIfNeeded();
await page.locator('text=explore the craft map').click();
await page.waitForTimeout(3000);
console.log('craft map — circles:', await page.locator('svg circle').count(), '| node images:', await page.locator('svg image').count());
await page.screenshot({ path: '/tmp/smoke_map.png' });

console.log('errors:', errs.length ? errs.slice(0,4) : 'none');
await browser.close();
