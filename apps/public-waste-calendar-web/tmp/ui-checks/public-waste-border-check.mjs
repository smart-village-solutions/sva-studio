import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[aria-label="Ort suchen"]', { timeout: 15000 });
await page.focus('input[aria-label="Ort suchen"]');
mkdirSync('tmp/ui-checks', { recursive: true });
await page.screenshot({ path: 'tmp/ui-checks/public-waste-border-check.png', fullPage: true });
await browser.close();
