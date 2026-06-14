import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,140)));
// start clean
await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('fermata.discovery.v1'));
await page.reload();

// analyze song 1
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(2500);
// analyze song 2 via header search
await page.fill('input[aria-label="search for a song"]', 'dancing on my own robyn');
await page.locator('button.mono:has-text("search")').click();
await page.locator('button:has-text("Dancing On My Own")').first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(2500);

// open "your map" from header
const yourMap = page.locator('button:has-text("your map")');
console.log('your map button present:', await yourMap.count() > 0);
await yourMap.click();
await page.waitForTimeout(3500); // settle + cover fetch
const imgs = await page.locator('svg image').count();
const dashed = await page.locator('svg circle[stroke-dasharray="3 4"]').count();
console.log('nodes with covers:', imgs, '| frontier (dashed) rings:', dashed);
await page.screenshot({ path: '/tmp/smoke_discovery.png' });

// persistence: reload and reopen
await page.locator('button:has-text("close")').click();
await page.reload();
await page.waitForTimeout(1500);
const stillThere = await page.locator('button:has-text("your map")').count();
console.log('after reload, your map persists:', stillThere > 0);
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
