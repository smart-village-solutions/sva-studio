import { describe, expect, it } from 'vitest';

import type { PluginDefinition } from './plugins.js';
import { definePluginCatalogEntry, definePluginManifest } from './plugin-platform-contracts.js';
import { resolvePluginCatalog } from './plugin-platform-resolution.js';

const createTestPlugin = (pluginId: string): PluginDefinition => ({
  id: pluginId,
  displayName: pluginId,
  routes: [],
  navigation: [],
  translations: {},
});

describe('plugin platform resolution', () => {
  it('keeps disabled plugins out of the published snapshot', () => {
    const entry = definePluginCatalogEntry({
      pluginId: 'news',
      sourceType: 'workspace',
      enabled: false,
      sourceRef: 'packages/plugin-news',
      manifest: definePluginManifest({
        pluginId: 'news',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^0.0.1' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });

    const report = resolvePluginCatalog({
      catalog: [entry],
      host: {
        studioVersion: '0.0.1',
        sdkVersion: '0.0.1',
        capabilities: ['routing'],
      },
      resolvePlugin: () => createTestPlugin('news'),
    });

    expect(report.snapshot.registry.plugins).toHaveLength(0);
    expect(report.inactiveCatalog).toEqual([entry]);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'plugin_disabled',
        severity: 'info',
      })
    );
  });

  it('materializes only compatible plugins into the active snapshot', () => {
    const activeEntry = definePluginCatalogEntry({
      pluginId: 'news',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/plugin-news',
      manifest: definePluginManifest({
        pluginId: 'news',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: {
          studioVersionRange: '^0.0.1',
          requiredCapabilities: ['routing'],
        },
        entryPoints: { browser: './dist/index.js' },
      }),
    });
    const incompatibleEntry = definePluginCatalogEntry({
      pluginId: 'weather',
      sourceType: 'installed-distribution',
      enabled: true,
      sourceRef: '@vendor/plugin-weather',
      manifest: definePluginManifest({
        pluginId: 'weather',
        version: '2.0.0',
        sdkVersion: '0.0.1',
        hostCompatibility: {
          studioVersionRange: '^2.0.0',
          requiredCapabilities: ['routing'],
        },
        entryPoints: { browser: './dist/index.js' },
      }),
    });

    const report = resolvePluginCatalog({
      catalog: [activeEntry, incompatibleEntry],
      host: {
        studioVersion: '0.0.1',
        sdkVersion: '0.0.1',
        capabilities: ['routing'],
      },
      resolvePlugin: (entry) => createTestPlugin(entry.pluginId),
    });

    expect(report.snapshot.registry.plugins.map((plugin) => plugin.id)).toEqual(['news']);
    expect(report.activeCatalog).toEqual([activeEntry]);
    expect(report.rejectedCatalog).toEqual([incompatibleEntry]);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        pluginId: 'weather',
        code: 'plugin_incompatible_studio_version',
        severity: 'error',
      })
    );
  });

  it('rejects plugins that require unsupported host capabilities', () => {
    const entry = definePluginCatalogEntry({
      pluginId: 'waste-management',
      sourceType: 'linked-package',
      enabled: true,
      sourceRef: '@sva/plugin-waste-management',
      manifest: definePluginManifest({
        pluginId: 'waste-management',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: {
          studioVersionRange: '^0.0.1',
          requiredCapabilities: ['integrations'],
        },
        entryPoints: { browser: './dist/index.js' },
      }),
    });

    const report = resolvePluginCatalog({
      catalog: [entry],
      host: {
        studioVersion: '0.0.1',
        sdkVersion: '0.0.1',
        capabilities: ['routing', 'jobs'],
      },
      resolvePlugin: () => createTestPlugin('waste-management'),
    });

    expect(report.snapshot.registry.plugins).toHaveLength(0);
    expect(report.rejectedCatalog).toEqual([entry]);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'plugin_missing_host_capability',
        severity: 'error',
      })
    );
  });
});
