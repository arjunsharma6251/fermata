import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const targets = [
  'https://stabilityai-stable-diffusion.hf.space/',   // known public, control
  'https://arjunsharma-fermata.hf.space/api/health',  // ours
];
for (const url of targets) {
  try {
    const res = await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    const t = (await page.title()).slice(0,40);
    console.log(`${res.status()}  ${url}\n      title="${t}"`);
  } catch (e) { console.log(`ERR ${url} ${e.message.slice(0,60)}`); }
}
await browser.close();
