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

describe('plugin platform contracts', () => {
  it('normalizes published plugin manifests into a serializable host contract', () => {
    expect(
      definePluginManifest({
        pluginId: ' news ',
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
      },
      runtimeRequirements: {
        jobs: 'waste-management.operations',
      },
    });
  });

  it('rejects manifests with job entry points but without declared job runtime requirements', () => {
    expect(() =>
      definePluginManifest({
        pluginId: 'waste-management',
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

  it('creates catalog entries for local and installed plugin sources', () => {
    expect(
      definePluginCatalogEntry({
        pluginId: ' news ',
        sourceType: 'workspace',
        enabled: true,
        sourceRef: 'packages/plugin-news',
        manifest: definePluginManifest({
          pluginId: 'news',
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
    expect(snapshot.registry.plugins.map((plugin) => plugin.id)).toEqual(['news']);
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
