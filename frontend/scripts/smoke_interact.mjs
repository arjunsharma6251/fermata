import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,140)));

await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(3000);
await page.locator('text=explore the craft map').scrollIntoViewIfNeeded();
await page.locator('text=explore the craft map').click();
await page.waitForTimeout(3500);

const getT = () => page.locator('svg > g').first().getAttribute('transform');
const t0 = await getT();
console.log('initial transform:', t0);

// ZOOM: wheel up over center of svg
const svg = await page.locator('svg').boundingBox();
await page.mouse.move(svg.x + svg.width/2, svg.y + svg.height/2);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(400);
const tZoom = await getT();
console.log('after zoom:   ', tZoom, '| changed:', tZoom !== t0);

// PAN: drag background from an empty area
await page.mouse.move(svg.x + 120, svg.y + 120);
await page.mouse.down();
await page.mouse.move(svg.x + 260, svg.y + 220, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(400);
const tPan = await getT();
console.log('after pan:    ', tPan, '| changed:', tPan !== tZoom);

// NODE DRAG: grab a node by its label/group and move it
const node = page.locator('svg g').filter({ hasText: 'Self Control' }).first();
const nb = await node.boundingBox();
if (nb) {
  const before = await node.getAttribute('transform');
  await page.mouse.move(nb.x + nb.width/2, nb.y + 30);
  await page.mouse.down();
  await page.mouse.move(nb.x + nb.width/2 + 120, nb.y + 120, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await node.getAttribute('transform');
  console.log('node drag moved:', before !== after);
}
await page.screenshot({ path: '/tmp/smoke_interact.png' });
console.log('page errors:', errs.length ? errs : 'none');
await browser.close();
