import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,140)));

await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'dancing on my own robyn');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Dancing On My Own")').first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(3500);
await page.locator('text=explore the craft map').scrollIntoViewIfNeeded();
await page.locator('text=explore the craft map').click();
await page.waitForTimeout(4000); // let force settle

const before = await page.locator('svg image').count();
// click a node group by its bounding box center (robust vs moving SVG)
const groups = page.locator('svg > g');
const n = await groups.count();
// pick a node group that's NOT the center (find one with an image child, skip first)
let clicked = false;
for (let i = 0; i < n; i++) {
  const g = groups.nth(i);
  if (await g.locator('image').count() && !(await g.locator('text', { hasText: 'Dancing' }).count())) {
    const box = await g.boundingBox();
    if (box) { await page.mouse.click(box.x + box.width/2, box.y + box.height/2); clicked = true; break; }
  }
}
console.log('clicked a node:', clicked, '| nodes before:', before);
await page.waitForTimeout(22000); // real /api/suggest LLM call
const after = await page.locator('svg image').count();
console.log('nodes after expand:', after, after > before ? '✓ GREW' : '(no growth)');
await page.screenshot({ path: '/tmp/live_expand.png' });
console.log('page errors:', errs.length ? errs : 'none');
await browser.close();
