import { build, loadConfigFromFile } from 'vite';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  filterModuleContractsForDistribution,
  filterPluginCatalogForDistribution,
  resolveStudioDistribution,
  resolveStudioPluginIds,
} from './studio-distribution.js';

const catalog = [
  { pluginId: 'news', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-news' },
  { pluginId: 'ssf', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-ssf' },
] as const;

describe('studio distribution', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('bundles SSF provisioning when the injected package has no compiled artifacts', async () => {
    vi.stubEnv('SVA_STUDIO_DISTRIBUTION', 'ssf');
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' }, join(process.cwd(), 'vite.config.ts')
    );
    const root = mkdtempSync(join(tmpdir(), 'ssf-provisioning-build-'));
    try {
      const injected = join(root, 'node_modules/@sva/plugin-ssf');
      mkdirSync(injected, { recursive: true });
      writeFileSync(join(injected, 'package.json'), JSON.stringify({
        name: '@sva/plugin-ssf', type: 'module', exports: { './provisioning': './dist/provisioning.js' },
      }));
      const entry = join(root, 'entry.ts');
      writeFileSync(entry, "export { SSF_LOGIN_CLIENT_ID as clientId } from '@sva/plugin-ssf/provisioning';");
      const output = await build({
        configFile: false, root, logLevel: 'silent', resolve: loaded?.config.resolve,
        build: { ssr: entry, write: false, minify: false },
      });
      if (!('output' in output)) throw new Error('ssf_test_build_output_missing');
      const chunk = output.output.find((item) => item.type === 'chunk');
      expect(chunk?.code).toContain('ssf-frontend');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads the authorization dispatcher and host from the same runtime package', async () => {
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      join(process.cwd(), 'vite.config.ts')
    );
    const external = loaded?.config.build?.rolldownOptions?.external;
    expect(Array.isArray(external)).toBe(true);
    for (const entry of ['@sva/auth-runtime/server', '@sva/auth-runtime/plugin-server-host']) {
      expect(
        (external as (string | RegExp)[]).some((rule) =>
          typeof rule === 'string' ? rule === entry : rule.test(entry)
        ),
        `${entry} must share the external authorization runtime`
      ).toBe(true);
    }
  });

  it('selects content-capable route bindings for the mixed custom build', async () => {
    vi.stubEnv('SVA_STUDIO_DISTRIBUTION', 'custom');
    vi.stubEnv('SVA_STUDIO_PLUGIN_IDS', 'categories,news,ssf');
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      join(process.cwd(), 'vite.config.ts')
    );
    const aliases = loaded?.config.resolve?.alias as Record<string, string>;
    expect(aliases['#studio-app-route-bindings']).toBe(
      join(process.cwd(), 'src/routing/app-route-bindings.tsx')
    );
  });

  it('excludes SSF from the default Studio distribution', () => {
    expect(resolveStudioDistribution(undefined)).toBe('studio');
    expect(filterPluginCatalogForDistribution(catalog, 'studio')).toEqual([catalog[0]]);
    expect(
      filterModuleContractsForDistribution(
        ['news', 'ssf', 'media'].map((moduleId) => ({ moduleId })),
        'studio'
      )
    ).toEqual([{ moduleId: 'news' }, { moduleId: 'media' }]);
  });

  it('includes only SSF and media in the SSF distribution', () => {
    expect(filterPluginCatalogForDistribution(catalog, 'ssf')).toEqual([catalog[1]]);
    expect(
      filterModuleContractsForDistribution(
        ['news', 'ssf', 'media'].map((moduleId) => ({ moduleId })),
        'ssf'
      )
    ).toEqual([{ moduleId: 'ssf' }, { moduleId: 'media' }]);
  });

  it('keeps installed packages selected by the build profile in both distributions', () => {
    const installed = {
      pluginId: 'calendar',
      sourceType: 'installed-distribution',
      enabled: true,
      sourceRef: '@vendor/calendar',
    } as const;
    expect(filterPluginCatalogForDistribution([...catalog, installed], 'studio')).toEqual([
      catalog[0],
      installed,
    ]);
    expect(filterPluginCatalogForDistribution([...catalog, installed], 'ssf')).toEqual([
      catalog[1],
      installed,
    ]);
  });

  it('rejects unknown distributions', () => {
    expect(() => resolveStudioDistribution('other')).toThrow('invalid_studio_distribution:other');
  });

  it('canonicalizes a custom selection and retains only its plugin and host media contract', () => {
    expect(resolveStudioDistribution(undefined, 'ssf,news')).toBe('custom');
    const selected = resolveStudioPluginIds('custom', 'ssf,news', ['news', 'ssf']);
    expect(selected).toEqual(['news', 'ssf']);
    expect(filterPluginCatalogForDistribution(catalog, 'custom', selected)).toEqual(catalog);
    expect(
      filterModuleContractsForDistribution(
        ['news', 'ssf', 'media', 'events'].map((moduleId) => ({ moduleId })),
        'custom',
        selected
      )
    ).toEqual([{ moduleId: 'news' }, { moduleId: 'ssf' }, { moduleId: 'media' }]);
  });

  it('rejects empty, duplicate, unknown, and conflicting selections', () => {
    expect(() => resolveStudioPluginIds('custom', '', ['news'])).toThrow(
      'studio_plugin_selection_required'
    );
    expect(() => resolveStudioPluginIds('custom', 'news,news', ['news'])).toThrow(
      'studio_plugin_selection_duplicate'
    );
    expect(() => resolveStudioPluginIds('custom', 'unknown', ['news'])).toThrow(
      'studio_plugin_selection_unknown:unknown'
    );
    expect(() => resolveStudioDistribution('studio', 'news')).toThrow(
      'studio_distribution_and_plugin_selection_conflict:studio'
    );
  });
});
