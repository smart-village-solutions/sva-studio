import { describe, expect, it } from 'vitest';

import type { PluginDefinition } from './plugins.js';
import {
  createPluginSnapshot,
  definePluginCatalogEntry,
  definePluginExecutionContextCapabilities,
  definePluginManifest,
} from './plugin-platform-contracts.js';

const createTestPlugin = (): PluginDefinition => ({
  id: 'news',
  displayName: 'News',
  routes: [],
  navigation: [],
  translations: {},
});

const createPlatformTestPlugin = (): PluginDefinition => ({
  id: 'news',
  displayName: 'News administration',
  actions: [
    {
      id: 'news.manage-instances',
      titleKey: 'news.actions.manageInstances',
      accessRequirement: {
        kind: 'platform',
        roles: { mode: 'allOf', values: ['instance_registry_admin'] },
      },
    },
  ],
  routes: [
    {
      id: 'news-instance-management',
      path: '/plugins/news/instances',
      documentation: { kind: 'page', id: 'news.instances', pageType: 'overview' },
      actionId: 'news.manage-instances',
      accessRequirement: {
        kind: 'platform',
        roles: { mode: 'allOf', values: ['instance_registry_admin'] },
      },
      component: () => null,
    },
  ],
  navigation: [
    {
      id: 'news-instance-management-nav',
      to: '/plugins/news/instances',
      titleKey: 'news.navigation.instanceManagement',
      section: 'system',
      actionId: 'news.manage-instances',
      accessRequirement: {
        kind: 'platform',
        roles: { mode: 'allOf', values: ['instance_registry_admin'] },
      },
    },
  ],
  translations: {},
});

describe('plugin platform contracts', () => {
  it('normalizes published plugin manifests into a serializable host contract', () => {
    expect(
      definePluginManifest({
        pluginId: ' news ',
        manifestVersion: 1,
        extensionTier: 'admin',
        tenantActivationPolicy: 'automatic',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: {
          studioVersionRange: '^2.0.0',
          requiredCapabilities: [' routing ', ' jobs '],
        },
        entryPoints: {
          browser: './dist/browser.js',
          server: './dist/server.js',
          jobs: './dist/jobs.js',
        },
        runtimeRequirements: {
          jobs: ' waste-management.operations ',
        },
      })
    ).toEqual({
      pluginId: 'news',
      manifestVersion: 1,
      extensionTier: 'admin',
      tenantActivationPolicy: 'automatic',
      version: '1.2.3',
      sdkVersion: '0.0.1',
      hostCompatibility: {
        studioVersionRange: '^2.0.0',
        requiredCapabilities: ['jobs', 'routing'],
      },
      entryPoints: {
        browser: './dist/browser.js',
        server: './dist/server.js',
        jobs: './dist/jobs.js',
        integrations: undefined,
      },
      runtimeRequirements: {
        jobs: 'waste-management.operations',
      },
    });
  });

  it('rejects manifests without an explicit extension tier', () => {
    expect(() =>
      definePluginManifest({
        pluginId: 'news',
        manifestVersion: 1,
        tenantActivationPolicy: 'optional',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^2.0.0' },
        entryPoints: { browser: './dist/browser.js' },
      } as never)
    ).toThrowError('plugin_manifest_extension_tier_missing:news');
  });

  it('rejects manifests without a supported contract version', () => {
    expect(() =>
      definePluginManifest({
        pluginId: 'news',
        extensionTier: 'feature',
        tenantActivationPolicy: 'optional',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^2.0.0' },
        entryPoints: { browser: './dist/browser.js' },
      } as never)
    ).toThrowError('plugin_manifest_contract_version_missing:news');

    expect(() =>
      definePluginManifest({
        pluginId: 'news',
        manifestVersion: 2,
        extensionTier: 'feature',
        tenantActivationPolicy: 'optional',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^2.0.0' },
        entryPoints: { browser: './dist/browser.js' },
      } as never)
    ).toThrowError('plugin_manifest_contract_version_unsupported:news:2');
  });

  it('rejects missing and unknown tenant activation policies', () => {
    expect(() =>
      definePluginManifest({
        pluginId: 'news',
        manifestVersion: 1,
        extensionTier: 'feature',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^2.0.0' },
        entryPoints: { browser: './dist/browser.js' },
      } as never)
    ).toThrowError('plugin_manifest_activation_policy_missing:news');

    expect(() =>
      definePluginManifest({
        pluginId: 'news',
        manifestVersion: 1,
        extensionTier: 'feature',
        tenantActivationPolicy: 'always',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^2.0.0' },
        entryPoints: { browser: './dist/browser.js' },
      } as never)
    ).toThrowError('plugin_manifest_activation_policy_invalid:news:always');
  });

  it('rejects unknown extension tiers', () => {
    expect(() =>
      definePluginManifest({
        pluginId: 'news',
        manifestVersion: 1,
        extensionTier: 'super-admin',
        tenantActivationPolicy: 'optional',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^2.0.0' },
        entryPoints: { browser: './dist/browser.js' },
      } as never)
    ).toThrowError('plugin_manifest_extension_tier_invalid:news:super-admin');
  });

  it('rejects manifests with job entry points but without declared job runtime requirements', () => {
    expect(() =>
      definePluginManifest({
        pluginId: 'waste-management',
        manifestVersion: 1,
        extensionTier: 'feature',
        tenantActivationPolicy: 'optional',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: {
          studioVersionRange: '^2.0.0',
        },
        entryPoints: {
          browser: './dist/browser.js',
          jobs: './dist/jobs.js',
        },
      })
    ).toThrowError('plugin_manifest_job_runtime_requirement_missing:waste-management');
  });

  it('accepts manifests without jobs entry points and without runtime requirements', () => {
    expect(
      definePluginManifest({
        pluginId: 'news',
        manifestVersion: 1,
        extensionTier: 'feature',
        tenantActivationPolicy: 'optional',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: {
          studioVersionRange: '^2.0.0',
        },
        entryPoints: {
          browser: './dist/browser.js',
        },
      })
    ).toEqual({
      pluginId: 'news',
      manifestVersion: 1,
      extensionTier: 'feature',
      tenantActivationPolicy: 'optional',
      version: '1.2.3',
      sdkVersion: '0.0.1',
      hostCompatibility: {
        studioVersionRange: '^2.0.0',
        requiredCapabilities: undefined,
      },
      entryPoints: {
        browser: './dist/browser.js',
        server: undefined,
        jobs: undefined,
        integrations: undefined,
      },
      runtimeRequirements: undefined,
    });
  });

  it('sorts required capabilities with locale-aware ordering', () => {
    expect(
      definePluginManifest({
        pluginId: 'news',
        manifestVersion: 1,
        extensionTier: 'feature',
        tenantActivationPolicy: 'optional',
        version: '1.2.3',
        sdkVersion: '0.0.1',
        hostCompatibility: {
          studioVersionRange: '^2.0.0',
          requiredCapabilities: ['z-capability', 'ä-capability'],
        },
        entryPoints: {
          browser: './dist/browser.js',
        },
      }).hostCompatibility.requiredCapabilities
    ).toEqual(['ä-capability', 'z-capability']);
  });

  it('creates catalog entries for local and installed plugin sources', () => {
    expect(
      definePluginCatalogEntry({
        pluginId: ' news ',
        sourceType: 'workspace',
        enabled: true,
        sourceRef: 'packages/plugin-news',
        manifest: definePluginManifest({
          pluginId: 'news',
          manifestVersion: 1,
          extensionTier: 'feature',
          tenantActivationPolicy: 'optional',
          version: '1.0.0',
          sdkVersion: '0.0.1',
          hostCompatibility: { studioVersionRange: '^2.0.0' },
          entryPoints: { browser: './dist/browser.js' },
        }),
      })
    ).toEqual(
      expect.objectContaining({
        pluginId: 'news',
        sourceType: 'workspace',
        enabled: true,
        sourceRef: 'packages/plugin-news',
      })
    );
  });

  it('materializes local and installed plugins into one canonical host snapshot', () => {
    const manifest = definePluginManifest({
      pluginId: 'news',
      manifestVersion: 1,
      extensionTier: 'feature',
      tenantActivationPolicy: 'optional',
      version: '1.0.0',
      sdkVersion: '0.0.1',
      hostCompatibility: { studioVersionRange: '^2.0.0' },
      entryPoints: { browser: './dist/browser.js' },
    });
    const workspaceEntry = definePluginCatalogEntry({
      pluginId: 'news',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/plugin-news',
      manifest,
    });

    const snapshot = createPluginSnapshot({
      catalog: [workspaceEntry],
      loadedPlugins: [{ catalogEntry: workspaceEntry, plugin: createTestPlugin() }],
    });

    expect(snapshot.catalog).toEqual([workspaceEntry]);
    expect(snapshot.pluginSources).toEqual([
      {
        pluginId: 'news',
        sourceType: 'workspace',
        sourceRef: 'packages/plugin-news',
        manifest,
      },
    ]);
    expect(snapshot.tenantActivationPolicySnapshot).toEqual({
      revision: 'news:optional:1:1.0.0:1:optional',
      modules: [
        {
          moduleId: 'news',
          activationPolicy: 'optional',
          manifestVersion: 1,
          policyRevision: '1.0.0:1:optional',
        },
      ],
    });
    expect(snapshot.registry.plugins.map((plugin) => plugin.id)).toEqual(['news']);
  });

  it('passes the manifest extension tier into snapshot contribution validation', () => {
    const manifest = definePluginManifest({
      pluginId: 'news',
      manifestVersion: 1,
      extensionTier: 'admin',
      tenantActivationPolicy: 'automatic',
      version: '1.0.0',
      sdkVersion: '0.0.1',
      hostCompatibility: { studioVersionRange: '^2.0.0' },
      entryPoints: { browser: './dist/browser.js' },
    });
    const entry = definePluginCatalogEntry({
      pluginId: 'news',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/plugin-news',
      manifest,
    });

    expect(() =>
      createPluginSnapshot({
        catalog: [entry],
        loadedPlugins: [{ catalogEntry: entry, plugin: createPlatformTestPlugin() }],
      })
    ).not.toThrow();
  });

  it('defines host-owned execution context capabilities for plugin handlers', () => {
    expect(
      definePluginExecutionContextCapabilities({
        requestContext: true,
        auditReporter: true,
        progressReporter: true,
        secretAccess: false,
      })
    ).toEqual({
      requestContext: true,
      auditReporter: true,
      progressReporter: true,
      secretAccess: false,
    });
  });
});
