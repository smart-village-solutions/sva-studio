import { describe, expect, it, vi } from 'vitest';

import { definePluginManifest } from '@sva/plugin-sdk';

import {
  createStudioPluginCatalogSeed,
  createStudioPluginCatalogReport,
  extractPluginDefinition,
  getPackagePluginModuleCandidates,
  getWorkspacePluginModuleCandidates,
} from './plugin-catalog-loader.js';

describe('plugin catalog loader', () => {
  it('prefers source entries for workspace plugins and manifest entries for packaged plugins', () => {
    const manifest = definePluginManifest({
      pluginId: 'news',
      version: '0.0.1',
      sdkVersion: '0.0.1',
      hostCompatibility: { studioVersionRange: '^0.0.1' },
      entryPoints: { browser: './dist/index.js' },
    });

    expect(getWorkspacePluginModuleCandidates(manifest)).toEqual(['dist/index.js', 'src/index.ts', 'src/index.tsx']);
    expect(getPackagePluginModuleCandidates(manifest)).toEqual(['dist/index.js', 'src/index.ts', 'src/index.tsx']);
  });

  it('builds catalog seeds from config and fails closed on unresolved manifests', () => {
    const manifest = definePluginManifest({
      pluginId: 'news',
      version: '0.0.1',
      sdkVersion: '0.0.1',
      hostCompatibility: { studioVersionRange: '^0.0.1' },
      entryPoints: { browser: './dist/index.js' },
    });

    const seed = createStudioPluginCatalogSeed({
      catalogConfig: [
        {
          pluginId: 'news',
          sourceType: 'workspace',
          enabled: true,
          sourceRef: 'packages/plugin-news',
        },
        {
          pluginId: 'missing',
          sourceType: 'workspace',
          enabled: true,
          sourceRef: 'packages/plugin-missing',
        },
      ],
      resolveManifest: (entry) => (entry.pluginId === 'news' ? manifest : undefined),
    });

    expect(seed.catalog).toEqual([
      expect.objectContaining({
        pluginId: 'news',
        sourceRef: 'packages/plugin-news',
      }),
    ]);
    expect(seed.issues).toContainEqual(
      expect.objectContaining({
        pluginId: 'missing',
        code: 'plugin_module_missing',
      })
    );
  });

  it('creates a compatible snapshot from config, manifests and module exports', async () => {
    const manifest = definePluginManifest({
      pluginId: 'news',
      version: '0.0.1',
      sdkVersion: '0.0.1',
      hostCompatibility: { studioVersionRange: '^0.0.1', requiredCapabilities: ['routing'] },
      entryPoints: { browser: './dist/index.js' },
    });

    const report = await createStudioPluginCatalogReport({
      catalogConfig: [
        {
          pluginId: 'news',
          sourceType: 'workspace',
          enabled: true,
          sourceRef: 'packages/plugin-news',
        },
      ],
      resolveManifest: () => manifest,
      resolvePluginModule: async () => ({
        pluginNews: {
          id: 'news',
          displayName: 'News',
          routes: [],
          navigation: [],
          translations: {},
        },
      }),
    });

    expect(report.snapshot.registry.plugins.map((plugin) => plugin.id)).toEqual(['news']);
    expect(report.issues).toEqual([]);
  });

  it('loads an installed distribution through the same catalog and snapshot contract', async () => {
    const manifest = definePluginManifest({
      pluginId: 'weather',
      version: '1.2.3',
      sdkVersion: '0.0.1',
      hostCompatibility: { studioVersionRange: '^0.0.1', requiredCapabilities: ['routing'] },
      entryPoints: { browser: './dist/index.js' },
    });

    const report = await createStudioPluginCatalogReport({
      catalogConfig: [
        {
          pluginId: 'weather',
          sourceType: 'installed-distribution',
          enabled: true,
          sourceRef: '@vendor/plugin-weather',
        },
      ],
      resolveManifest: () => manifest,
      resolvePluginModule: async () => ({
        pluginWeather: {
          id: 'weather',
          displayName: 'Weather',
          routes: [],
          navigation: [],
          translations: {},
        },
      }),
    });

    expect(report.snapshot.registry.plugins.map((plugin) => plugin.id)).toEqual(['weather']);
    expect(report.activeCatalog).toEqual([
      expect.objectContaining({
        pluginId: 'weather',
        sourceType: 'installed-distribution',
      }),
    ]);
    expect(report.issues).toEqual([]);
  });

  it('fails closed when the manifest cannot be resolved', async () => {
    const report = await createStudioPluginCatalogReport({
      catalogConfig: [
        {
          pluginId: 'weather',
          sourceType: 'installed-distribution',
          enabled: true,
          sourceRef: '@vendor/plugin-weather',
        },
      ],
      resolveManifest: () => undefined,
      resolvePluginModule: async () => undefined,
    });

    expect(report.snapshot.registry.plugins).toHaveLength(0);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        pluginId: 'weather',
        code: 'plugin_module_missing',
        severity: 'error',
      })
    );
  });

  it('does not load plugin modules for disabled catalog entries', async () => {
    const manifest = definePluginManifest({
      pluginId: 'news',
      version: '0.0.1',
      sdkVersion: '0.0.1',
      hostCompatibility: { studioVersionRange: '^0.0.1', requiredCapabilities: ['routing'] },
      entryPoints: { browser: './dist/index.js' },
    });
    const resolvePluginModule = vi.fn(async () => ({
      pluginNews: {
        id: 'news',
        displayName: 'News',
        routes: [],
        navigation: [],
        translations: {},
      },
    }));

    const report = await createStudioPluginCatalogReport({
      catalogConfig: [
        {
          pluginId: 'news',
          sourceType: 'workspace',
          enabled: false,
          sourceRef: 'packages/plugin-news',
        },
      ],
      resolveManifest: () => manifest,
      resolvePluginModule,
    });

    expect(report.snapshot.registry.plugins).toHaveLength(0);
    expect(resolvePluginModule).not.toHaveBeenCalled();
  });

  it('extracts plugin definitions from named exports only when they match the public contract', () => {
    expect(
      extractPluginDefinition({
        helper: { foo: 'bar' },
        pluginNews: {
          id: 'news',
          displayName: 'News',
          routes: [],
          navigation: [],
          translations: {},
        },
      })
    ).toMatchObject({
      id: 'news',
      displayName: 'News',
    });
    expect(
      extractPluginDefinition({
        metadata: {
          id: 'news',
          displayName: 'News',
          version: '1.0.0',
        },
      })
    ).toBeUndefined();
    expect(extractPluginDefinition({ helper: { foo: 'bar' } })).toBeUndefined();
  });
});
