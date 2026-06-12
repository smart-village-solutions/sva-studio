import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { gotoHomeAsAuthenticatedUser, gotoShellRoot } from './studio-shell.helpers';

type EventRecord = {
  readonly id: string;
  title: string;
  readonly contentType: 'events.event-record';
  readonly status: 'published';
  readonly createdAt: string;
  updatedAt: string;
  description?: string;
  categoryName?: string;
  dates?: readonly { readonly dateStart?: string; readonly dateEnd?: string }[];
  addresses?: readonly { readonly street?: string; readonly city?: string }[];
  contact?: { readonly email?: string };
  urls?: readonly { readonly url: string; readonly description?: string }[];
  pointOfInterestId?: string;
  repeat?: boolean;
};

type PoiRecord = {
  readonly id: string;
  name: string;
  readonly contentType: 'poi.point-of-interest';
  readonly status: 'published';
  readonly createdAt: string;
  updatedAt: string;
  description?: string;
  mobileDescription?: string;
  active?: boolean;
  categoryName?: string;
  addresses?: readonly { readonly street?: string; readonly city?: string }[];
  contact?: { readonly email?: string };
  openingHours?: readonly { readonly weekday?: string; readonly timeFrom?: string; readonly open?: boolean }[];
  webUrls?: readonly { readonly url: string; readonly description?: string }[];
  payload?: Record<string, unknown>;
};

const authenticatedUser = {
  user: {
    id: 'kc-editor-1',
    name: 'Editor One',
    email: 'editor@example.com',
    instanceId: 'de-musterhausen',
    assignedModules: ['events', 'poi'],
    roles: ['editor'],
    permissionActions: [
      'events.read',
      'events.create',
      'events.update',
      'events.delete',
      'poi.read',
      'poi.create',
      'poi.update',
      'poi.delete',
    ],
  },
};
const permissionPayload = {
  instanceId: 'de-musterhausen',
  permissions: [
    { action: 'events.read', resourceType: 'events' },
    { action: 'events.create', resourceType: 'events' },
    { action: 'events.update', resourceType: 'events' },
    { action: 'events.delete', resourceType: 'events' },
    { action: 'poi.read', resourceType: 'poi' },
    { action: 'poi.create', resourceType: 'poi' },
    { action: 'poi.update', resourceType: 'poi' },
    { action: 'poi.delete', resourceType: 'poi' },
  ],
  subject: {
    actorUserId: 'kc-editor-1',
    effectiveUserId: 'kc-editor-1',
    isImpersonating: false,
  },
  evaluatedAt: '2026-04-13T12:00:00.000Z',
};

const navigateClientSide = async (page: Page, targetPath: string) => {
  await page.waitForFunction(() => {
    return Boolean(
      (
        window as typeof window & {
          __SVA_PLAYWRIGHT_ROUTER__?: {
            navigate: (options: { to: string }) => Promise<void> | void;
          };
        }
      ).__SVA_PLAYWRIGHT_ROUTER__
    );
  });

  await page.evaluate(async (path) => {
    const router = (
      window as typeof window & {
        __SVA_PLAYWRIGHT_ROUTER__?: {
          navigate: (options: { to: string }) => Promise<void> | void;
        };
      }
    ).__SVA_PLAYWRIGHT_ROUTER__;

    if (!router) {
      throw new Error('Playwright router hook fehlt.');
    }

    await router.navigate({ to: path });
  }, targetPath);
};

const expectPluginPageHeading = async (page: Page, pattern: RegExp) => {
  await Promise.any([
    page.locator('main h1').filter({ hasText: pattern }).waitFor({ state: 'visible' }),
    page
      .getByRole('navigation', { name: /Brotkrumen-Navigation/ })
      .getByText(pattern)
      .waitFor({ state: 'visible' }),
  ]);
};

const expectEventOrPoiEditorReady = async (page: Page, path: '/admin/events/new' | '/admin/poi/new') => {
  if (path === '/admin/events/new') {
    await expectPluginPageHeading(page, /Event anlegen|events\.detail\.createTitle|events\.editor\.createTitle/);
    await expect(page.locator('#event-title')).toBeVisible();
    return;
  }

  await expectPluginPageHeading(page, /POI anlegen|poi\.detail\.createTitle|poi\.editor\.createTitle/);
  await expect(page.locator('#poi-name')).toBeVisible();
};

const expectContentOverviewUrl = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
};

const expectContentOverviewReady = async (page: Page) => {
  await expectContentOverviewUrl(page);
  await expect(page.locator('#main-content')).toBeVisible();
  await Promise.any([
    page
      .getByRole('heading', {
        name: /Inhalte|Inhaltsliste|content\.page\.title|content\.table\.sectionTitle/,
      })
      .first()
      .waitFor({ state: 'visible' }),
    page.getByRole('button', { name: /Neuer Inhalt|content\.actions\.create/ }).waitFor({ state: 'visible' }),
    page.getByRole('link', { name: /Neuer Inhalt|content\.actions\.create/ }).waitFor({ state: 'visible' }),
    page.getByRole('table', { name: /Inhalte|content\.table\.ariaLabel/ }).waitFor({ state: 'visible' }),
    page.getByText(/Noch keine Inhalte vorhanden|content\.empty\.title/).waitFor({ state: 'visible' }),
  ]);
};

const expectCreateContentActionReady = async (page: Page) => {
  await expect(page.getByRole('link', { name: /Neuer Inhalt|content\.actions\.create/ })).toBeVisible();
};

const expectLoginRedirect = async (page: Page, returnToPattern: RegExp) => {
  await page.waitForFunction(() => {
    const { pathname, search } = window.location;
    return (
      pathname === '/' ||
      pathname === '/auth/login' ||
      search.startsWith('?auth=login&returnTo=') ||
      search.startsWith('?auth=dev-login&returnTo=') ||
      search.startsWith('?auth=mock-login&returnTo=')
    );
  });

  const loginUrl = new URL(page.url());
  if (loginUrl.pathname === '/') {
    return;
  }

  await expect(page).toHaveURL(/\/(?:\?auth=(?:login|dev-login|mock-login)&returnTo=|auth\/login\?returnTo=)/);
  const authMode = loginUrl.searchParams.get('auth');
  expect(authMode === 'login' || authMode === 'dev-login' || authMode === 'mock-login' || authMode === null).toBe(true);
  expect(loginUrl.searchParams.get('returnTo')).toMatch(returnToPattern);
};

const mockSharedShellRequests = async (page: Page) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authenticatedUser) });
  });

  await page.route('**/iam/me/permissions?**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(permissionPayload) });
  });

  await page.route('**/iam/authorize', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true, reason: 'mocked_authorize' }),
    });
  });

  await page.route('**/iam/me/legal-texts/pending', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 0, total: 0 } }),
    });
  });

  await page.route('**/api/v1/iam/me/context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { activeOrganizationId: null, organizations: [] } }),
    });
  });

  await page.route('**/api/v1/iam/media**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/v1/iam/media/references' && request.method() === 'PUT') {
      const body = request.postDataJSON() as {
        targetType?: string;
        targetId?: string;
        references?: unknown[];
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            targetType: body.targetType ?? '',
            targetId: body.targetId ?? '',
            references: Array.isArray(body.references) ? body.references : [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
};

const createdAt = '2026-04-13T12:10:00.000Z';
const createPagination = (total: number) => ({
  page: 1,
  pageSize: 25,
  hasNextPage: false,
  total,
});

const mapEventToUnifiedContent = (events: readonly EventRecord[]) =>
  events.map((item) => ({
    id: item.id,
    contentType: item.contentType,
    title: item.title,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.dates?.[0]?.dateStart,
    access: {
      state: 'editable',
      canRead: true,
      canCreate: true,
      canUpdate: true,
      organizationIds: ['org-1'],
      sourceKinds: ['direct_role'],
    },
  }));

const mapPoiToUnifiedContent = (pois: readonly PoiRecord[]) =>
  pois.map((item) => ({
    id: item.id,
    contentType: item.contentType,
    title: item.name,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    access: {
      state: 'editable',
      canRead: true,
      canCreate: true,
      canUpdate: true,
      organizationIds: ['org-1'],
      sourceKinds: ['direct_role'],
    },
  }));

const routeUnifiedContentOverview = async (
  page: Page,
  getEvents: () => readonly EventRecord[],
  getPois: () => readonly PoiRecord[]
) => {
  await page.route('**/api/v1/iam/contents**', async (route) => {
    const items = [...mapEventToUnifiedContent(getEvents()), ...mapPoiToUnifiedContent(getPois())];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: items,
        pagination: createPagination(items.length),
      }),
    });
  });
  await page.route('**/api/v1/mainserver/news**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], pagination: createPagination(0) }),
    });
  });
};

const createA11yEvents = (): EventRecord[] => [
  {
    id: 'event-1',
    title: 'A11y Event',
    contentType: 'events.event-record',
    status: 'published',
    createdAt,
    updatedAt: createdAt,
    dates: [{ dateStart: '2026-04-14T09:30:00.000Z' }],
  },
];

const createA11yPois = (): PoiRecord[] => [
  {
    id: 'poi-1',
    name: 'A11y POI',
    contentType: 'poi.point-of-interest',
    status: 'published',
    createdAt,
    updatedAt: createdAt,
    active: true,
  },
];

const prepareEventAndPoiA11yViews = async (page: Page) => {
  const events = createA11yEvents();
  const pois = createA11yPois();

  await page.route('**/api/v1/mainserver/events**', async (route) => {
    await routeEvents(route, events);
  });
  await page.route('**/api/v1/mainserver/poi**', async (route) => {
    await routePoi(route, pois);
  });
  await routeUnifiedContentOverview(page, () => events, () => pois);

  await gotoHomeAsAuthenticatedUser(page);
};

const expectNoSeriousAccessibilityViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(result.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);
};

const routeEvents = async (route: Route, events: EventRecord[]) => {
  const request = route.request();
  const method = request.method();
  const path = new URL(request.url()).pathname;

  if (path === '/api/v1/mainserver/events' || path === '/api/v1/mainserver/events/') {
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: events, pagination: createPagination(events.length) }),
      });
      return;
    }
    if (method === 'POST') {
      const body = request.postDataJSON() as Partial<EventRecord>;
      const item: EventRecord = {
        id: 'event-1',
        title: String(body.title),
        contentType: 'events.event-record',
        status: 'published',
        createdAt,
        updatedAt: createdAt,
        description: body.description,
        categoryName: body.categoryName,
        dates: body.dates,
        addresses: body.addresses,
        contact: body.contact,
        urls: body.urls,
        pointOfInterestId: body.pointOfInterestId,
        repeat: body.repeat,
      };
      events.push(item);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: item }) });
      return;
    }
  }

  const detailMatch = path.match(/^\/api\/v1\/mainserver\/events\/([^/]+)\/?$/);
  if (!detailMatch) {
    await route.fallback();
    return;
  }

  const item = events.find((entry) => entry.id === detailMatch[1]);
  if (method === 'GET') {
    await route.fulfill({
      status: item ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(item ? { data: item } : { error: 'not_found' }),
    });
    return;
  }

  if (method === 'PATCH' && item) {
    const body = request.postDataJSON() as Partial<EventRecord>;
    item.title = String(body.title ?? item.title);
    item.categoryName = body.categoryName ?? item.categoryName;
    item.updatedAt = '2026-04-13T12:20:00.000Z';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: item }) });
    return;
  }

  if (method === 'DELETE') {
    const index = events.findIndex((entry) => entry.id === detailMatch[1]);
    if (index >= 0) {
      events.splice(index, 1);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: detailMatch[1] } }) });
    return;
  }

  await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
};

const routePoi = async (route: Route, pois: PoiRecord[]) => {
  const request = route.request();
  const method = request.method();
  const path = new URL(request.url()).pathname;

  if (path === '/api/v1/mainserver/poi' || path === '/api/v1/mainserver/poi/') {
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: pois, pagination: createPagination(pois.length) }),
      });
      return;
    }
    if (method === 'POST') {
      const body = request.postDataJSON() as Partial<PoiRecord>;
      const item: PoiRecord = {
        id: 'poi-1',
        name: String(body.name),
        contentType: 'poi.point-of-interest',
        status: 'published',
        createdAt,
        updatedAt: createdAt,
        description: body.description,
        mobileDescription: body.mobileDescription,
        active: body.active,
        categoryName: body.categoryName,
        addresses: body.addresses,
        contact: body.contact,
        openingHours: body.openingHours,
        webUrls: body.webUrls,
        payload: body.payload,
      };
      pois.push(item);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: item }) });
      return;
    }
  }

  const detailMatch = path.match(/^\/api\/v1\/mainserver\/poi\/([^/]+)\/?$/);
  if (!detailMatch) {
    await route.fallback();
    return;
  }

  const item = pois.find((entry) => entry.id === detailMatch[1]);
  if (method === 'GET') {
    await route.fulfill({
      status: item ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(item ? { data: item } : { error: 'not_found' }),
    });
    return;
  }

  if (method === 'PATCH' && item) {
    const body = request.postDataJSON() as Partial<PoiRecord>;
    item.name = String(body.name ?? item.name);
    item.categoryName = body.categoryName ?? item.categoryName;
    item.updatedAt = '2026-04-13T12:20:00.000Z';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: item }) });
    return;
  }

  if (method === 'DELETE') {
    const index = pois.findIndex((entry) => entry.id === detailMatch[1]);
    if (index >= 0) {
      pois.splice(index, 1);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: detailMatch[1] } }) });
    return;
  }

  await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
};

test.describe('events and POI plugins', () => {
  test.beforeEach(async ({ page }) => {
    await mockSharedShellRequests(page);
  });

  test('supports POI CRUD including delete', async ({ page }) => {
    const pois: PoiRecord[] = [];
    const events: EventRecord[] = [];

    await page.route(/\/api\/v1\/mainserver\/events(?:\/.*)?(?:\?.*)?$/, async (route) => {
      await routeEvents(route, events);
    });
    await page.route(/\/api\/v1\/mainserver\/poi(?:\/.*)?(?:\?.*)?$/, async (route) => {
      await routePoi(route, pois);
    });
    await routeUnifiedContentOverview(page, () => events, () => pois);

    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);
    await expectCreateContentActionReady(page);

    await navigateClientSide(page, '/admin/poi/new');
    await expect(page).toHaveURL(/\/admin\/poi\/new$/);
    await expectPluginPageHeading(page, /POI anlegen|poi\.detail\.createTitle|poi\.editor\.createTitle/);

    await page.locator('#poi-name').fill('Rathaus');
    await page.locator('#poi-category').fill('Verwaltung');
    await page.getByRole('tab', { name: /Inhalt|poi\.detailTabs\.content\.title/ }).click();
    await page.locator('#poi-description').fill('Zentraler Servicepunkt');
    await page.locator('#poi-mobile-description').fill('Servicepunkt');
    await page.locator('#poi-street').fill('Marktplatz 1');
    await page.locator('#poi-city').fill('Musterhausen');
    await page.locator('#poi-email').fill('rathaus@example.com');
    await page.locator('#poi-url').fill('https://example.com/poi');
    await page.locator('#poi-weekday').fill('Montag');
    await page.locator('#poi-time-from').fill('09:00');
    await page.locator('#poi-payload').fill('{"source":"e2e"}');
    await page.getByRole('button', { name: /Speichern|poi\.actions\.save/ }).click();

    await expect(page).toHaveURL(/\/admin\/poi\/poi-1$/);
    await expectPluginPageHeading(page, /POI bearbeiten|poi\.detail\.editTitle|poi\.editor\.editTitle/);

    await page.getByRole('tab', { name: /Basis|poi\.detailTabs\.basis\.title/ }).click();
    await page.locator('#poi-name').fill('Rathaus aktualisiert');
    await page.getByRole('button', { name: /Speichern|poi\.actions\.save/ }).click();
    await expect(page.getByRole('status')).toContainText(/gespeichert|aktualisiert|poi\.messages\.updateSuccess/);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Löschen|poi\.actions\.delete/ }).click();

    await expectContentOverviewReady(page);
    await expect(page.getByText(/Noch keine Inhalte vorhanden|content\.empty\.title/)).toBeVisible();
  });

  test('supports event CRUD with POI selection including delete', async ({ page }) => {
    test.setTimeout(60_000);

    const events: EventRecord[] = [];
    const pois: PoiRecord[] = [
      {
        id: 'poi-1',
        name: 'Rathaus',
        contentType: 'poi.point-of-interest',
        status: 'published',
        createdAt,
        updatedAt: createdAt,
        active: true,
      },
    ];

    await page.route(/\/api\/v1\/mainserver\/events(?:\/.*)?(?:\?.*)?$/, async (route) => {
      await routeEvents(route, events);
    });
    await page.route(/\/api\/v1\/mainserver\/poi(?:\/.*)?(?:\?.*)?$/, async (route) => {
      await routePoi(route, pois);
    });
    await routeUnifiedContentOverview(page, () => events, () => pois);

    await gotoHomeAsAuthenticatedUser(page);
    await navigateClientSide(page, '/admin/content');
    await expectContentOverviewReady(page);
    await expectCreateContentActionReady(page);

    await navigateClientSide(page, '/admin/events/new');
    await expect(page).toHaveURL(/\/admin\/events\/new$/);
    await expectEventOrPoiEditorReady(page, '/admin/events/new');

    await page.locator('#event-title').fill('Stadtfest');
    await page.locator('#event-category').fill('Kultur');
    await page.getByRole('tab', { name: /Inhalt|events\.detailTabs\.content\.title/ }).click();
    await page.locator('#event-description').fill('Sommerfest in der Innenstadt');
    await page.locator('#event-date-start').fill('2026-04-14T09:30');
    await page.locator('#event-street').fill('Marktplatz');
    await page.locator('#event-city').fill('Musterhausen');
    await page.locator('#event-email').fill('events@example.com');
    await page.locator('#event-url').fill('https://example.com/event');
    await page.locator('#event-poi').selectOption('poi-1');
    await page.getByRole('button', { name: /Speichern|events\.actions\.save/ }).click();

    await expect(page).toHaveURL(/\/admin\/events\/event-1$/);
    await expectPluginPageHeading(page, /Event bearbeiten|events\.detail\.editTitle|events\.editor\.editTitle/);

    await page.getByRole('tab', { name: /Basis|events\.detailTabs\.basis\.title/ }).click();
    await page.locator('#event-title').fill('Stadtfest aktualisiert');
    await page.getByRole('button', { name: /Speichern|events\.actions\.save/ }).click();
    await expect(page.getByRole('status')).toContainText(/gespeichert|aktualisiert|events\.messages\.updateSuccess/);

    const deleteResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'DELETE' &&
        response.url().includes('/api/v1/mainserver/events/event-1') &&
        response.status() === 200
      );
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Löschen|events\.actions\.delete/ }).click();
    await deleteResponsePromise;
    await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);

    await expectContentOverviewReady(page);
    await expect(page.locator('main table').getByText('Rathaus')).toBeVisible();
  });

  test('redirects unauthenticated content overview access to login', async ({ page }) => {
    await page.unroute('**/auth/me');
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) });
    });
    await gotoShellRoot(page);
    await navigateClientSide(page, '/admin/content');
    await expectLoginRedirect(page, /^\/admin\/content(?:$|\?)/);
  });

  test('redirects unauthenticated POI create access to login', async ({ page }) => {
    await page.unroute('**/auth/me');
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) });
    });

    await gotoShellRoot(page);
    await navigateClientSide(page, '/admin/poi/new');
    await expectLoginRedirect(page, /^\/admin\/poi\/new(?:$|\?)/);
  });

  test('keeps the central content overview free of serious accessibility violations', async ({ page }) => {
    await prepareEventAndPoiA11yViews(page);

    await navigateClientSide(page, '/admin/content');
    await expect(page.locator('#main-content')).toBeVisible();
    await expectContentOverviewReady(page);
    await expectNoSeriousAccessibilityViolations(page);
  });

  test('keeps the event create view free of serious accessibility violations', async ({ page }) => {
    await prepareEventAndPoiA11yViews(page);

    await navigateClientSide(page, '/admin/events/new');
    await expect(page.locator('#main-content')).toBeVisible();
    await expectEventOrPoiEditorReady(page, '/admin/events/new');
    await expectNoSeriousAccessibilityViolations(page);
  });

  test('keeps the POI create view free of serious accessibility violations', async ({ page }) => {
    await prepareEventAndPoiA11yViews(page);

    await navigateClientSide(page, '/admin/poi/new');
    await expect(page.locator('#main-content')).toBeVisible();
    await expectEventOrPoiEditorReady(page, '/admin/poi/new');
    await expectNoSeriousAccessibilityViolations(page);
  });
});
