import { test } from '@playwright/test';

test.skip(true, 'Manual browser inspection only');

test.use({
  headless: true,
  channel: 'chrome',
});

test('inspect real tenant home page', async ({ page }) => {
  const consoleMessages: Array<{ type: string; text: string }> = [];

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (error) => {
    consoleMessages.push({ type: 'pageerror', text: error.message });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);

  const snapshot = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    buttons: Array.from(document.querySelectorAll('button'))
      .map((element) => (element.textContent || element.getAttribute('aria-label') || '').trim())
      .filter(Boolean),
    links: Array.from(document.querySelectorAll('a'))
      .map((element) => ({
        text: (element.textContent || '').trim(),
        href: element.getAttribute('href'),
      }))
      .filter((entry) => entry.text || entry.href),
    bodyText: (document.body.innerText || '').slice(0, 4_000),
  }));

  console.log(JSON.stringify({ snapshot, consoleMessages }, null, 2));
});

test('inspect real tenant login flow', async ({ page }) => {
  const consoleMessages: Array<{ type: string; text: string }> = [];

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (error) => {
    consoleMessages.push({ type: 'pageerror', text: error.message });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Login' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2_000);

  const snapshot = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    buttons: Array.from(document.querySelectorAll('button, input[type=\"submit\"]'))
      .map((element) =>
        (element.textContent || element.getAttribute('value') || element.getAttribute('aria-label') || '').trim()
      )
      .filter(Boolean),
    inputs: Array.from(document.querySelectorAll('input'))
      .map((element) => ({
        type: element.getAttribute('type'),
        name: element.getAttribute('name'),
        id: element.getAttribute('id'),
        placeholder: element.getAttribute('placeholder'),
      })),
    bodyText: (document.body.innerText || '').slice(0, 4_000),
  }));

  console.log(JSON.stringify({ snapshot, consoleMessages }, null, 2));
});
