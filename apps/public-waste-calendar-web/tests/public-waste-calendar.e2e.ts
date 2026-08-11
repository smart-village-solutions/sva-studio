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

  const pickupButton = page.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' });
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
