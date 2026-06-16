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
      'media.reference.manage',
      'media.delete',
      'media.deliver.protected',
    ],
  },
};

const permissionPayload = {
  instanceId: 'de-musterhausen',
  permissions: [
    { action: 'media.read', resourceType: 'media' },
    { action: 'media.create', resourceType: 'media' },
    { action: 'media.update', resourceType: 'media' },
    { action: 'media.reference.manage', resourceType: 'media' },
    { action: 'media.delete', resourceType: 'media' },
    { action: 'media.deliver.protected', resourceType: 'media' },
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
        const headingVisible = await page.getByRole('heading', { name: 'Schnittstellen' }).isVisible().catch(() => false);
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

const mockSharedShellRequests = async (page: Page) => {
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
      body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 25, total: 0 } }),
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
          total: 0,
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
      body: JSON.stringify({
        data: state.assets,
        pagination: {
          page: 1,
          pageSize: 36,
          total: state.assets.length,
        },
      }),
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
      uploadStatus: 'pending',
      processingStatus: 'pending',
      metadata: {},
      technical: {},
      createdAt: '2026-04-29T12:10:00.000Z',
      updatedAt: '2026-04-29T12:10:00.000Z',
    };
    state.assets = [asset];
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

  if (path === '/api/v1/iam/media/upload-sessions/upload-1/complete' && method === 'POST') {
    const asset = state.assets.find((entry) => entry.id === 'asset-1');
    if (asset) {
      asset.uploadStatus = 'processed';
      asset.processingStatus = 'ready';
      asset.updatedAt = '2026-04-29T12:12:00.000Z';
      asset.technical = { width: 2400, height: 1600 };
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
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          assetId: 'asset-1',
          uploadSessionId: 'upload-1',
          status: 'processed',
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

  test('uploads a file from the media library and opens the detail workspace afterwards', async ({ page }) => {
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
    await page.route('https://uploads.example.test/**', async (route) => {
      await route.fulfill({ status: 200, body: '' });
    });

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto('/interfaces');
    await expectInterfacesShellReady(page);
    await navigateClientSide(page, '/admin/media');
    await expect(page.getByRole('heading', { name: 'Medienbibliothek' })).toBeVisible();
    await page.locator('[data-testid="media-upload-input"]').setInputFiles({
      name: 'hero.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('binary'),
    });

    await expect(page.getByRole('heading', { name: 'asset-1' })).toBeVisible();
    await expect(page.getByText('1 Verwendung')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auslieferungslink erzeugen' })).toBeVisible();
    await expect(page.getByText('Aktive Referenzen: 1')).toBeVisible();
    await expect(page.getByText('Teaserbild')).toBeVisible();
    await expect(page.getByText('news-1')).toBeVisible();

    await page.getByRole('button', { name: 'Medium löschen' }).click();

    await expect(page.getByText('Die Medienaktion konnte wegen eines Konflikts nicht abgeschlossen werden.')).toBeVisible();
    await expect(page.getByText('Aktive Referenzen: 1')).toBeVisible();
  });

  test('keeps users on the media library when the signed upload PUT fails', async ({ page }) => {
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
    await page.route('https://uploads.example.test/**', async (route) => {
      await route.fulfill({ status: 500, body: '' });
    });

    await page.goto('/interfaces');
    await expectInterfacesShellReady(page);
    await navigateClientSide(page, '/admin/media');
    await expect(page.getByRole('heading', { name: 'Medienbibliothek' })).toBeVisible();

    await page.locator('[data-testid="media-upload-input"]').setInputFiles({
      name: 'hero.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('binary'),
    });

    await expect(page.getByText('Der Upload konnte nicht abgeschlossen werden.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/media(?:\?|$)/);
  });
});
