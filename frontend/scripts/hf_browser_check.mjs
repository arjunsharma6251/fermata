// Hit the HF backend from real Chrome (HF blocks the sandbox's curl, not a
// real browser). Reports what each endpoint actually returns.
import { chromium } from 'playwright';
const HF = 'https://arjunsharma-fermata.hf.space';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

for (const path of ['/api/health', '/']) {
  try {
    const res = await page.goto(HF + path, { timeout: 30000, waitUntil: 'domcontentloaded' });
    const body = (await page.content()).replace(/\s+/g, ' ').slice(0, 120);
    console.log(`${path} -> ${res.status()}  ${body}`);
  } catch (e) {
    console.log(`${path} -> ERROR ${e.message.slice(0,80)}`);
  }
}

// real analysis via fetch from the page context (Deezer id for Dreams)
try {
  const r = await page.evaluate(async (hf) => {
    const res = await fetch(hf + '/api/analyze/63480987');
    return { status: res.status, body: (await res.text()).slice(0, 200) };
  }, HF);
  console.log(`\nanalyze -> ${r.status}  ${r.body}`);
} catch (e) { console.log('analyze ERROR', e.message.slice(0,100)); }

await browser.close();
