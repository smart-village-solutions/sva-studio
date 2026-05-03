import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

type MediaAssetRecord = {
  readonly id: string;
  readonly instanceId: string;
  readonly storageKey: string;
  readonly mediaType: 'image';
  readonly mimeType: string;
  readonly byteSize: number;
  visibility: 'public' | 'protected';
  uploadStatus: 'pending' | 'validated' | 'processed' | 'failed' | 'blocked';
  processingStatus: 'pending' | 'ready' | 'failed';
  metadata: {
    title?: string;
    description?: string;
    altText?: string;
    copyright?: string;
    license?: string;
    focusPoint?: { x: number; y: number };
    crop?: { x: number; y: number; width: number; height: number };
  };
  technical: Record<string, unknown>;
  readonly createdAt: string;
  updatedAt: string;
};

type MediaUsageRecord = {
  readonly assetId: string;
  totalReferences: number;
  references: Array<{
    readonly id: string;
    readonly assetId: string;
    readonly targetType: string;
    readonly targetId: string;
    readonly role: string;
    readonly sortOrder?: number;
  }>;
};

const authenticatedUser = {
  user: {
    id: 'kc-editor-1',
    name: 'Editor One',
    email: 'editor@example.com',
    instanceId: 'de-musterhausen',
    assignedModules: ['media'],
    roles: ['editor', 'instance_registry_admin'],
    permissionActions: [
      'media.read',
      'media.create',
      'media.update',
      'media.referenceManage',
      'media.delete',
      'media.deliverProtected',
    ],
  },
};

const permissionPayload = {
  instanceId: 'de-musterhausen',
  permissions: [
    { action: 'media.read', resourceType: 'media' },
    { action: 'media.create', resourceType: 'media' },
    { action: 'media.update', resourceType: 'media' },
    { action: 'media.referenceManage', resourceType: 'media' },
    { action: 'media.delete', resourceType: 'media' },
    { action: 'media.deliverProtected', resourceType: 'media' },
  ],
  subject: {
    actorUserId: 'kc-editor-1',
    effectiveUserId: 'kc-editor-1',
    isImpersonating: false,
  },
  evaluatedAt: '2026-04-29T12:00:00.000Z',
};

const expectInterfacesShellReady = async (page: Page, timeout = 20_000) => {
  await expect
    .poll(
      async () => {
        const headingVisible = await page
          .getByRole('heading', { name: 'Schnittstellen' })
          .isVisible()
          .catch(() => false);
        if (headingVisible) {
          return true;
        }

        return page
          .getByText('Schnittstellen werden geladen ...')
          .isVisible()
          .catch(() => false);
      },
      { timeout }
    )
    .toBe(true);
};

const expectHydratedPlaywrightShell = async (page: Page, timeout = 20_000) => {
  await expect
    .poll(
      async () => ({
        dataTheme: await page.locator('html').getAttribute('data-theme'),
        hasRouterHook: await page
          .evaluate(
            () =>
              Boolean(
                (
                  window as typeof window & {
                    __SVA_PLAYWRIGHT_ROUTER__?: unknown;
                  }
                ).__SVA_PLAYWRIGHT_ROUTER__
              )
          )
          .catch(() => false),
      }),
      { timeout }
    )
    .toEqual({
      dataTheme: 'sva-default',
      hasRouterHook: true,
    });
};

const navigateClientSide = async (page: Page, targetPath: string) => {
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

const mockSharedShellRequests = async (page: Page) => {
  await page.route('**/_server/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          instanceId: 'de-musterhausen',
          config: {
            graphqlBaseUrl: 'https://initial.example.org/graphql',
            oauthTokenUrl: 'https://initial.example.org/oauth/token',
            enabled: true,
          },
          status: {
            status: 'connected',
            checkedAt: '2026-03-26T08:45:40.000Z',
          },
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/auth/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authenticatedUser),
    });
  });

  await page.route('**/iam/me/permissions?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(permissionPayload),
    });
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

  await page.route('**/api/v1/mainserver/news', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: {
          page: 1,
          pageSize: 25,
          hasNextPage: false,
        },
      }),
    });
  });
};

const routeMediaRequests = async (
  route: Route,
  state: {
    assets: MediaAssetRecord[];
    usageByAssetId: Record<string, MediaUsageRecord>;
  }
) => {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const path = url.pathname;

  if (path === '/api/v1/iam/media' && method === 'GET') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: state.assets }),
    });
    return;
  }

  if (path === '/api/v1/iam/media/upload-sessions' && method === 'POST') {
    const body = request.postDataJSON() as { mimeType: string; byteSize: number; visibility?: 'public' | 'protected' };
    const asset: MediaAssetRecord = {
      id: 'asset-1',
      instanceId: 'de-musterhausen',
      storageKey: 'de-musterhausen/originals/asset-1.jpg',
      mediaType: 'image',
      mimeType: body.mimeType,
      byteSize: body.byteSize,
      visibility: body.visibility ?? 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      metadata: {},
      technical: { width: 2400, height: 1600 },
      createdAt: '2026-04-29T12:10:00.000Z',
      updatedAt: '2026-04-29T12:10:00.000Z',
    };
    state.assets = [asset];
    state.usageByAssetId['asset-1'] = {
      assetId: 'asset-1',
      totalReferences: 1,
      references: [
        {
          id: 'ref-asset-1',
          assetId: 'asset-1',
          targetType: 'news',
          targetId: 'news-1',
          role: 'teaser_image',
          sortOrder: 0,
        },
      ],
    };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          assetId: 'asset-1',
          uploadSessionId: 'upload-1',
          uploadUrl: 'https://uploads.example.test/asset-1',
          method: 'PUT',
          headers: {},
          expiresAt: '2026-04-29T13:10:00.000Z',
          status: 'initialized',
          initializedAt: '2026-04-29T12:10:00.000Z',
        },
      }),
    });
    return;
  }

  const usageMatch = path.match(/^\/api\/v1\/iam\/media\/([^/]+)\/usage$/);
  if (usageMatch && method === 'GET') {
    const usage = state.usageByAssetId[usageMatch[1]];
    await route.fulfill({
      status: usage ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(usage ? { data: usage } : { error: 'not_found' }),
    });
    return;
  }

  const detailMatch = path.match(/^\/api\/v1\/iam\/media\/([^/]+)$/);
  if (!detailMatch) {
    await route.fallback();
    return;
  }

  const assetId = detailMatch[1];
  if (!assetId) {
    await route.fallback();
    return;
  }

  const asset = state.assets.find((entry) => entry.id === assetId);

  if (method === 'GET') {
    await route.fulfill({
      status: asset ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(asset ? { data: asset } : { error: 'not_found' }),
    });
    return;
  }

  if (method === 'PATCH' && asset) {
    const body = request.postDataJSON() as {
      visibility?: 'public' | 'protected';
      metadata?: MediaAssetRecord['metadata'];
    };
    asset.visibility = body.visibility ?? asset.visibility;
    asset.metadata = {
      ...asset.metadata,
      ...body.metadata,
    };
    asset.updatedAt = '2026-04-29T12:20:00.000Z';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: asset }),
    });
    return;
  }

  if (method === 'DELETE' && asset) {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'conflict',
        message: 'Das Medienobjekt kann derzeit nicht gelöscht werden.',
        safeDetails: {
          reason_code: 'active_references',
        },
      }),
    });
    return;
  }

  await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
};

test.describe('media management', () => {
  test.beforeEach(async ({ page }) => {
    await mockSharedShellRequests(page);
  });

  test('covers upload initialization, metadata editing, focus point, crop, and blocked deletion', async ({ page }) => {
    const state: {
      assets: MediaAssetRecord[];
      usageByAssetId: Record<string, MediaUsageRecord>;
    } = {
      assets: [],
      usageByAssetId: {},
    };

    await page.route('**/api/v1/iam/media**', async (route) => {
      await routeMediaRequests(route, state);
    });

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto('/interfaces');
    await expectInterfacesShellReady(page);
    await expectHydratedPlaywrightShell(page);
    await navigateClientSide(page, '/admin/media/new');
    await expect(page.getByRole('heading', { name: 'Medienupload vorbereiten' })).toBeVisible();
    await page.getByLabel('MIME-Typ').fill('image/jpeg');
    await page.getByLabel('Dateigröße in Byte').fill('640000');
    await page.getByRole('button', { name: 'Upload initialisieren' }).click();

    await expect(page.getByText('Upload bereit')).toBeVisible();
    await expect(page.getByText('Asset-ID: asset-1')).toBeVisible();
    await navigateClientSide(page, '/admin/media/asset-1');
    await expect(page.getByRole('heading', { name: 'Medium bearbeiten' })).toBeVisible();
    await page.getByLabel('Titel').fill('Hero Asset');
    await page.getByLabel('Alternativtext').fill('Rathaus am Marktplatz');
    await page.getByLabel('Fokuspunkt X').fill('0.35');
    await page.getByLabel('Fokuspunkt Y').fill('0.65');
    await page.getByLabel('Zuschnitt X').fill('48');
    await page.getByLabel('Zuschnitt Y').fill('96');
    await page.getByLabel('Zuschnitt Breite').fill('1280');
    await page.getByLabel('Zuschnitt Höhe').fill('720');
    await page.getByRole('button', { name: 'Metadaten speichern' }).click();

    await expect(page.getByLabel('Titel')).toHaveValue('Hero Asset');
    await expect(page.getByLabel('Alternativtext')).toHaveValue('Rathaus am Marktplatz');
    await expect(page.getByLabel('Fokuspunkt X')).toHaveValue('0.35');
    await expect(page.getByLabel('Zuschnitt Breite')).toHaveValue('1280');

    await page.getByRole('button', { name: 'Medium löschen' }).click();

    await expect(page.getByText('Die Medienaktion konnte wegen eines Konflikts nicht abgeschlossen werden.')).toBeVisible();
    await expect(page.getByText('Aktive Referenzen: 1')).toBeVisible();
  });
});
