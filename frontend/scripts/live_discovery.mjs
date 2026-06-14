import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,140)));
await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('fermata.discovery.v1'));
await page.reload();

// analyze 2 songs (cached on HF → fast)
for (const q of ['ivy frank ocean', 'dancing on my own robyn']) {
  if (await page.locator('input[aria-label="search for a song"]').count()) {
    await page.fill('input[aria-label="search for a song"]', q);
    const btn = page.locator('button.mono:has-text("search")');
    if (await btn.count()) await btn.click(); else await page.keyboard.press('Enter');
  }
  const title = q.includes('ivy') ? 'Ivy' : 'Dancing On My Own';
  await page.locator(`button:has-text("${title}")`).first().click({ timeout: 30000 });
  await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
  await page.waitForTimeout(2500);
}
// open your map from header
await page.locator('button:has-text("your map")').click();
await page.waitForTimeout(3500);
const imgs = await page.locator('svg image').count();
const dashed = await page.locator('svg circle[stroke-dasharray="3 4"]').count();
const header = await page.locator('text=explored').first().textContent();
console.log('map header:', header.trim());
console.log('node covers:', imgs, '| frontier dashed rings:', dashed);
await page.screenshot({ path: '/tmp/live_discovery.png' });
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
