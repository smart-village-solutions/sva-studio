import { expect, test } from '@playwright/test';

import { hasDeMusterhausenAuthSetupCredentials } from '../src/lib/playwright-auth-session-config';

test.describe('cross-browser real tenant auth', () => {
  test.skip(
    !hasDeMusterhausenAuthSetupCredentials(process.env),
    'Cross-browser real auth E2E requires PLAYWRIGHT_DE_MUSTERHAUSEN_* credentials.'
  );

  test('real authenticated tenant smoke keeps protected content reachable', async ({ page }) => {
    await page.goto('/admin/content');

    await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
    await Promise.any([
      page.getByRole('heading', { name: 'Inhalte' }).waitFor({ state: 'visible' }),
      page.getByRole('table', { name: 'Inhalte' }).waitFor({ state: 'visible' }),
      page.getByText('Noch keine Inhalte vorhanden').waitFor({ state: 'visible' }),
    ]);
  });
});
