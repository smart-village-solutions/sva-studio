import { describe, expect, it, vi } from 'vitest';
import {
  createBuildTimeRegistry,
  createPluginTenantReadinessReadModel,
  evaluatePluginTenantAccess,
  definePluginManifest,
} from '@sva/plugin-sdk';
import manifest from '../plugin.manifest.json';
import {
  appTranslationsPlugin,
  APP_TRANSLATIONS_LIFECYCLE_JOB,
  APP_TRANSLATIONS_CATALOG_JOB,
} from './descriptor.js';
import { createPluginJobExecutionHandlers } from './server.js';
import type { PluginJobHandlerContext, PluginManifest } from '@sva/plugin-sdk';

const context = (operation: string) =>
  ({
    job: { instanceId: 'tenant-a' },
    tenantLifecycle: { operation },
    throwIfCancellationRequested: vi.fn(),
  }) as unknown as PluginJobHandlerContext;
describe('local multilingual module', () => {
  it('registers a dedicated cancellable catalog job and delegates to the secret-free host callback', async () => {
    expect(
      appTranslationsPlugin.jobTypes?.find((job) => job.jobTypeId === APP_TRANSLATIONS_CATALOG_JOB)
    ).toMatchObject({ startPolicy: 'dedicated', supportsCancellation: true });
    const translateCatalog = vi
      .fn()
      .mockResolvedValue({ resultPayload: { summary: { processedItems: 1 } } });
    const handler = createPluginJobExecutionHandlers({
      readLocalReadiness: vi.fn(),
      translateCatalog,
    })[APP_TRANSLATIONS_CATALOG_JOB]!;
    const input = context('unused');
    await handler(input);
    expect(translateCatalog).toHaveBeenCalledWith(input);
  });
  it('registers namespaced IAM and guarded editor metadata without remote APIs', () => {
    const registry = createBuildTimeRegistry({ plugins: [appTranslationsPlugin] });
    expect(registry.pluginRegistry.has('app-translations')).toBe(true);
    expect(registry.pluginTenantLifecycleRegistry.has('app-translations')).toBe(true);
    const catalogPermissions = [
      'app-translations.catalog.read',
      'app-translations.catalog.write',
      'app-translations.catalog.publish',
    ];
    expect(appTranslationsPlugin.permissions?.map(({ id }) => id)).toEqual(catalogPermissions);
    expect(appTranslationsPlugin.actions?.map(({ id }) => id)).toEqual(catalogPermissions);
    expect(appTranslationsPlugin.moduleIam?.systemRoles[0]?.permissionIds).toEqual(
      catalogPermissions
    );
    expect(appTranslationsPlugin.permissions?.map(({ titleKey }) => titleKey)).toEqual([
      'appTranslations.permissions.catalog.read',
      'appTranslations.permissions.catalog.write',
      'appTranslations.permissions.catalog.publish',
    ]);
    expect(appTranslationsPlugin.moduleIam?.systemRoles[0]?.permissionIds).not.toContain(
      'app-translations.manifestImport'
    );
    expect(appTranslationsPlugin.routes[0]?.path).toBe('/plugins/app-translations');
    expect(appTranslationsPlugin.navigation[0]?.requiredAction).toBe(
      'app-translations.catalog.read'
    );
    expect(appTranslationsPlugin.serverHandlers).toBeUndefined();
    expect(definePluginManifest(manifest as PluginManifest).tenantActivationPolicy).toBe(
      'optional'
    );
  });
  it.each([true, false])(
    'returns local readiness and redacted credential status (%s)',
    async (providerConfigured) => {
      const readLocalReadiness = vi.fn(async () => ({ schemaReady: true, providerConfigured }));
      const handler = createPluginJobExecutionHandlers({ readLocalReadiness })[
        APP_TRANSLATIONS_LIFECYCLE_JOB
      ]!;
      const result = await handler(context('readiness'));
      expect(readLocalReadiness).toHaveBeenCalledWith('tenant-a');
      expect(result?.tenantLifecycle?.checks).toEqual([
        { checkId: 'app-translations.schema', status: 'ready' },
        { checkId: 'app-translations.provider', status: providerConfigured ? 'ready' : 'degraded' },
      ]);
      expect(result?.resultPayload).toEqual({ plugin: { localOnly: true } });
    }
  );
  it('does not grant local access for missing schema evidence', async () => {
    const result = await createPluginJobExecutionHandlers({
      readLocalReadiness: async () => ({ schemaReady: false, providerConfigured: true }),
    })[APP_TRANSLATIONS_LIFECYCLE_JOB]!(context('provision'));
    const definition = createBuildTimeRegistry({
      plugins: [appTranslationsPlugin],
    }).pluginTenantLifecycleRegistry.get('app-translations')!;
    const model = createPluginTenantReadinessReadModel({
      definition,
      activation: {
        activationPolicy: 'optional',
        effectiveActive: true,
        updatedAt: new Date().toISOString(),
      },
      evidence: {
        accessState: 'active',
        readinessStatus: 'blocked',
        desiredOperation: 'provision',
        desiredGeneration: 1,
        completedGeneration: 1,
        readinessRevision: result!.tenantLifecycle!.revision,
        readinessChecks: result!.tenantLifecycle!.checks,
        updatedAt: new Date().toISOString(),
      },
    });
    expect(evaluatePluginTenantAccess(model).allowed).toBe(false);
  });
  it.each(['suspend', 'reactivate'])(
    'completes local %s without a configured provider',
    async (operation) => {
      const readLocalReadiness = vi.fn(async () => ({
        schemaReady: true,
        providerConfigured: false,
      }));
      const result = await createPluginJobExecutionHandlers({ readLocalReadiness })[
        APP_TRANSLATIONS_LIFECYCLE_JOB
      ]!(context(operation));
      expect(readLocalReadiness).toHaveBeenCalledWith('tenant-a');
      expect(result?.resultPayload).toEqual({ plugin: { localOnly: true } });
      expect(result?.tenantLifecycle?.checks).toEqual([
        { checkId: 'app-translations.schema', status: 'ready' },
        { checkId: 'app-translations.provider', status: 'degraded' },
      ]);
    }
  );
  it('keeps missing schema blocking during reactivation', async () => {
    const result = await createPluginJobExecutionHandlers({
      readLocalReadiness: async () => ({ schemaReady: false, providerConfigured: false }),
    })[APP_TRANSLATIONS_LIFECYCLE_JOB]!(context('reactivate'));
    expect(result?.tenantLifecycle?.checks).toContainEqual({
      checkId: 'app-translations.schema',
      status: 'blocked',
    });
  });
  it('rejects unsupported lifecycle operations', async () => {
    const readLocalReadiness = vi.fn();
    await expect(
      createPluginJobExecutionHandlers({ readLocalReadiness })[APP_TRANSLATIONS_LIFECYCLE_JOB]!(
        context('unknown')
      )
    ).rejects.toMatchObject({
      cause: { code: 'app-translations.invalid-lifecycle-context' },
    });
    expect(readLocalReadiness).not.toHaveBeenCalled();
  });
});
