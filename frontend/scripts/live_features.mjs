import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,120)); });
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,120)));

await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'dancing on my own robyn');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Dancing On My Own")').first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(4000);

// confirm suggestions rendered (max_tokens fix working)
const suggCards = await page.locator('button[title^="analyze"]').count();
console.log('suggestion cards:', suggCards);

// SHARE
await page.locator('text=share the moment').click();
await page.waitForTimeout(1500);
const dl = page.waitForEvent('download', { timeout: 25000 }).catch(()=>null);
await page.locator('button:has-text("download png")').click();
const d = await dl;
console.log('share PNG downloaded:', !!d, d ? d.suggestedFilename() : '');
await page.locator('button:has-text("close")').click();
await page.waitForTimeout(500);

// CRAFT MAP + expansion
await page.locator('text=explore the craft map').scrollIntoViewIfNeeded();
await page.locator('text=explore the craft map').click();
await page.waitForTimeout(3000);
const before = await page.locator('svg g[transform^="translate"]').count();
console.log('map seeded nodes (approx):', await page.locator('svg image').count());
// expand: click a non-center node's album art to fetch ITS craft links
const node = page.locator('svg g').filter({ hasText: 'Kate Bush' }).first();
const target = (await node.count()) ? node : page.locator('svg circle').nth(3);
await target.click();
console.log('clicked a node to expand (fetching /api/suggest)...');
await page.waitForTimeout(20000); // real LLM suggest call
const after = await page.locator('svg image').count();
console.log('node images after expand:', after);
await page.screenshot({ path: '/tmp/live_map.png' });
console.log('errors:', errs.length ? errs.slice(0,4) : 'none');
await browser.close();
