import AxeBuilder from '@axe-core/playwright';
import { createMediaEditingDocument, type MediaEditingDocument } from '@sva/media';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import {
  expectAppShellReady,
  navigateClientSide,
  registerSharedIamRoutes,
} from './studio-shell.helpers';

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
    tags?: string[];
    focusPoint?: { x: number; y: number };
    crop?: { x: number; y: number; width: number; height: number };
  };
  previewUrl?: string;
  hasEditingDocument?: boolean;
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

  await registerSharedIamRoutes(page, { pendingLegalTextsPageSize: 25 });

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
    const body = request.postDataJSON() as {
      mimeType: string;
      byteSize: number;
      visibility?: 'public' | 'protected';
    };
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

  await route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'not_found' }),
  });
};

test.describe('media management', () => {
  test.beforeEach(async ({ page }) => {
    await mockSharedShellRequests(page);
  });

  test('uploads a file from the media library and opens the detail workspace afterwards', async ({
    page,
  }) => {
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
    await expectAppShellReady(page);
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

    await expect(
      page.getByText('Die Medienaktion konnte wegen eines Konflikts nicht abgeschlossen werden.')
    ).toBeVisible();
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
    await expectAppShellReady(page);
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

test('real image editor exports and restores editable copies without external editor requests', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await mockSharedShellRequests(page);
  await page.goto('/interfaces');
  await expectAppShellReady(page);
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#346b81';
    ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#e9bc62';
    ctx.fillRect(0, 0, 300, 800);
    return canvas.toDataURL('image/png');
  });
  const sourceBytes = Buffer.from(source.split(',')[1]!, 'base64');
  const original: MediaAssetRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    instanceId: 'de-musterhausen',
    storageKey: 'fixture/original.png',
    mediaType: 'image',
    mimeType: 'image/png',
    byteSize: sourceBytes.length,
    visibility: 'public',
    uploadStatus: 'processed',
    processingStatus: 'ready',
    metadata: {
      title: 'Originalbild',
      altText: 'Zweifarbiges Testmotiv',
      copyright: 'Redaktion',
      tags: ['Test'],
    },
    technical: { width: 1200, height: 800 },
    previewUrl: '/media-editor-fixture.png',
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
  };
  const originalSnapshot = structuredClone(original);
  const assets = new Map([[original.id, original]]);
  const docs = new Map<string, MediaEditingDocument>();
  const uploads: Buffer[] = [];
  const payloads: Array<{
    metadata: MediaAssetRecord['metadata'];
    editing: { sourceAssetId: string; document: MediaEditingDocument };
  }> = [];
  let nextId = '';
  await page.route('**/media-editor-fixture.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: sourceBytes })
  );
  await page.route('**/media-editor-upload', async (route) => {
    uploads.push(route.request().postDataBuffer()!);
    await route.fulfill({ status: 200 });
  });
  await page.route('**/api/v1/iam/media**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/upload-sessions') && request.method() === 'POST') {
      const body = request.postDataJSON();
      payloads.push(body);
      nextId = `22222222-2222-4222-8222-${String(payloads.length).padStart(12, '0')}`;
      docs.set(nextId, body.editing.document);
      assets.set(nextId, {
        ...original,
        id: nextId,
        metadata: body.metadata,
        hasEditingDocument: true,
      });
      await route.fulfill({
        json: {
          data: {
            assetId: nextId,
            uploadSessionId: 'fixture-session',
            uploadUrl: new URL('/media-editor-upload', request.url()).href,
            method: 'PUT',
            headers: {},
            expiresAt: '2099-01-01T00:00:00Z',
            status: 'initialized',
            initializedAt: '2026-10-22T12:00:00Z',
          },
        },
      });
      return;
    }
    if (path.endsWith('/complete')) {
      await route.fulfill({
        json: {
          data: { assetId: nextId, uploadSessionId: 'fixture-session', status: 'processed' },
        },
      });
      return;
    }
    const match = path.match(/\/media\/([^/]+)(?:\/(editing|usage))?$/);
    if (!match) {
      await route.fulfill({ json: { data: [...assets.values()] } });
      return;
    }
    const id = match[1]!;
    if (match[2] === 'editing') {
      await route.fulfill({
        json: {
          data: {
            assetId: id,
            sourceAssetId: original.id,
            sourceUrl: new URL('/media-editor-fixture.png', request.url()).href,
            sourceExpiresAt: '2099-01-01T00:00:00Z',
            document: docs.get(id),
          },
        },
      });
      return;
    }
    if (match[2] === 'usage') {
      await route.fulfill({ json: { data: { assetId: id, totalReferences: 0, references: [] } } });
      return;
    }
    await route.fulfill({ json: { data: assets.get(id) } });
  });
  // Representative persisted annotations exercise native image hydration in the actual library.
  docs.set(
    original.id,
    createMediaEditingDocument({
      annotations: {
        text: {
          id: 'text',
          name: 'Text',
          text: 'Redaktioneller Hinweis',
          x: 90,
          y: 90,
          width: 420,
          height: 70,
          fill: '#ffffff',
          fontSize: 36,
          fontFamily: 'Arial',
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        rect: {
          id: 'rect',
          name: 'Rect',
          x: 600,
          y: 200,
          width: 160,
          height: 110,
          fill: '#cc3344',
          stroke: '#ffffff',
          strokeWidth: 3,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        inserted: {
          id: 'inserted',
          name: 'Image',
          image: source,
          originalImage: source,
          x: 850,
          y: 500,
          width: 180,
          height: 120,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
      },
      annotationIds: ['text', 'rect', 'inserted'],
    })
  );
  await navigateClientSide(page, `/admin/media/${original.id}`);
  await expect(page.getByRole('heading', { name: 'Originalbild', exact: true })).toBeVisible();
  const unexpected: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(page.url()).origin)
      unexpected.push(url.origin + url.pathname);
  });
  const openEditor = async () => {
    await page.getByRole('button', { name: 'Bild bearbeiten', exact: true }).click();
    await expect(page.locator('.FIE_root')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.locator('.FIE_root canvas').count()).toBeGreaterThan(0);
    await expect(
      page.getByRole('button', { name: 'Weiter zu Angaben und Vorschau' })
    ).toBeEnabled();
    await expect(
      page.locator('.FIE_root').getByText('Zuschneiden', { exact: true }).first()
    ).toBeVisible();
  };
  await openEditor();
  for (const theme of ['sva-default', 'sva-forest'])
    for (const dark of [false, true]) {
      await page.evaluate(
        ({ theme, dark }) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.classList.toggle('dark', dark);
        },
        { theme, dark }
      );
      // Remount to resolve semantic colors from the current Studio theme.
      await page.getByRole('button', { name: 'Bearbeitung verwerfen und zurück' }).click();
      await openEditor();
      await page.screenshot({
        path: testInfo.outputPath(`${theme}-${dark ? 'dark' : 'light'}.png`),
        fullPage: false,
      });
    }
  await page.getByRole('button', { name: 'Weiter zu Angaben und Vorschau' }).click();
  await expect(
    page.getByRole('heading', { name: 'Wichtiger Bildbereich und Vorschau' })
  ).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(2);
  await page.getByRole('slider', { name: 'Horizontaler Bildbereich' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider', { name: 'Horizontaler Bildbereich' })).toHaveValue('51');
  await page.getByRole('button', { name: 'Als neues Bild speichern', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(nextId));
  await expect.poll(() => uploads.length).toBe(1);
  expect(payloads[0]!.editing.sourceAssetId).toBe(original.id);
  expect(payloads[0]!.metadata.tags).toEqual(['Test']);
  expect(payloads[0]!.metadata.focusPoint).toEqual({ x: 0.51, y: 0.5 });
  expect(payloads[0]!.editing.document.state.annotationIds).toEqual(['text', 'rect', 'inserted']);
  expect(JSON.stringify(payloads[0]!.editing.document)).not.toContain('http');
  expect(uploads[0]!.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(uploads[0]!.equals(sourceBytes)).toBe(false);
  await openEditor();
  await page.getByRole('button', { name: 'Weiter zu Angaben und Vorschau' }).click();
  await expect(
    page.getByRole('heading', { name: 'Wichtiger Bildbereich und Vorschau' })
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(
    page.getByRole('button', { name: 'Als neues Bild speichern', exact: true })
  ).toBeVisible();
  const hostOverflow = await page
    .getByRole('dialog')
    .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(hostOverflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('host-320px.png'), fullPage: true });
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(
    page.getByRole('button', { name: 'Als neues Bild speichern', exact: true })
  ).toBeVisible();
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(
    false
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Als neues Bild speichern', exact: true }).click();
  await expect.poll(() => uploads.length).toBe(2);
  expect(uploads[1]!.equals(uploads[0]!)).toBe(true);
  expect(assets.get(original.id)).toEqual(originalSnapshot);
  expect(unexpected).toEqual([]);
});
