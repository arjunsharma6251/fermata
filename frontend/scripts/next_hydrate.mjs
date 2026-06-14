import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const msgs = [];
page.on('console', m => msgs.push(`[${m.type()}] ${m.text().slice(0,200)}`));
page.on('pageerror', e => msgs.push(`PAGEERROR: ${e.message.slice(0,300)}`));
await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
console.log('=== console / errors ===');
msgs.filter(m => /error|warn|hydrat|PAGEERROR/i.test(m)).slice(0,8).forEach(m => console.log(m));
if (!msgs.some(m=>/error|hydrat|PAGEERROR/i.test(m))) console.log('(no errors/warnings)');
// is the search interactive?
await page.fill('input[aria-label="search for a song"]', 'test');
const before = page.url();
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
console.log('url after enter:', page.url(), before===page.url()?'(no nav — handler worked)':'(NAVIGATED — not hydrated)');
await browser.close();
