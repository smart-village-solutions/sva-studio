import { chromium } from '@playwright/test';

const baseUrl = process.env.ACCEPTANCE_BASE_URL ?? 'https://hb-meinquartier.studio.smart-village.app';
const username = process.env.ACCEPTANCE_TEST_USERNAME;
const password = process.env.ACCEPTANCE_TEST_PASSWORD;

if (!username) {
  console.error('ACCEPTANCE_TEST_USERNAME fehlt.');
  process.exit(2);
}

if (!password) {
  console.error('ACCEPTANCE_TEST_PASSWORD fehlt.');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  const userInput = page.locator('input[name="username"], input#username').first();
  const passwordInput = page.locator('input[name="password"], input#password').first();
  const submitButton = page.locator('input[type="submit"], button[type="submit"], #kc-login').first();

  if (await userInput.isVisible().catch(() => false)) {
    await userInput.fill(username);
    await passwordInput.fill(password);
    await submitButton.click();
  }

  await page
    .waitForURL((url) => url.toString().startsWith(`${baseUrl}/account`), {
      timeout: 30_000,
    })
    .catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});

  const context = page.context();
  const [authMe, profile] = await Promise.all([
    context.request.get(`${baseUrl}/auth/me`),
    context.request.get(`${baseUrl}/api/v1/iam/users/me/profile`, {
      headers: { 'x-debug-profile-errors': '1' },
    }),
  ]);

  const heading = (await page.locator('h1').first().textContent().catch(() => null))?.trim() ?? null;
  const profileErrorText = await page.getByText(/Profil konnte nicht geladen werden/i).textContent().catch(() => null);

  console.log(
    JSON.stringify(
      {
        finalUrl: page.url(),
        title: await page.title(),
        heading,
        profileErrorText,
        authMe: {
          status: authMe.status(),
          body: await authMe.json().catch(async () => await authMe.text()),
        },
        profile: {
          status: profile.status(),
          requestId: profile.headers()['x-request-id'] ?? null,
          body: await profile.json().catch(async () => await profile.text()),
        },
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
