// Verify the auth handshake up to Spotify's wall: link renders, the
// localhost->127.0.0.1 hop works, and Spotify accepts client_id +
// redirect_uri (a login form means valid; an error page means not).
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5180/'); // start on localhost on purpose
const link = page.locator('text=or browse your spotify playlists');
await link.waitFor({ timeout: 5000 });
console.log('1. spotify link renders (env loaded)');

await link.click();
await page.waitForURL(/accounts\.spotify\.com/, { timeout: 15000 });
console.log('2. hopped + redirected to:', page.url().split('?')[0]);

await page.waitForTimeout(2500);
const body = await page.textContent('body');
if (/invalid|error/i.test(body ?? '') && !/log in|continue|sign up/i.test(body ?? '')) {
  console.log('3. PROBLEM — page text:', body?.slice(0, 300));
} else {
  console.log('3. Spotify accepted the request (login/consent page shown)');
}
await page.screenshot({ path: '/tmp/shot_spotify_wall.png' });
await browser.close();
