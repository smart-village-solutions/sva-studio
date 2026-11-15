import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readSsfSystemContentV2,
  readSsfTenantContentV2,
  writeSsfSystemContentV2,
  writeSsfTenantContentV2,
} from '../src/admin-api.js';
const revision = `sha256:${'0'.repeat(64)}`;
describe('SSF administration API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects unsuccessful responses and responses without a saved-state token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(readSsfSystemContentV2()).rejects.toThrow('ssf_configuration_http_503');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(readSsfSystemContentV2()).rejects.toThrow();
  });

  it('preserves validated policy conflicts only for root content writes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              error: 'invalid_configuration',
              affectedTenants: ['synthetic-alpha', 'synthetic-beta'],
            }),
            { status: 422 }
          )
      )
    );
    await expect(
      writeSsfSystemContentV2({ installation: null, runtimeTemplate: null }, revision)
    ).rejects.toMatchObject({
      affectedTenants: ['synthetic-alpha', 'synthetic-beta'],
    });
    await expect(writeSsfTenantContentV2({}, revision)).rejects.not.toHaveProperty(
      'affectedTenants'
    );
  });
  it('keeps malformed policy-conflict responses on the generic error path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'invalid_configuration',
            affectedTenants: ['synthetic-alpha', 123],
          }),
          { status: 422 }
        )
      )
    );
    await expect(
      writeSsfSystemContentV2({ installation: null, runtimeTemplate: null }, revision)
    ).rejects.toThrow('ssf_configuration_http_422');
  });

  it('reads the validated SSF language catalog with both V2 admin views', async () => {
    const catalog = {
      languages: { de: { name: 'German', native: 'Deutsch' } },
      admin_default: 'de',
      popular: ['de'],
    };
    const systemView = { installation: null, runtimeTemplate: null, supportedLanguages: catalog };
    const tenantView = { runtimeTemplate: null, overrides: null, supportedLanguages: catalog };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'X-SSF-Content-Revision': revision }),
        json: async () => systemView,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'X-SSF-Content-Revision': revision }),
        json: async () => ({ ...systemView, supportedLanguages: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'X-SSF-Content-Revision': revision }),
        json: async () => tenantView,
      });
    vi.stubGlobal('fetch', fetch);

    await expect(readSsfSystemContentV2()).resolves.toEqual({
      ...systemView,
      contentRevision: revision,
    });
    await expect(
      writeSsfSystemContentV2({ installation: null, runtimeTemplate: null }, revision)
    ).resolves.toEqual({ ...systemView, supportedLanguages: null, contentRevision: revision });
    await expect(readSsfTenantContentV2()).resolves.toEqual({
      ...tenantView,
      contentRevision: revision,
    });
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/plugins/ssf/content-v2/tenant', undefined);
  });
});
