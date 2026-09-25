import { describe, expect, it } from 'vitest';

import {
  filterModuleContractsForDistribution,
  filterPluginCatalogForDistribution,
  resolveStudioDistribution,
} from './studio-distribution.js';

const catalog = [
  { pluginId: 'news', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-news' },
  { pluginId: 'ssf', sourceType: 'workspace', enabled: true, sourceRef: 'packages/plugin-ssf' },
] as const;

describe('studio distribution', () => {
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

  it('rejects unknown distributions', () => {
    expect(() => resolveStudioDistribution('other')).toThrow('invalid_studio_distribution:other');
  });
});
