import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../packages/plugin-waste-management/src/waste-management.page.js', () => {
  throw new Error('browser_page_evaluated_on_server');
});
vi.mock('../../../../packages/plugin-waste-management/src/plugin.tsx', () => {
  throw new Error('browser_entry_evaluated_on_server');
});
vi.mock('../../../../packages/plugin-search/src/search-page.js', () => {
  throw new Error('search_browser_page_evaluated_on_server');
});
vi.mock('../../../../packages/plugin-ssf/src/admin.page.js', () => {
  throw new Error('ssf_browser_page_evaluated_on_server');
});

import { studioHostModuleContracts } from '#studio-module-iam-inputs';
import { studioServerPluginCatalogReport } from './plugin-catalog.server.js';
import { resolveInstalledPluginSources } from '../../plugin-installed-inputs.vite.js';

describe('server plugin catalog', () => {
  it('excludes the installed Studio workspace from the SSF profile', () => {
    expect(resolveInstalledPluginSources(process.cwd(), 'ssf').map(({ catalog }) => catalog.pluginId))
      .not.toContain('application-workspace');
  });

  it('registers the installed application workspace in the Studio distribution', () => {
    const registry = studioServerPluginCatalogReport.snapshot.registry;
    const plugin = registry.pluginRegistry.get('application-workspace');
    expect(plugin?.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/plugins/application-workspace', layout: 'content-only' }),
      expect.objectContaining({ path: '/plugins/application-workspace/settings' }),
    ]));
    expect(registry.pluginServerHandlerRegistry.get('application-workspace.list')?.path).toBe(
      '/api/v1/plugins/application-workspace'
    );
    expect(registry.pluginServerHandlerRegistry.get('application-workspace.settings.save')?.method).toBe('PUT');
  });

  it('registers the host App module as a tenant dependency of Mehrsprachigkeit', () => {
    const { pluginModuleIamContracts } = studioServerPluginCatalogReport.snapshot.registry;
    expect(
      pluginModuleIamContracts.find(({ moduleId }) => moduleId === 'app-translations')
    ).toMatchObject({ requiredTenantModuleIds: ['app'] });
    expect(studioHostModuleContracts.some(({ moduleId }) => moduleId === 'app')).toBe(true);
  });

  it('loads the active descriptors without evaluating browser pages', () => {
    const registry = studioServerPluginCatalogReport.snapshot.registry;
    expect(registry.pluginRegistry.has('app-translations')).toBe(true);
    expect(registry.pluginRegistry.get('search')?.routes[0]?.path).toBe('/plugins/search');
    expect(registry.pluginServerHandlerRegistry.get('search.query')?.path).toBe(
      '/api/v1/plugins/search/query'
    );
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
