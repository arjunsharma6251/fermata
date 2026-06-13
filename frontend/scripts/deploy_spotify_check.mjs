import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('https://fermata-vert.vercel.app/');
const link = page.locator('text=browse your spotify playlists');
await link.waitFor({ timeout: 8000 });
await link.click();
await page.waitForURL(/accounts\.spotify\.com/, { timeout: 20000 });
await page.waitForTimeout(2500);
const url = page.url();
const body = (await page.textContent('body')) ?? '';
console.log('landed on:', url.split('?')[0]);
if (/redirect_uri|not matching|invalid/i.test(body) && !/log in|continue|password|email/i.test(body)) {
  console.log('RESULT: STILL FAILING — error text:', body.slice(0, 200));
} else {
  console.log('RESULT: OK — Spotify accepted the redirect_uri, login/consent shown');
}
await browser.close();
