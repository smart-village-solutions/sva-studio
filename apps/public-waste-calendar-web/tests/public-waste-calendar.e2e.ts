import { expect, test } from '@playwright/test';

test('resolves a location, restores it from cookie, and exposes accessible export and detail actions', async ({
  page,
}) => {
  await page.route('**/api/public-waste/selection**', async (route) => {
    const url = new URL(route.request().url());

    if (url.searchParams.get('houseNumberId') === '44444444-4444-4444-8444-444444444444') {
      await route.fulfill({
        json: {
          status: 'incomplete',
          step: 'houseNumber',
          options: [],
        },
      });
      return;
    }

    if (url.searchParams.get('streetId') === '33333333-3333-4333-8333-333333333333') {
      await route.fulfill({
        json: {
          status: 'incomplete',
          step: 'houseNumber',
          options: [
            { id: '44444444-4444-4444-8444-444444444444', label: '12' },
            { id: '44444444-4444-4444-8444-444444444445', label: '14' },
          ],
        },
      });
      return;
    }

    if (url.searchParams.get('cityId') === '22222222-2222-4222-8222-222222222222') {
      await route.fulfill({
        json: {
          status: 'incomplete',
          step: 'street',
          options: [
            { id: '33333333-3333-4333-8333-333333333333', label: 'Am alten Hafen' },
            { id: '33333333-3333-4333-8333-333333333334', label: 'Berliner Straße' },
          ],
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        status: 'incomplete',
        step: 'city',
        options: [
          { id: '22222222-2222-4222-8222-222222222222', label: 'Rathenow' },
          { id: '22222222-2222-4222-8222-222222222223', label: 'Premnitz' },
        ],
      },
    });
  });

  await page.route('**/api/public-waste/calendar**', async (route) => {
    await route.fulfill({
      json: {
        locationKey:
          '~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444',
        nextPickupDate: '2026-05-19',
        selectionSummary: 'Rathenow, Am alten Hafen 12',
        pdfLinks: [
          'https://example.invalid/~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444/2025.pdf',
          'https://example.invalid/~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444/2026.pdf',
          'https://example.invalid/~:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444/2027.pdf',
        ],
        icalUrl:
          '/api/public-waste/ical?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&calendarName=Rathenow%2C+Am+alten+Hafen+12',
        listEntries: [
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionColor: '#00AA00',
            note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
          },
        ],
        monthBuckets: [],
        yearBuckets: [],
        fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
      },
    });
  });

  await page.goto('/');

  await page.getByRole('button', { name: 'Rathenow' }).click();
  await page.getByRole('button', { name: 'Am alten Hafen' }).click();
  await page.getByRole('button', { name: '12' }).click();

  await expect(page.getByText('Rathenow, Am alten Hafen 12')).toBeVisible();
  await expect(page.getByRole('link', { name: 'iCal abonnieren' })).toBeVisible();

  await page.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeVisible();

  await page.reload();

  await expect(page.getByText('Gespeicherte Adresse geladen. Sie können die Auswahl ändern.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'iCal abonnieren' })).toBeVisible();
});
