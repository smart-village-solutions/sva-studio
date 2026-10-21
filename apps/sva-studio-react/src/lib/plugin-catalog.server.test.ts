import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../packages/plugin-waste-management/src/waste-management.page.js', () => {
  throw new Error('browser_page_evaluated_on_server');
});
vi.mock('../../../../packages/plugin-waste-management/src/plugin.tsx', () => {
  throw new Error('browser_entry_evaluated_on_server');
});
vi.mock('../../../../packages/plugin-ssf/src/admin.page.js', () => {
  throw new Error('ssf_browser_page_evaluated_on_server');
});

import { studioServerPluginCatalogReport } from './plugin-catalog.server.js';

describe('server plugin catalog', () => {
  it('loads the active descriptors without evaluating browser pages', () => {
    const registry = studioServerPluginCatalogReport.snapshot.registry;
    expect(registry.pluginRegistry.has('app-translations')).toBe(true);
    expect(registry.pluginTenantLifecycleRegistry.has('app-translations')).toBe(true);
    expect(registry.pluginRegistry.get('app-translations')?.routes[0]?.path).toBe(
      '/plugins/app-translations'
    );
    expect(
      registry.pluginTenantLifecycleRegistry
        .get('app-translations')
        ?.operations.map(({ operation }) => operation)
    ).toContain('readiness');
    expect(
      studioServerPluginCatalogReport.snapshot.registry.contentTypes.every(
        (definition) => definition.mutations === undefined
      )
    ).toBe(true);
    expect(
      studioServerPluginCatalogReport.snapshot.registry.pluginRegistry.has('waste-management')
    ).toBe(true);
    expect(
      [...studioServerPluginCatalogReport.snapshot.registry.pluginJobTypeRegistry.values()].some(
        (entry) => entry.ownerPluginId === 'waste-management'
      )
    ).toBe(true);
  });
});
