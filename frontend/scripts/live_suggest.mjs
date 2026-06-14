import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });

await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.fill('input[aria-label="search for a song"]', 'dancing on my own robyn');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Dancing On My Own")').first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(4000);

// scroll to suggestions
await page.locator('text=if this moved you').scrollIntoViewIfNeeded({ timeout: 15000 });
await page.waitForTimeout(800);
const sugg = await page.locator('text=if this moved you').locator('xpath=following-sibling::div').first().innerText();
console.log('SUGGESTIONS:\n' + sugg);
await page.screenshot({ path: '/tmp/live_suggest.png' });

// click the first suggestion → should analyze it (discovery loop)
const firstSugg = page.locator('button[title^="analyze"]').first();
const what = await firstSugg.locator('p').first().textContent();
console.log('\nclicking suggestion:', what);
await firstSugg.click();
await page.waitForSelector('[aria-label="play preview"]', { timeout: 240000 });
await page.waitForTimeout(3500);
console.log('new analysis headline:', await page.locator('h2').first().textContent());
console.log('console errors:', errs.length ? errs.slice(0,2) : 'none');
await browser.close();
