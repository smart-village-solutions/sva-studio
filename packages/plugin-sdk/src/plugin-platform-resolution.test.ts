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

  it('rejects sdk mismatches, missing browser entries, missing modules, and mismatched plugin ids', () => {
    const sdkMismatchEntry = definePluginCatalogEntry({
      pluginId: 'sdk-mismatch',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/sdk-mismatch',
      manifest: definePluginManifest({
        pluginId: 'sdk-mismatch',
        version: '0.0.1',
        sdkVersion: '9.9.9',
        hostCompatibility: { studioVersionRange: '^0.0.1' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });
    const missingBrowserEntry = definePluginCatalogEntry({
      pluginId: 'missing-browser',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/missing-browser',
      manifest: definePluginManifest({
        pluginId: 'missing-browser',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^0.0.1' },
        entryPoints: {},
      }),
    });
    const missingModuleEntry = definePluginCatalogEntry({
      pluginId: 'missing-module',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/missing-module',
      manifest: definePluginManifest({
        pluginId: 'missing-module',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^0.0.1' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });
    const mismatchedModuleEntry = definePluginCatalogEntry({
      pluginId: 'catalog-plugin-id',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/mismatched-module',
      manifest: definePluginManifest({
        pluginId: 'catalog-plugin-id',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^0.0.1' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });

    const report = resolvePluginCatalog({
      catalog: [sdkMismatchEntry, missingBrowserEntry, missingModuleEntry, mismatchedModuleEntry],
      host: {
        studioVersion: '0.0.1',
        sdkVersion: '0.0.1',
        capabilities: ['routing'],
      },
      resolvePlugin: (entry) => {
        if (entry.pluginId === 'catalog-plugin-id') {
          return createTestPlugin('exported-plugin-id');
        }
        return entry.pluginId === 'missing-module' ? undefined : createTestPlugin(entry.pluginId);
      },
    });

    expect(report.rejectedCatalog).toEqual([
      sdkMismatchEntry,
      missingBrowserEntry,
      missingModuleEntry,
      mismatchedModuleEntry,
    ]);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'plugin_incompatible_sdk_version',
      'plugin_missing_browser_entry',
      'plugin_module_missing',
      'plugin_module_mismatch',
    ]);
  });

  it('supports wildcard, exact, and prerelease-style caret host version ranges', () => {
    const wildcardEntry = definePluginCatalogEntry({
      pluginId: 'wildcard',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/wildcard',
      manifest: definePluginManifest({
        pluginId: 'wildcard',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '*' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });
    const exactEntry = definePluginCatalogEntry({
      pluginId: 'exact',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/exact',
      manifest: definePluginManifest({
        pluginId: 'exact',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '1.2.3' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });
    const prereleaseCaretEntry = definePluginCatalogEntry({
      pluginId: 'caret-pre-1-0',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/caret-pre-1-0',
      manifest: definePluginManifest({
        pluginId: 'caret-pre-1-0',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^0.2.0' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });

    const report = resolvePluginCatalog({
      catalog: [wildcardEntry, exactEntry, prereleaseCaretEntry],
      host: {
        studioVersion: '1.2.3',
        sdkVersion: '0.0.1',
        capabilities: ['routing'],
      },
      resolvePlugin: (entry) => createTestPlugin(entry.pluginId),
    });
    const preOneReport = resolvePluginCatalog({
      catalog: [prereleaseCaretEntry],
      host: {
        studioVersion: '0.2.7',
        sdkVersion: '0.0.1',
        capabilities: ['routing'],
      },
      resolvePlugin: (entry) => createTestPlugin(entry.pluginId),
    });

    expect(report.activeCatalog).toEqual([wildcardEntry, exactEntry]);
    expect(report.rejectedCatalog).toEqual([prereleaseCaretEntry]);
    expect(preOneReport.activeCatalog).toEqual([prereleaseCaretEntry]);
  });

  it('keeps caret ranges on 0.0.x pinned to the same patch line', () => {
    const exactPatchCaretEntry = definePluginCatalogEntry({
      pluginId: 'caret-pre-0-0',
      sourceType: 'workspace',
      enabled: true,
      sourceRef: 'packages/caret-pre-0-0',
      manifest: definePluginManifest({
        pluginId: 'caret-pre-0-0',
        version: '0.0.1',
        sdkVersion: '0.0.1',
        hostCompatibility: { studioVersionRange: '^0.0.1' },
        entryPoints: { browser: './dist/index.js' },
      }),
    });

    const compatibleReport = resolvePluginCatalog({
      catalog: [exactPatchCaretEntry],
      host: {
        studioVersion: '0.0.1',
        sdkVersion: '0.0.1',
        capabilities: ['routing'],
      },
      resolvePlugin: (entry) => createTestPlugin(entry.pluginId),
    });
    const incompatibleReport = resolvePluginCatalog({
      catalog: [exactPatchCaretEntry],
      host: {
        studioVersion: '0.0.99',
        sdkVersion: '0.0.1',
        capabilities: ['routing'],
      },
      resolvePlugin: (entry) => createTestPlugin(entry.pluginId),
    });

    expect(compatibleReport.activeCatalog).toEqual([exactPatchCaretEntry]);
    expect(incompatibleReport.activeCatalog).toEqual([]);
    expect(incompatibleReport.rejectedCatalog).toEqual([exactPatchCaretEntry]);
    expect(incompatibleReport.issues).toContainEqual(
      expect.objectContaining({
        pluginId: 'caret-pre-0-0',
        code: 'plugin_incompatible_studio_version',
      })
    );
  });
});
