import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readSsfSystemConfiguration,
  readSsfSystemContentV2,
  readSsfTenantConfiguration,
  readSsfTenantContentV2,
  writeSsfSystemContentV2,
  writeSsfSystemConfiguration,
  writeSsfTenantConfiguration,
} from '../src/admin-api.js';
import type {
  SsfSystemConfigurationInput,
  SsfTenantConfigurationInput,
} from '../src/admin-contracts.js';

const system = {
  defaultLocale: 'de-DE',
  conversationContentStorageMode: 'ask',
  locales: ['de-DE', 'en'].map((locale) => ({
    locale,
    available: true,
    authenticatedHomeExplanationHtml: '<p>Home</p>',
    guestExplanationHtml: '<p>Guest</p>',
    conversationContentStorageQuestionHtml: '<p>Store?</p>',
  })),
} satisfies SsfSystemConfigurationInput;
const overrides = {
  defaultLocale: null,
  conversationContentStorageMode: null,
  locales: ['de-DE', 'en'].map((locale) => ({
    locale,
    enabled: null,
    authenticatedHomeExplanationHtml: null,
    guestExplanationHtml: null,
    conversationContentStorageQuestionHtml: null,
  })),
} satisfies SsfTenantConfigurationInput;

describe('SSF administration API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads and writes system configuration', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => system });
    vi.stubGlobal('fetch', fetch);

    await expect(readSsfSystemConfiguration()).resolves.toEqual(system);
    await expect(writeSsfSystemConfiguration(system)).resolves.toEqual(system);
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/v1/plugins/ssf/system-configuration',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(system) })
    );
  });

  it('reads and writes tenant configuration with a nullable effective storage question', async () => {
    const effective = {
      ...system,
      conversationContentStorageMode: 'disabled',
      locales: system.locales.map((locale) => ({
        ...locale,
        conversationContentStorageQuestionHtml: null,
      })),
    };
    const view = { system, overrides, effective };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => view });
    vi.stubGlobal('fetch', fetch);

    await expect(readSsfTenantConfiguration()).resolves.toEqual(view);
    await expect(writeSsfTenantConfiguration(overrides)).resolves.toEqual(view);
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/v1/plugins/ssf/tenant-configuration',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(overrides) })
    );
  });

  it('rejects unsuccessful and malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(readSsfSystemConfiguration()).rejects.toThrow('ssf_configuration_http_503');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(readSsfSystemConfiguration()).rejects.toThrow();
  });

  it('reads the validated SSF language catalog with both V2 admin views', async () => {
    const catalog = { languages: { de: { name: 'German', native: 'Deutsch' } }, admin_default: 'de', popular: ['de'] };
    const systemView = { installation: null, runtimeTemplate: null, supportedLanguages: catalog };
    const tenantView = { runtimeTemplate: null, overrides: null, supportedLanguages: catalog };
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => systemView })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...systemView, supportedLanguages: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => tenantView });
    vi.stubGlobal('fetch', fetch);

    await expect(readSsfSystemContentV2()).resolves.toEqual(systemView);
    await expect(writeSsfSystemContentV2({ installation: null, runtimeTemplate: null }))
      .resolves.toEqual({ ...systemView, supportedLanguages: null });
    await expect(readSsfTenantContentV2()).resolves.toEqual(tenantView);
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/plugins/ssf/content-v2/tenant', undefined);
  });
});
