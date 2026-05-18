import { expect, test } from '@playwright/test';

test('resolves a location, restores it from cookie, and exposes accessible export and detail actions', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Musterstadt' }).click();
  await page.getByRole('button', { name: 'Hauptstraße' }).click();
  await page.getByRole('button', { name: '12' }).click();

  await expect(page.getByText('Musterstadt, Hauptstraße 12')).toBeVisible();
  await expect(page.getByRole('link', { name: 'iCal abonnieren' })).toBeVisible();

  await page.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeVisible();

  await page.reload();

  await expect(page.getByText('Gespeicherte Adresse geladen. Sie können die Auswahl ändern.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'iCal abonnieren' })).toBeVisible();
});
