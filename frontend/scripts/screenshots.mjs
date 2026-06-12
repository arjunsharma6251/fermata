// Screenshot driver: idle hero, then a full cached-result page (Robyn).
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5180/');
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/shot_idle.png' });

await page.fill('input[aria-label="search for a song"]', 'dancing on my own robyn');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shot_results.png' });

// pick the first result — cached in backend, so this returns fast
await page.locator('button:has-text("Dancing On My Own")').first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shot_analyzing.png' });
await page.waitForTimeout(6000); // draw-in + bloom + reveal
await page.screenshot({ path: '/tmp/shot_result_top.png' });
await page.screenshot({ path: '/tmp/shot_result_full.png', fullPage: true });
await browser.close();
