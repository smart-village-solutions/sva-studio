import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const expectNoAccessibilityViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(
    results.violations,
    JSON.stringify(
      results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target),
      })),
      null,
      2
    )
  ).toEqual([]);
};

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

  await expect(page.getByRole('combobox', { name: 'Ort suchen' })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  const cityCombobox = page.getByRole('combobox', { name: 'Ort suchen' });
  await cityCombobox.fill('Rat');
  await cityCombobox.press('ArrowDown');
  await expect(cityCombobox).toHaveAttribute('aria-activedescendant', /option-/u);
  await cityCombobox.press('Enter');
  await page.getByRole('combobox', { name: 'Straße suchen' }).fill('Hafen');
  await page.getByRole('option', { name: 'Am alten Hafen' }).click();
  await page.getByRole('combobox', { name: 'Hausnummer suchen' }).fill('12');
  await page.getByRole('option', { name: '12' }).click();

  await expect(page.getByText('Rathenow')).toBeVisible();
  await expect(page.getByText('Am alten Hafen')).toBeVisible();
  await expect(page.getByText('12')).toBeVisible();
  await expectNoAccessibilityViolations(page);

  const listTab = page.getByRole('tab', { name: 'Liste' });
  await listTab.focus();
  await listTab.press('ArrowRight');
  const monthTab = page.getByRole('tab', { name: 'Monat' });
  await expect(monthTab).toBeFocused();
  await expect(monthTab).toHaveAttribute('aria-selected', 'true');
  await monthTab.press('Home');
  await expect(listTab).toBeFocused();

  const calendarExportAction = page.getByRole('button', { name: 'Kalender exportieren' });
  await expect(calendarExportAction).toHaveAttribute('aria-expanded', 'false');
  await calendarExportAction.click();
  await expect(calendarExportAction).toHaveAttribute('aria-expanded', 'true');
  await expect(calendarExportAction).toHaveCSS('background-color', 'rgb(232, 232, 232)');
  await expect(calendarExportAction).toHaveCSS('box-shadow', 'none');
  await expect(page.getByRole('link', { name: 'Kalender exportieren' })).toBeVisible();

  await page.getByRole('tab', { name: 'Jahr' }).click();
  const pickupButton = page.getByRole('button', { name: 'Termin Bioabfall am 19.05.2026' });
  await pickupButton.click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schließen' })).toBeFocused();
  await expect(page.getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(pickupButton).toBeFocused();

  await page.reload();

  await expect(page.getByText('Rathenow')).toBeVisible();
  await expect(page.getByText('Am alten Hafen')).toBeVisible();
  await expect(page.getByText('12')).toBeVisible();
  await page.getByRole('button', { name: 'Kalender exportieren' }).click();
  await expect(page.getByRole('link', { name: 'Kalender exportieren' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 900 });
  await page.setContent(`
    <main style="max-width: 40rem; margin: 0 auto; padding: 1rem; font-family: sans-serif">
      <h1>Kommunale Service-Seite</h1>
      <p>Ihre Abfuhrtermine:</p>
      <iframe
        title="Abfallkalender"
        src="http://127.0.0.1:3002/"
        style="display: block; width: 100%; height: 700px; border: 0"
      ></iframe>
    </main>
  `);

  const embeddedCalendar = page.frameLocator('iframe[title="Abfallkalender"]');
  await expect(embeddedCalendar.getByText('Rathenow')).toBeVisible();
  await expect(embeddedCalendar.getByRole('button', { name: 'Adresse ändern' })).toBeVisible();
  await expect(
    embeddedCalendar.getByRole('button', { name: 'Kalender exportieren' })
  ).toBeVisible();
  await embeddedCalendar.getByRole('button', { name: 'Informationen zu Abfallfraktionen' }).click();
  await expect(
    embeddedCalendar.getByText(
      'Diese Auswahl steuert Liste, Kalenderexport, PDF/Druckversion und E-Mail-Erinnerung gemeinsam.'
    )
  ).toBeVisible();

  await expect
    .poll(() =>
      embeddedCalendar
        .locator('html')
        .evaluate((element) => element.scrollWidth <= element.clientWidth)
    )
    .toBe(true);
  await expect
    .poll(() =>
      embeddedCalendar
        .locator('body')
        .evaluate((element) => getComputedStyle(element).backgroundColor)
    )
    .toBe('rgba(0, 0, 0, 0)');
  await expect
    .poll(() =>
      embeddedCalendar.locator('.selection-header').evaluate((element) => ({
        borderBottomWidth: getComputedStyle(element).borderBottomWidth,
        borderRadius: getComputedStyle(element).borderRadius,
        borderTopWidth: getComputedStyle(element).borderTopWidth,
      }))
    )
    .toEqual({ borderBottomWidth: '0px', borderRadius: '0px', borderTopWidth: '0px' });
  await expect
    .poll(() =>
      embeddedCalendar.locator('.action-hub-toolbar').evaluate((element) => ({
        paddingBottom: getComputedStyle(element).paddingBottom,
        paddingTop: getComputedStyle(element).paddingTop,
      }))
    )
    .toEqual({ paddingBottom: '20px', paddingTop: '20px' });
  await expect
    .poll(() =>
      embeddedCalendar
        .locator('.action-hub')
        .evaluate((element) => getComputedStyle(element).borderBottomWidth)
    )
    .toBe('0px');
});

test('keeps an iframe calendar bound to its URL region across repeated address searches and exports', async ({
  page,
}) => {
  const regionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const cityId = '22222222-2222-4222-8222-222222222222';
  const streetId = '33333333-3333-4333-8333-333333333333';
  const houseNumberId = '44444444-4444-4444-8444-444444444444';

  await page.route('**/api/public-waste/selection**', async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('regionId')).toBe(regionId);

    if (url.searchParams.get('houseNumberId') === houseNumberId) {
      await route.fulfill({ json: { status: 'incomplete', step: 'houseNumber', options: [] } });
      return;
    }
    if (url.searchParams.get('streetId') === streetId) {
      await route.fulfill({
        json: {
          status: 'incomplete',
          step: 'houseNumber',
          options: [
            { id: houseNumberId, label: '12' },
            { id: '44444444-4444-4444-8444-444444444445', label: '14' },
          ],
        },
      });
      return;
    }
    if (url.searchParams.get('cityId') === cityId) {
      await route.fulfill({
        json: {
          status: 'incomplete',
          step: 'street',
          options: [
            { id: streetId, label: 'Am alten Hafen' },
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
          { id: cityId, label: 'Rathenow' },
          { id: '22222222-2222-4222-8222-222222222223', label: 'Premnitz' },
        ],
      },
    });
  });

  await page.route('**/api/public-waste/calendar**', async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('regionId')).toBe(regionId);
    await route.fulfill({
      json: {
        locationKey: `${regionId}:${cityId}:${streetId}:${houseNumberId}`,
        nextPickupDate: '2026-05-19',
        selectionSummary: 'Rathenow, Am alten Hafen 12',
        icalUrl: `/api/public-waste/ical?regionId=${regionId}&cityId=${cityId}&streetId=${streetId}&houseNumberId=${houseNumberId}`,
        listEntries: [],
        monthBuckets: [],
        yearBuckets: [],
        fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
        reminderSignup: {
          enabled: true,
          consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
          privacyPolicyUrl: 'https://example.invalid/datenschutz',
          fractions: [
            {
              id: 'bio',
              label: 'Bioabfall',
              slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
            },
          ],
        },
      },
    });
  });

  await page.route('**/api/public-waste/pdf**', async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('regionId')).toBe(regionId);
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'content-disposition': 'attachment; filename="abfallkalender.pdf"' },
      body: '%PDF-1.4',
    });
  });

  await page.route('**/api/public-waste/reminder-signups', async (route) => {
    const body = route.request().postDataJSON() as {
      readonly selection?: { readonly regionId?: string };
    };
    expect(body.selection?.regionId).toBe(regionId);
    await route.fulfill({
      json: {
        status: 'pending',
        headline: 'Bestätigungslink versendet',
        message: 'Bitte prüfen Sie Ihr E-Mail-Postfach.',
      },
    });
  });

  await page.goto(`/?regionId=${regionId}`);

  const selectAddress = async () => {
    await expect(page.getByRole('combobox', { name: 'Ort suchen' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Region suchen' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Ort suchen' }).fill('Rat');
    await page.getByRole('option', { name: 'Rathenow' }).click();
    await page.getByRole('combobox', { name: 'Straße suchen' }).fill('Hafen');
    await page.getByRole('option', { name: 'Am alten Hafen' }).click();
    await page.getByRole('combobox', { name: 'Hausnummer suchen' }).fill('12');
    await page.getByRole('option', { name: '12' }).click();
    await expect(page.getByRole('button', { name: 'Adresse ändern' })).toBeVisible();
  };

  await selectAddress();
  await page.getByRole('button', { name: 'Adresse ändern' }).click();
  await selectAddress();

  await page.getByRole('button', { name: 'Kalender exportieren' }).click();
  await expect(page.getByRole('link', { name: 'Kalender exportieren' })).toHaveAttribute(
    'href',
    new RegExp(`regionId=${regionId}`, 'u')
  );

  await page.getByRole('button', { name: 'PDF / Druckversion' }).click();
  const pdfRequest = page.waitForRequest('**/api/public-waste/pdf**');
  await page.getByRole('button', { name: 'PDF herunterladen' }).click();
  await expect(pdfRequest).resolves.toBeTruthy();

  await page.getByRole('button', { name: 'E-Mail-Erinnerung' }).click();
  await page.getByRole('textbox', { name: 'E-Mail-Adresse' }).fill('person@example.test');
  await page.getByRole('checkbox', { name: 'Ich stimme der Verarbeitung' }).check();
  const reminderRequest = page.waitForRequest('**/api/public-waste/reminder-signups');
  await page.getByRole('button', { name: 'E-Mail-Erinnerung anfordern' }).click();
  await expect(reminderRequest).resolves.toBeTruthy();
  await expect(page.getByText('Bestätigungslink versendet')).toBeVisible();
});

test('rejects a malformed URL region without starting an unfiltered selection', async ({
  page,
}) => {
  let selectionRequestCount = 0;
  await page.route('**/api/public-waste/selection**', async (route) => {
    selectionRequestCount += 1;
    await route.abort();
  });

  await page.goto('/?regionId=not-a-uuid');

  await expect(page.getByRole('alert')).toContainText('Die angegebene Region ist ungültig');
  expect(selectionRequestCount).toBe(0);
});
