import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,140)));
await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000); // let it hydrate (dev compile)
await page.fill('input[aria-label="search for a song"]', 'ivy frank ocean');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Ivy")', { hasText: 'Frank Ocean' }).first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(3000);
console.log('headline:', (await page.locator('h2').first().textContent())?.slice(0,55));
console.log('marker:', await page.locator('span.mono', { hasText: 'clip' }).first().textContent().catch(()=>'?'));
console.log('your map link appears:', await page.locator('button:has-text("your map")').count() > 0);
console.log('errors:', errs.length ? errs.slice(0,3) : 'none');
await browser.close();
