import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('https://www.hearfermata.com/', { waitUntil: 'domcontentloaded' });
// click the spotify entry link
await page.locator('text=browse your spotify playlists').click();
// wait until we land on accounts.spotify.com and read the redirect_uri param
await page.waitForURL(/accounts\.spotify\.com/, { timeout: 20000 }).catch(()=>{});
const url = new URL(page.url());
console.log('authorize host:', url.host);
console.log('redirect_uri SENT:', decodeURIComponent(url.searchParams.get('redirect_uri') || '(none — maybe hopped)'));
console.log('client_id:', url.searchParams.get('client_id'));
console.log('full landing url:', page.url().slice(0,90));
await browser.close();
