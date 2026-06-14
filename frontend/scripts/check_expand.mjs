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
await page.locator('text=explore the craft map').scrollIntoViewIfNeeded();
await page.locator('text=explore the craft map').click();
await page.waitForTimeout(3500);
const before = await page.locator('svg image').count();
// click a frontier node group by box center
const groups = page.locator('svg > g > g');
const n = await groups.count();
for (let i=0;i<n;i++){
  const g = groups.nth(i);
  if (await g.locator('image').count() && !(await g.locator('text', {hasText:'Ivy'}).count())){
    const b = await g.boundingBox();
    if (b){ await page.mouse.click(b.x+b.width/2, b.y+30); break; }
  }
}
console.log('clicked frontier node; nodes before:', before, '(expanding via /api/suggest, ~25s)');
await page.waitForTimeout(28000);
const after = await page.locator('svg image').count();
console.log('nodes after expand:', after, after>before?'✓ GREW':'(no growth)');
await browser.close();
