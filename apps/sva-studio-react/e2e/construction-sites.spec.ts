import { expect, test } from '@playwright/test';
import {
  gotoHomeAsAuthenticatedUser,
  mockSharedShellRequests,
  navigateClientSide,
} from './news-plugin.fixtures';
import type { ConstructionSiteRecord } from '@sva/plugin-construction-sites';

test.use({
  storageState: { cookies: [], origins: [] },
  launchOptions: { args: ['--enable-unsafe-swiftshader'] },
});
test('draws and edits construction site geometry and roundtrips the existing record', async ({
  page,
}) => {
  test.slow();
  await mockSharedShellRequests(page);
  let mapUnavailable = false;
  let readOnly = false;
  await page.route('**/api/v1/iam/map-geocoding/config', (route) =>
    route.fulfill({
      json: {
        provider: 'geoapify',
        styleUrl: new URL('/__construction-map-style.json', route.request().url()).toString(),
        autocompleteEnabled: false,
        geocodeEnabled: false,
        reverseGeocodeEnabled: false,
        killSwitchEnabled: mapUnavailable,
      },
    })
  );
  await page.route('**/__construction-map-style.json', (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#eeeeee' } },
        ],
      },
    })
  );
  const actions = ['read', 'create', 'update'].map((action) => `construction-sites.${action}`);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'kc-editor-1',
          name: 'Editor One',
          email: 'editor@example.com',
          instanceId: 'de-musterhausen',
          assignedModules: ['construction-sites'],
          roles: ['editor'],
          permissionActions: readOnly ? ['construction-sites.read'] : actions,
        },
      },
    })
  );
  await page.route('**/iam/me/permissions?**', (route) =>
    route.fulfill({
      json: {
        instanceId: 'de-musterhausen',
        permissions: (readOnly ? ['construction-sites.read'] : actions).map((action) => ({
          action,
          resourceType: 'construction-sites',
        })),
        subject: {
          actorUserId: 'kc-editor-1',
          effectiveUserId: 'kc-editor-1',
          isImpersonating: false,
        },
        evaluatedAt: '2026-11-01T12:00:00Z',
      },
    })
  );
  await page.route('**/api/v1/mainserver/categories?**', (route) =>
    route.fulfill({ json: { data: [{ id: '1', name: 'Verkehr' }] } })
  );
  let saved: ConstructionSiteRecord | undefined;
  let creates = 0;
  let updates = 0;
  await page.route('**/api/v1/mainserver/construction-sites**', async (route) => {
    const method = route.request().method();
    expect(route.request().headers()['x-sva-acting-principal-type']).toBe('user');
    if (method === 'POST' || method === 'PATCH') {
      const body = route.request().postDataJSON() as {
        site: ConstructionSiteRecord['input'];
        baseFingerprint?: string;
      };
      if (method === 'POST') creates++;
      else {
        updates++;
        expect(body.baseFingerprint).toBe('a'.repeat(64));
      }
      saved = {
        id: '42',
        genericType: 'ConstructionSite',
        title: body.site.title,
        visible: body.site.visible,
        input: body.site,
        updatedAt: '2026-11-01T12:00:00Z',
        contentFingerprint: 'a'.repeat(64),
        dataProvider: { id: 'provider-user', name: 'Editor One' },
      };
      return route.fulfill({ status: method === 'POST' ? 201 : 200, json: { data: saved } });
    }
    return route.fulfill({
      headers: { 'X-SVA-Context-Binding': 'v1.loaded-context' },
      json:
        saved && new URL(route.request().url()).pathname.endsWith('/42')
          ? {
              data: saved,
              meta: {
                access: { 'construction-sites.read': true, 'construction-sites.update': !readOnly },
              },
            }
          : {
              data: saved ? [saved] : [],
              pagination: { page: 1, pageSize: 25, hasNextPage: false, total: saved ? 1 : 0 },
            },
    });
  });
  await gotoHomeAsAuthenticatedUser(page);
  await navigateClientSide(page, '/admin/construction-sites/new');
  await expect(page.getByRole('heading', { name: 'Baustelle anlegen', exact: true })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await page.locator('#cs-title').fill('Brückenbau');
  await page.locator('#cs-dates-0-dateEnd').fill('2026-12-20');
  await page.locator('#cs-dates-0-dateStart').fill('2026-11-15');
  await expect(page.locator('#cs-dates-0-dateEnd')).toHaveValue('2026-12-20');
  await expect(page.getByRole('button', { name: 'Strecke zeichnen', exact: true })).toBeEnabled({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Standort setzen', exact: true }).click();
  const locationCanvas = page.getByRole('region', { name: 'Baustellenkarte' }).locator('canvas');
  await locationCanvas.click({ position: { x: 70, y: 50 } });
  await expect(page.locator('#cs-locations-0-latitude')).not.toHaveValue('');
  const primaryLatitude = await page.locator('#cs-locations-0-latitude').inputValue();
  await page.getByRole('button', { name: 'Strecke zeichnen', exact: true }).click();
  const canvas = page.getByRole('region', { name: 'Baustellenkarte' }).locator('canvas');
  await canvas.click({ position: { x: 120, y: 100 } });
  await expect(page.getByRole('button', { name: 'Baustelle anlegen', exact: true })).toBeDisabled();
  await canvas.click({ position: { x: 260, y: 160 } });
  await page.keyboard.press('Enter');
  const line = page.getByRole('group', { name: 'Strecke 1', exact: true });
  await expect(line).toBeVisible();
  const latitudeBeforeDrag = await line
    .getByLabel('Punkt 2: Breitengrad', { exact: true })
    .inputValue();
  await canvas.click({ position: { x: 190, y: 130 } });
  await expect(
    page.getByRole('button', { name: 'Ausgewählte Form löschen', exact: true })
  ).toBeEnabled();
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error('missing map canvas');
  await page.mouse.move(canvasBounds.x + 260, canvasBounds.y + 160);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + 280, canvasBounds.y + 180, { steps: 5 });
  await page.mouse.up();
  // Selecting the midpoint inserts point 2; the original endpoint is now point 3.
  await expect(line.getByLabel('Punkt 3: Breitengrad', { exact: true })).not.toHaveValue(
    latitudeBeforeDrag
  );
  await page.getByRole('button', { name: 'Fläche zeichnen', exact: true }).click();
  await canvas.click({ position: { x: 340, y: 80 } });
  await canvas.click({ position: { x: 440, y: 80 } });
  await canvas.click({ position: { x: 390, y: 200 } });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'Fläche 2', exact: true })).toBeVisible();
  await page
    .getByRole('group', { name: 'Kartenwerkzeuge', exact: true })
    .getByRole('button', { name: 'Rückgängig', exact: true })
    .click();
  await expect(page.getByRole('group', { name: 'Fläche 2', exact: true })).toHaveCount(0);
  await page
    .getByRole('group', { name: 'Kartenwerkzeuge', exact: true })
    .getByRole('button', { name: 'Wiederholen', exact: true })
    .click();
  await page.getByRole('button', { name: 'Fläche 2 auswählen', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Fläche 2', exact: true })).toBeVisible();
  await canvas.screenshot({ path: test.info().outputPath('construction-geometry-map.png') });
  await page.getByRole('button', { name: 'Strecke 1 auswählen', exact: true }).click();
  await line.getByLabel('Punkt 2: Längengrad', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Strecke zeichnen', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Fläche 2 auswählen', exact: true }).click();
  await page.getByRole('button', { name: 'Strecke 1 auswählen', exact: true }).click();
  await expect(line.getByLabel('Punkt 2: Längengrad', { exact: true })).toHaveValue('');
  await line.getByLabel('Punkt 2: Längengrad', { exact: true }).fill('13.501');
  await page.screenshot({
    path: test.info().outputPath('construction-site-create-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: test.info().outputPath('construction-site-create-mobile.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Baustelle anlegen', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Gespeicherte Baustelle öffnen' })).toBeVisible();
  expect(creates).toBe(1);
  expect(saved?.visible).toBe(false);
  expect(saved?.input.locations[0]?.latitude).toBe(Number(primaryLatitude));
  expect(saved?.input.geometry?.features.map((f) => f.geometry.type)).toEqual([
    'LineString',
    'Polygon',
  ]);
  expect(saved?.input.geometry?.features[0]?.geometry.coordinates[1]).toEqual(
    expect.arrayContaining([13.501])
  );
  await page.getByRole('link', { name: 'Gespeicherte Baustelle öffnen' }).click();
  await expect(page.locator('#cs-title')).toHaveValue('Brückenbau');
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Strecke 1', exact: true })).toBeVisible();
  await page
    .getByRole('group', { name: 'Strecke 1', exact: true })
    .getByLabel('Punkt 2: Längengrad', { exact: true })
    .fill('13.502');
  const geometryTools = page.getByRole('group', { name: 'Kartenwerkzeuge', exact: true });
  await geometryTools.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Strecke 1', exact: true })
      .getByLabel('Punkt 2: Längengrad', { exact: true })
  ).toHaveValue('13.501');
  await geometryTools.getByRole('button', { name: 'Wiederholen', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Strecke 1', exact: true })
      .getByLabel('Punkt 2: Längengrad', { exact: true })
  ).toHaveValue('13.502');

  await page.getByRole('button', { name: 'Fläche 2 auswählen', exact: true }).click();
  await page
    .getByRole('group', { name: 'Fläche 2', exact: true })
    .getByRole('button', { name: 'Form löschen', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Basis', exact: true }).click();
  await page.locator('#cs-dates-0-dateEnd').fill('2026-12-30');
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByText('Die Baustelle wurde gespeichert.', { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('construction-site-edit.png'),
    fullPage: true,
  });
  expect(creates).toBe(1);
  expect(updates).toBe(1);
  expect(saved?.input.dates[0]?.dateEnd).toBe('2026-12-30');
  expect(saved?.input.geometry?.features).toHaveLength(1);
  expect(saved?.input.geometry?.features[0]?.geometry.coordinates[1]).toEqual(
    expect.arrayContaining([13.502])
  );
  // The same form remains usable without a map connection.
  mapUnavailable = true;
  await page.reload();
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await expect(
    page.getByText(
      'Die Karte ist derzeit nicht verfügbar. Sie können die Koordinaten weiterhin eingeben.',
      { exact: true }
    )
  ).toBeVisible();
  await page
    .getByRole('group', { name: 'Strecke 1', exact: true })
    .getByLabel('Punkt 2: Längengrad', { exact: true })
    .fill('13.503');
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByText('Die Baustelle wurde gespeichert.', { exact: true })).toBeVisible();
  expect(updates).toBe(2);
  expect(saved?.input.locations[0]?.latitude).toBe(Number(primaryLatitude));
  mapUnavailable = false;
  readOnly = true;
  await page.reload();
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Baustellenkarte' }).locator('canvas')
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Kartenwerkzeuge', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Form löschen', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Änderungen speichern', exact: true })).toHaveCount(
    0
  );
  await page.screenshot({
    path: test.info().outputPath('construction-site-read-only.png'),
    fullPage: true,
  });
  readOnly = false;
  await page.reload();
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Strecke zeichnen', exact: true })).toBeEnabled();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({
    path: test.info().outputPath('construction-site-edit-dark.png'),
    fullPage: true,
  });
  await page
    .getByRole('group', { name: 'Strecke 1', exact: true })
    .getByRole('button', { name: 'Form löschen', exact: true })
    .click();
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByText('Die Baustelle wurde gespeichert.', { exact: true })).toBeVisible();
  expect(saved?.input.geometry).toBeNull();
  expect(updates).toBe(3);
  await page.reload();
  await page.getByRole('tab', { name: 'Inhalt', exact: true }).click();
  await expect(
    page.getByText(
      'Noch keine Strecke oder Fläche vorhanden. Zeichnen Sie auf der Karte oder erfassen Sie die Koordinaten.',
      { exact: true }
    )
  ).toBeVisible();
  await page.getByRole('link', { name: 'Zur Übersicht', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\?.*type=construction-sites/);
  await expect(page.getByRole('heading', { name: 'Baustellen', exact: true })).toBeVisible();
  await expect(page.getByText('Brückenbau', { exact: true }).first()).toBeVisible();
  const filtered = page.waitForRequest(
    (request) =>
      request.url().includes('/mainserver/construction-sites?') &&
      new URL(request.url()).searchParams.get('search') === 'Brücke'
  );
  await page.getByLabel('Titel suchen').fill('Brücke');
  await filtered;
  await expect(page.getByLabel('Titel suchen')).toHaveValue('Brücke');
});
