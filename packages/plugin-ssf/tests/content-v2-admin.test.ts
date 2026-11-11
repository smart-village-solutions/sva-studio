import { readFileSync } from 'node:fs';

import type { PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
import { describe, expect, it, vi } from 'vitest';

import {
  createDefaultSsfAdminV2Dependencies,
  createSsfAdminV2Handlers as createHandlers,
  type SsfAdminV2Dependencies,
} from '../src/server/content-v2-admin.js';
import {
  SsfContentRevisionConflict,
  createSsfAdminContentRevision,
  SsfContentV2TenantConflict,
  type SsfSystemContentV2,
} from '../src/content-v2-repository.js';
import {
  ssfInstallationContentV2FieldsSchema,
  ssfRuntimeContentV2FieldsSchema,
} from '../src/content-v2-contracts.js';

// Repository test doubles run the transaction-owned validation against their current state.
const createSsfAdminV2Handlers = (
  dependencies: Omit<SsfAdminV2Dependencies, 'writeSystemV2' | 'writeTenantV2'> & {
    writeSystemV2?: (input: SsfSystemContentV2) => Promise<unknown>;
    writeTenantV2?: (instanceId: string, input: Record<string, unknown>) => Promise<unknown>;
  }
) =>
  createHandlers({
    ...dependencies,
    writeSystemV2: dependencies.writeSystemV2
      ? async (input, options) => {
          const previous = await dependencies.readSystemV2!();
          options.validate?.(previous);
          await dependencies.writeSystemV2!(input);
          return dependencies.readSystemV2!();
        }
      : undefined,
    writeTenantV2: dependencies.writeTenantV2
      ? async (instanceId, input, options) => {
          const previous = await dependencies.readTenantV2!(instanceId);
          options.validate?.(previous);
          await dependencies.writeTenantV2!(instanceId, input);
          return dependencies.readTenantV2!(instanceId);
        }
      : undefined,
  });

const context = (scope: 'platform' | 'tenant'): PluginServerHandlerExecutionContext => ({
  request: new Request('https://studio.test/api/v1/plugins/ssf/content-v2/system'),
  pluginId: 'ssf',
  handlerId: 'ssf.system-content-v2.read',
  scope,
  actor: { id: 'admin', roles: [], ...(scope === 'tenant' ? { instanceId: 'tenant-a' } : {}) },
});

const writeContext = (
  scope: 'platform' | 'tenant',
  value: unknown
): PluginServerHandlerExecutionContext => ({
  ...context(scope),
  request: new Request('https://studio.test/api/v1/plugins/ssf/content-v2/write', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-SSF-Expected-Content-Revision': `sha256:${'0'.repeat(64)}`,
    },
    body: JSON.stringify(value),
  }),
});

const readExample = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../../docs/api/${name}`, import.meta.url), 'utf8')) as Record<
    string,
    unknown
  >;

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
  admin_default: 'de',
  popular: ['de'],
};

describe('SSF V2 admin supported-language catalog', () => {
  const legal = (locale = 'de-DE') => ({
    sourceLocale: locale,
    version: 'test-draft',
    localizations: [
      {
        locale,
        mode2Consent: null,
        mode3Consent: null,
        guestRecordingRelease: null,
        staffRecordingRelease: null,
        recordingStatus: null,
      },
    ],
  });

  it('reports affected tenant identifiers only through the root write response', async () => {
    const previous = systemContent();
    const conflict = async (): Promise<never> => {
      throw new SsfContentV2TenantConflict(['synthetic-alpha', 'synthetic-beta']);
    };
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => previous,
      writeSystemV2: conflict,
      readTenantV2: async () => ({ runtimeTemplate: previous.runtimeTemplate, overrides: {} }),
      writeTenantV2: conflict,
    });
    const root = await handlers['ssf.system-content-v2.write']?.(
      writeContext('platform', previous)
    );
    expect(root?.status).toBe(422);
    await expect(root?.json()).resolves.toEqual({
      error: 'invalid_configuration',
      affectedTenants: ['synthetic-alpha', 'synthetic-beta'],
    });
    const forbidden = await handlers['ssf.system-content-v2.write']?.(
      writeContext('tenant', previous)
    );
    expect(forbidden?.status).toBe(403);
    await expect(forbidden?.json()).resolves.toEqual({ error: 'forbidden' });
    const tenant = await handlers['ssf.tenant-content-v2.write']?.(writeContext('tenant', {}));
    expect(tenant?.status).toBe(422);
    await expect(tenant?.json()).resolves.toEqual({ error: 'invalid_configuration' });
  });

  it('rejects newly introduced unsupported legal languages at the administration boundary', async () => {
    const previous = systemContent();
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => previous,
      writeSystemV2: async () => {
        throw new Error('must not persist unsupported legal content');
      },
      readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.system-content-v2.write']?.(
      writeContext('platform', {
        ...previous,
        runtimeTemplate: { ...previous.runtimeTemplate, legalTexts: legal('fr') },
      })
    );
    expect(response?.status).toBe(422);
  });

  it('preserves saved legal language editing but rejects language additions without the catalog', async () => {
    const previous = systemContent();
    previous.runtimeTemplate!.legalTexts = legal();
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => previous,
      writeSystemV2: async (input) => {
        previous.runtimeTemplate = input.runtimeTemplate;
      },
    });
    const input = structuredClone(previous);
    input.runtimeTemplate!.legalTexts!.version = 'edited-draft';
    const edited = await handlers['ssf.system-content-v2.write']?.(writeContext('platform', input));
    expect(edited?.status).toBe(200);
    await expect(edited?.json()).resolves.toMatchObject({
      runtimeTemplate: { legalTexts: { version: 'edited-draft' } },
    });
    input.runtimeTemplate!.legalTexts!.localizations.push({ ...legal('fr').localizations[0]! });
    const invalid = await handlers['ssf.system-content-v2.write']?.(
      writeContext('platform', input)
    );
    expect(invalid?.status).toBe(422);
  });

  it('accepts a catalog-backed regional source on the bound tenant and reads it back', async () => {
    const state = {
      runtimeTemplate: systemContent().runtimeTemplate,
      overrides: {} as Record<string, unknown>,
    };
    const handlers = createSsfAdminV2Handlers({
      readTenantV2: async () => state,
      writeTenantV2: async (instanceId, input) => {
        if (instanceId !== 'tenant-a') throw new Error('wrong tenant');
        state.overrides = input;
      },
      readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.tenant-content-v2.write']?.(
      writeContext('tenant', { legalTexts: legal() })
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      overrides: { legalTexts: { sourceLocale: 'de-DE' } },
    });
  });

  it('adds a valid catalog to the existing system content response', async () => {
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => ({ installation: null, runtimeTemplate: null }),
      readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    await expect(response?.json()).resolves.toMatchObject({ supportedLanguages: catalog });
  });

  it('keeps the content response successful when the catalog is invalid or unavailable', async () => {
    const readSupportedLanguages = vi
      .fn()
      .mockResolvedValueOnce({ ...catalog, popular: ['unknown'] })
      .mockRejectedValueOnce(new Error('network detail'));
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => ({ installation: null, runtimeTemplate: null }),
      readSupportedLanguages,
    });
    const first = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    await expect(first?.json()).resolves.toMatchObject({ supportedLanguages: null });
    const second = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    await expect(second?.json()).resolves.toMatchObject({ supportedLanguages: null });
  });

  it('keeps the content response successful when the catalog reader throws synchronously', async () => {
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => ({ installation: null, runtimeTemplate: null }),
      readSupportedLanguages: () => {
        throw new Error('network detail');
      },
    });
    const response = await handlers['ssf.system-content-v2.read']?.(context('platform'));
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ supportedLanguages: null });
  });

  it('starts loading the catalog before the content read completes', async () => {
    let finishContent: ((value: { installation: null; runtimeTemplate: null }) => void) | undefined;
    const readSystemV2 = vi.fn(
      () =>
        new Promise<{ installation: null; runtimeTemplate: null }>((resolve) => {
          finishContent = resolve;
        })
    );
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
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => previous,
      writeSystemV2,
      readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.system-content-v2.write']?.(
      writeContext('platform', input)
    );
    expect(response?.status).toBe(422);
    expect(writeSystemV2).not.toHaveBeenCalled();
  });

  it('preserves an unchanged saved locale when the catalog no longer contains it', async () => {
    const previous = systemContent();
    if (!previous.installation) throw new Error('ssf_v2_test_installation_missing');
    previous.installation.localization.locale = 'de-DE';
    const writeSystemV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => previous,
      writeSystemV2,
      readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.system-content-v2.write']?.(
      writeContext('platform', previous)
    );
    expect(response?.status).toBe(200);
    expect(writeSystemV2).toHaveBeenCalledOnce();
  });

  it('rejects system guest-language removals while the catalog is unavailable', async () => {
    const previous = systemContent();
    const input = structuredClone(previous);
    if (!input.runtimeTemplate) throw new Error('ssf_v2_test_runtime_missing');
    input.runtimeTemplate.guestLanguages.pop();
    const writeSystemV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => previous,
      writeSystemV2,
      readSupportedLanguages: async () => {
        throw new Error('catalog unavailable');
      },
    });
    const response = await handlers['ssf.system-content-v2.write']?.(
      writeContext('platform', input)
    );
    expect(response?.status).toBe(422);
    expect(writeSystemV2).not.toHaveBeenCalled();
  });

  it('allows installation text saves with the runtime section omitted when the catalog is unavailable', async () => {
    const previous = systemContent();
    const input = { ...structuredClone(previous), runtimeTemplate: null };
    if (!input.installation) throw new Error('ssf_v2_test_installation_missing');
    input.installation.localization.startpage.enterCode = 'Enter the conversation code';
    const writeSystemV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({
      readSystemV2: async () => previous,
      writeSystemV2,
      readSupportedLanguages: async () => {
        throw new Error('catalog unavailable');
      },
    });
    const response = await handlers['ssf.system-content-v2.write']?.(
      writeContext('platform', input)
    );
    expect(response?.status).toBe(200);
    expect(writeSystemV2).toHaveBeenCalledWith(input);
  });

  it('rejects unsupported tenant staff locale changes before persisting', async () => {
    const writeTenantV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({
      readTenantV2: async () => ({
        runtimeTemplate: systemContent().runtimeTemplate,
        overrides: null,
      }),
      writeTenantV2,
      readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.tenant-content-v2.write']?.(
      writeContext('tenant', { staff: { locale: 'fr' } })
    );
    expect(response?.status).toBe(422);
    expect(writeTenantV2).not.toHaveBeenCalled();
  });

  it('rejects tenant guest-language toggles while the catalog is unavailable', async () => {
    const writeTenantV2 = vi.fn();
    const handlers = createSsfAdminV2Handlers({
      readTenantV2: async () => ({
        runtimeTemplate: systemContent().runtimeTemplate,
        overrides: null,
      }),
      writeTenantV2,
      readSupportedLanguages: async () => {
        throw new Error('catalog unavailable');
      },
    });
    const response = await handlers['ssf.tenant-content-v2.write']?.(
      writeContext('tenant', {
        guestLanguages: [{ locale: 'en', enabled: false }],
      })
    );
    expect(response?.status).toBe(422);
    expect(writeTenantV2).not.toHaveBeenCalled();
  });

  it('allows tenant guest-text edits while the catalog is unavailable', async () => {
    const writeTenantV2 = vi.fn().mockResolvedValue(undefined);
    const handlers = createSsfAdminV2Handlers({
      readTenantV2: async () => ({
        runtimeTemplate: systemContent().runtimeTemplate,
        overrides: null,
      }),
      writeTenantV2,
      readSupportedLanguages: async () => {
        throw new Error('catalog unavailable');
      },
    });
    const response = await handlers['ssf.tenant-content-v2.write']?.(
      writeContext('tenant', {
        guestLanguages: [{ locale: 'en', guest: { explanationHtml: '<p>Text</p>' } }],
      })
    );
    expect(response?.status).toBe(200);
    expect(writeTenantV2).toHaveBeenCalledOnce();
  });
});

describe('SSF administrative revision boundary', () => {
  it('rejects missing and wildcard preconditions before invoking a writer', async () => {
    const writeSystemV2 = vi.fn();
    const handlers = createHandlers({ readSystemV2: async () => systemContent(), writeSystemV2 });
    for (const [revision, status] of [
      [null, 428],
      ['*', 400],
    ] as const) {
      const ctx = writeContext('platform', systemContent());
      if (revision === null) ctx.request.headers.delete('X-SSF-Expected-Content-Revision');
      else ctx.request.headers.set('X-SSF-Expected-Content-Revision', revision);
      expect((await handlers['ssf.system-content-v2.write']!(ctx)).status).toBe(status);
    }
    expect(writeSystemV2).not.toHaveBeenCalled();
  });
  it('returns stale conflicts without a post-commit reread', async () => {
    const readSystemV2 = vi.fn();
    const handlers = createHandlers({
      readSystemV2,
      writeSystemV2: async () => {
        throw new SsfContentRevisionConflict();
      },
    });
    expect(
      (await handlers['ssf.system-content-v2.write']!(writeContext('platform', systemContent())))
        .status
    ).toBe(412);
    expect(readSystemV2).not.toHaveBeenCalled();
  });
  it('hashes saved content separately from an independently changing catalogue', async () => {
    const previous = systemContent();
    const handlers = createHandlers({
      readSystemV2: async () => previous,
      readSupportedLanguages: async () => catalog,
    });
    const response = await handlers['ssf.system-content-v2.read']!(context('platform'));
    expect(response.headers.get('X-SSF-Content-Revision')).toBe(
      createSsfAdminContentRevision('platform', previous)
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('returns the transaction committed view and token without a racing reread', async () => {
    const next = systemContent();
    next.installation!.localization.login.headline = 'Committed login';
    const readSystemV2 = vi.fn();
    const handlers = createHandlers({ readSystemV2, writeSystemV2: async () => next });
    const response = await handlers['ssf.system-content-v2.write']!(writeContext('platform', next));
    expect(response.status).toBe(200);
    expect(response.headers.get('X-SSF-Content-Revision')).toBe(
      createSsfAdminContentRevision('platform', next)
    );
    expect(readSystemV2).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      installation: { localization: { login: { headline: 'Committed login' } } },
    });
  });
  it('maps rejected asynchronous content reads to the existing unavailable state', async () => {
    const handlers = createHandlers({
      readSystemV2: async () => {
        throw new Error('unavailable');
      },
    });
    const response = await handlers['ssf.system-content-v2.read']!(context('platform'));
    expect(response.status).toBe(503);
  });
});
