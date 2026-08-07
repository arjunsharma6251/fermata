// Open the share modal in story format for a seeded song and screenshot
// both the modal and the full-size story card export.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.fill('input[aria-label="search for a song"]', 'choosin texas ella langley');
await page.keyboard.press('Enter');
await page.locator('button:has-text("Choosin")').first().click({ timeout: 30000 });
await page.waitForSelector('[aria-label="play preview"]', { timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('button:has-text("share the moment")').click();
await page.waitForTimeout(600);
await page.locator('button:has-text("story · 9:16")').click();
await page.waitForTimeout(800);
await page.screenshot({ path: process.env.SHOT_MODAL ?? '/tmp/story_modal.png' });
// capture the card node itself at full size (it's scaled in the preview,
// but elementHandle.screenshot captures the rendered box — good enough to judge)
const card = page.locator('div').filter({ has: page.locator('text=the craft behind why it hits') }).last();
await card.screenshot({ path: process.env.SHOT_CARD ?? '/tmp/story_card.png' });
await browser.close();
