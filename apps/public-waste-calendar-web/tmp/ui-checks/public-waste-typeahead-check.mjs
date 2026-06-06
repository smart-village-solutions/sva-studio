import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Standort wählen', { timeout: 15000 });
mkdirSync('tmp/ui-checks', { recursive: true });
await page.screenshot({ path: 'tmp/ui-checks/public-waste-selection-typeahead-empty.png', fullPage: true });
await page.fill('input[aria-label="Ort suchen"]', 'ba');
await page.waitForTimeout(250);
await page.screenshot({ path: 'tmp/ui-checks/public-waste-selection-typeahead-suggestions.png', fullPage: true });
await browser.close();
