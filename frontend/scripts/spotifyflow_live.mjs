// Headed end-to-end: user logs in, script drives playlist -> track ->
// Deezer match -> analysis result.
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

await page.goto('http://127.0.0.1:5180/');
await page.locator('text=or browse your spotify playlists').click();
console.log('waiting for user to approve in the opened window…');

await page.waitForSelector('text=your playlists · spotify', { timeout: 180000 });
console.log('OK: logged in, playlists rendered');
await page.screenshot({ path: '/tmp/shot_sp_playlists.png' });

const firstPlaylist = page.locator('button:has(img)').first();
const plName = (await firstPlaylist.textContent())?.slice(0, 60);
await firstPlaylist.click();
await page.waitForSelector('text=← playlists', { timeout: 30000 });
console.log('OK: opened playlist:', plName);
await page.screenshot({ path: '/tmp/shot_sp_tracks.png' });

const firstTrack = page.locator('button:has(img)').first();
const trName = (await firstTrack.textContent())?.slice(0, 80);
console.log('picking track:', trName);
await firstTrack.click();

await page.waitForSelector('[aria-label="play preview"]', { timeout: 300000 });
await page.waitForTimeout(4500);
const headline = await page.locator('h2').first().textContent();
console.log('OK: analysis rendered — headline:', headline);
await page.screenshot({ path: '/tmp/shot_sp_result.png' });
await browser.close();
