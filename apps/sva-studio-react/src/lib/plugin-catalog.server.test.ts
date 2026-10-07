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
