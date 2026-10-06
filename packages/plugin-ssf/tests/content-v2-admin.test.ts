import type { PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultSsfAdminV2Dependencies, createSsfAdminV2Handlers } from '../src/server/content-v2-admin.js';

const context = (scope: 'platform' | 'tenant'): PluginServerHandlerExecutionContext => ({
  request: new Request('https://studio.test/api/v1/plugins/ssf/content-v2/system'),
  pluginId: 'ssf', handlerId: 'ssf.system-content-v2.read', scope,
  actor: { id: 'admin', roles: [], ...(scope === 'tenant' ? { instanceId: 'tenant-a' } : {}) },
});

const catalog = {
  languages: { de: { name: 'German', native: 'Deutsch' } },
  admin_default: 'de', popular: ['de'],
};

describe('SSF V2 admin supported-language catalog', () => {
  it('adds a valid catalog to the existing system content response', async () => {
    const handlers = createSsfAdminV2Handlers({ readSystemV2: async () => ({ installation: null, runtimeTemplate: null }),
      readSupportedLanguages: async () => catalog });
    const response = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    await expect(response?.json()).resolves.toMatchObject({ supportedLanguages: catalog });
  });

  it('keeps the content response successful when the catalog is invalid or unavailable', async () => {
    const readSupportedLanguages = vi.fn().mockResolvedValueOnce({ ...catalog, popular: ['unknown'] })
      .mockRejectedValueOnce(new Error('network detail'));
    const handlers = createSsfAdminV2Handlers({ readSystemV2: async () => ({ installation: null, runtimeTemplate: null }), readSupportedLanguages });
    const first = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    await expect(first?.json()).resolves.toMatchObject({ supportedLanguages: null });
    const second = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    await expect(second?.json()).resolves.toMatchObject({ supportedLanguages: null });
  });

  it('keeps the content response successful when the catalog reader throws synchronously', async () => {
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => ({ installation: null, runtimeTemplate: null }),
      readSupportedLanguages: () => { throw new Error('network detail'); },
    });
    const response = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ supportedLanguages: null });
  });

  it('starts loading the catalog before the content read completes', async () => {
    let finishContent: ((value: { installation: null; runtimeTemplate: null }) => void) | undefined;
    const readSystemV2 = vi.fn(() => new Promise<{ installation: null; runtimeTemplate: null }>((resolve) => {
      finishContent = resolve;
    }));
    const readSupportedLanguages = vi.fn().mockResolvedValue(catalog);
    const handlers = createSsfAdminV2Handlers({ readSystemV2, readSupportedLanguages });

    const responsePromise = handlers['ssf.system-content-v2.read']?.(context('platform'));
    await Promise.resolve();
    expect(readSupportedLanguages).toHaveBeenCalledOnce();
    finishContent?.({ installation: null, runtimeTemplate: null });
    const response = await responsePromise;
    await expect(response?.json()).resolves.toMatchObject({ supportedLanguages: catalog });
  });

  it('caches the default remote catalog and coalesces concurrent requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => catalog });
    vi.stubGlobal('fetch', fetchMock);
    const dependencies = createDefaultSsfAdminV2Dependencies(null, null);

    const values = await Promise.all([
      dependencies.readSupportedLanguages?.(),
      dependencies.readSupportedLanguages?.(),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(values).toEqual([catalog, catalog]);
    vi.unstubAllGlobals();
  });
});
