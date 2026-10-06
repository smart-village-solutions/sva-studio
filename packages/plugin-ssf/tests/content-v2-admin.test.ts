import { readFileSync } from 'node:fs';

import type { PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultSsfAdminV2Dependencies, createSsfAdminV2Handlers } from '../src/server/content-v2-admin.js';
import type { SsfSystemContentV2 } from '../src/content-v2-repository.js';
import { ssfInstallationContentV2FieldsSchema, ssfRuntimeContentV2FieldsSchema } from '../src/content-v2-contracts.js';

const context = (scope: 'platform' | 'tenant'): PluginServerHandlerExecutionContext => ({
  request: new Request('https://studio.test/api/v1/plugins/ssf/content-v2/system'),
  pluginId: 'ssf', handlerId: 'ssf.system-content-v2.read', scope,
  actor: { id: 'admin', roles: [], ...(scope === 'tenant' ? { instanceId: 'tenant-a' } : {}) },
});

const writeContext = (scope: 'platform' | 'tenant', value: unknown): PluginServerHandlerExecutionContext => ({
  ...context(scope), request: new Request('https://studio.test/api/v1/plugins/ssf/content-v2/write', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value),
  }),
});

const readExample = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../../docs/api/${name}`, import.meta.url), 'utf8')) as Record<string, unknown>;

const systemContent = (): SsfSystemContentV2 => {
  const installation = readExample('ssf-installation-content-v2.example.json');
  delete installation['contractVersion'];
  delete installation['configurationRevision'];
  const runtimeTemplate = readExample('ssf-runtime-configuration-v2.example.json');
  delete runtimeTemplate['contractVersion'];
  delete runtimeTemplate['configurationRevision'];
  delete runtimeTemplate['tenant'];
  return {
    installation: ssfInstallationContentV2FieldsSchema.parse(installation),
    runtimeTemplate: ssfRuntimeContentV2FieldsSchema.parse(runtimeTemplate),
  };
};

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

  it('rejects unsupported system locales before persisting', async () => {
    const previous = systemContent();
    const input = structuredClone(previous);
    if (!input.installation) throw new Error('ssf_v2_test_installation_missing');
    input.installation.localization.locale = 'fr';
    const writeSystemV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({ readSystemV2: async () => previous,
      writeSystemV2, readSupportedLanguages: async () => catalog });
    const response = await handlers['ssf.system-content-v2.write']?.(writeContext('platform', input));
    expect(response?.status).toBe(422);
    expect(writeSystemV2).not.toHaveBeenCalled();
  });

  it('preserves an unchanged saved locale when the catalog no longer contains it', async () => {
    const previous = systemContent();
    if (!previous.installation) throw new Error('ssf_v2_test_installation_missing');
    previous.installation.localization.locale = 'de-DE';
    const writeSystemV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({ readSystemV2: async () => previous,
      writeSystemV2, readSupportedLanguages: async () => catalog });
    const response = await handlers['ssf.system-content-v2.write']?.(writeContext('platform', previous));
    expect(response?.status).toBe(200);
    expect(writeSystemV2).toHaveBeenCalledOnce();
  });

  it('rejects system guest-language removals while the catalog is unavailable', async () => {
    const previous = systemContent();
    const input = structuredClone(previous);
    if (!input.runtimeTemplate) throw new Error('ssf_v2_test_runtime_missing');
    input.runtimeTemplate.guestLanguages.pop();
    const writeSystemV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({ readSystemV2: async () => previous,
      writeSystemV2, readSupportedLanguages: async () => { throw new Error('catalog unavailable'); } });
    const response = await handlers['ssf.system-content-v2.write']?.(writeContext('platform', input));
    expect(response?.status).toBe(422);
    expect(writeSystemV2).not.toHaveBeenCalled();
  });

  it('rejects unsupported tenant staff locale changes before persisting', async () => {
    const writeTenantV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({
      readTenantV2: async () => ({ runtimeTemplate: systemContent().runtimeTemplate, overrides: null }),
      writeTenantV2, readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.tenant-content-v2.write']?.(writeContext('tenant', { staff: { locale: 'fr' } }));
    expect(response?.status).toBe(422);
    expect(writeTenantV2).not.toHaveBeenCalled();
  });

  it('rejects tenant guest-language toggles while the catalog is unavailable', async () => {
    const writeTenantV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({
      readTenantV2: async () => ({ runtimeTemplate: systemContent().runtimeTemplate, overrides: null }),
      writeTenantV2, readSupportedLanguages: async () => { throw new Error('catalog unavailable'); },
    });
    const response = await handlers['ssf.tenant-content-v2.write']?.(writeContext('tenant', {
      guestLanguages: [{ locale: 'en', enabled: false }],
    }));
    expect(response?.status).toBe(422);
    expect(writeTenantV2).not.toHaveBeenCalled();
  });

  it('allows tenant guest-text edits while the catalog is unavailable', async () => {
    const writeTenantV2 = vi.fn().mockResolvedValue(undefined);
    const handlers = createSsfAdminV2Handlers({
      readTenantV2: async () => ({ runtimeTemplate: systemContent().runtimeTemplate, overrides: null }),
      writeTenantV2, readSupportedLanguages: async () => { throw new Error('catalog unavailable'); },
    });
    const response = await handlers['ssf.tenant-content-v2.write']?.(writeContext('tenant', {
      guestLanguages: [{ locale: 'en', guest: { explanationHtml: '<p>Text</p>' } }],
    }));
    expect(response?.status).toBe(200);
    expect(writeTenantV2).toHaveBeenCalledOnce();
  });
});
