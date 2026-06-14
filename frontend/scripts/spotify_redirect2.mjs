import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
// capture the request to /authorize directly
let authUrl = null;
page.on('request', r => { if (r.url().includes('accounts.spotify.com/authorize')) authUrl = r.url(); });
await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
await page.locator('text=browse your spotify playlists').click();
await page.waitForTimeout(4000);
if (authUrl) {
  const u = new URL(authUrl);
  console.log('redirect_uri SENT:', decodeURIComponent(u.searchParams.get('redirect_uri')));
} else {
  console.log('no /authorize request captured');
}
await browser.close();
