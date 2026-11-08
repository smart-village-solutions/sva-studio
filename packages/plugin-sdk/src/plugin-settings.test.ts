/** Settings contributions and authenticated reads stay module-bound. */
import { describe, expect, it } from 'vitest';
import { createPluginRegistry, type PluginDefinition } from './plugins.js';
const requirement = {
  kind: 'tenant',
  moduleId: 'workspace',
  actions: { mode: 'allOf', values: ['workspace.settings.read'] },
} as const;
const plugin: PluginDefinition = {
  id: 'workspace',
  displayName: 'Workspace',
  moduleIam: { moduleId: 'workspace', permissionIds: ['workspace.settings.read'], systemRoles: [] },
  permissions: [{ id: 'workspace.settings.read', titleKey: 'read' }],
  actions: [
    { id: 'workspace.read', titleKey: 'read', accessRequirement: { kind: 'authenticated' } },
    { id: 'workspace.settings.read', titleKey: 'read', accessRequirement: requirement },
  ],
  routes: [
    {
      id: 'workspace.settings',
      path: '/plugins/workspace/settings',
      documentation: { kind: 'page', id: 'workspace.settings', pageType: 'detail' },
      actionId: 'workspace.settings.read',
      accessRequirement: requirement,
      component: () => null,
    },
  ],
  settings: { routeId: 'workspace.settings' },
  serverHandlers: [
    {
      id: 'workspace.list',
      path: '/api/v1/plugins/workspace',
      method: 'GET',
      actionId: 'workspace.read',
      accessRequirement: { kind: 'authenticated' },
    },
  ],
};
describe('plugin settings', () => {
  it('keeps a validated settings route and authenticated read in the registry', () => {
    expect(createPluginRegistry([plugin]).get('workspace')?.settings).toEqual(plugin.settings);
  });
  it('rejects missing and foreign routes', () => {
    expect(() =>
      createPluginRegistry([{ ...plugin, settings: { routeId: 'foreign.settings' } }])
    ).toThrow('invalid_plugin_settings_route');
  });
  it('requires a tenant action for settings', () => {
    expect(() =>
      createPluginRegistry([
        {
          ...plugin,
          routes: [
            {
              ...plugin.routes[0]!,
              actionId: 'workspace.read',
              accessRequirement: { kind: 'authenticated' },
            },
          ],
        },
      ])
    ).toThrow('invalid_plugin_settings_route');
  });
  it('does not permit authenticated mutations', () => {
    expect(() =>
      createPluginRegistry([
        { ...plugin, serverHandlers: [{ ...plugin.serverHandlers![0]!, method: 'PUT' }] },
      ])
    ).toThrow('plugin_authenticated_handler_read_only');
  });
  it('requires a module contract for authenticated plugin contributions', () => {
    expect(() => createPluginRegistry([{ ...plugin, moduleIam: undefined }])).toThrow(
      'plugin_access_requirement_scope_invalid'
    );
  });
});

describe('declarative plugin shell contributions', () => {
  const route = { ...plugin.routes[0]!, layout: 'content-only' as const };
  const navigation = {
    id: 'workspace.header',
    section: 'header' as const,
    icon: 'grid-dots' as const,
    to: route.path,
    titleKey: 'read',
    actionId: route.actionId,
    accessRequirement: requirement,
  };
  const withShell = { ...plugin, routes: [route], navigation: [navigation] };
  it('retains the declared layout and owned header entry', () => {
    const validated = createPluginRegistry([withShell]).get('workspace');
    expect(validated?.routes[0]?.layout).toBe('content-only');
    expect(validated?.navigation?.[0]?.section).toBe('header');
  });
  it.each([
    { ...navigation, to: '/plugins/foreign/overview' },
    { ...navigation, icon: 'unknown' },
    { ...navigation, actionId: 'workspace.read' },
    { ...navigation, href: 'https://example.org' },
  ])('rejects unowned or inconsistent header contributions', (entry) => {
    expect(() =>
      createPluginRegistry([{ ...withShell, navigation: [entry] } as PluginDefinition])
    ).toThrow();
  });
  it('rejects arbitrary layouts and glyphs on sidebar entries', () => {
    expect(() =>
      createPluginRegistry([
        { ...withShell, routes: [{ ...route, layout: 'arbitrary' } as unknown as typeof route] },
      ])
    ).toThrow('plugin_route_layout_invalid');
    expect(() =>
      createPluginRegistry([{ ...withShell, navigation: [{ ...navigation, section: 'system' }] }])
    ).toThrow('plugin_navigation_icon_invalid');
  });
});
