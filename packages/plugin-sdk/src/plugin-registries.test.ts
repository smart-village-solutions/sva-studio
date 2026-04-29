import { describe, expect, it } from 'vitest';

import {
  createAdminResourceRegistry,
  createBuildTimeRegistry,
  createContentTypeRegistry,
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginModuleIamRegistry,
  createPluginGuardrailError,
  createPluginPermissionRegistry,
  createPluginRegistry,
  definePluginActions,
  definePluginAdminResources,
  definePluginAuditEvents,
  definePluginModuleIamContract,
  definePluginContentTypes,
  definePluginPermissions,
  getContentTypeDefinition,
  mergeAdminResourceDefinitions,
  mergePluginActions,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginModuleIamContracts,
  mergePluginNavigationItems,
  mergePluginPermissions,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
  type PluginDefinition,
} from './index.js';

const component = () => null;

const newsPlugin: PluginDefinition = {
  id: 'news',
  displayName: 'News',
  routes: [
    {
      id: 'news-list',
      path: '/plugins/news',
      guard: 'news.read',
      actionId: 'news.read',
      component,
    },
  ],
  navigation: [
    {
      id: 'news-nav',
      to: '/plugins/news',
      titleKey: 'news.nav',
      section: 'dataManagement',
      actionId: 'news.read',
      requiredAction: 'news.read',
    },
  ],
  actions: [
    {
      id: 'news.read',
      titleKey: 'news.actions.read',
      requiredAction: 'news.read',
      featureFlag: ' news-enabled ',
      legacyAliases: ['news-read'],
    },
    {
      id: 'news.create',
      titleKey: 'news.actions.create',
      requiredAction: 'news.create',
    },
  ],
  permissions: [
    { id: 'news.read', titleKey: 'news.permissions.read' },
    { id: 'news.create', titleKey: 'news.permissions.create' },
  ],
  contentTypes: [
    {
      contentType: 'news.article',
      displayName: 'Article',
      editorFields: [{ key: 'title', label: 'Title', kind: 'text' }],
    },
  ],
  adminResources: [
    {
      resourceId: 'news.sources',
      basePath: '/sources/',
      titleKey: 'news.sources.title',
      guard: 'content',
      views: {
        list: { bindingKey: 'news.sources.list' },
        create: { bindingKey: 'news.sources.create' },
        detail: { bindingKey: 'news.sources.detail' },
        history: { bindingKey: 'news.sources.history' },
      },
    },
  ],
  auditEvents: [{ eventType: 'news.created', titleKey: 'news.audit.created' }],
  moduleIam: definePluginModuleIamContract('news', {
    moduleId: 'news',
    permissionIds: ['news.read', 'news.create'],
    systemRoles: [
      { roleName: 'app_manager', permissionIds: ['news.read'] },
      { roleName: 'editor', permissionIds: ['news.read', 'news.create'] },
    ],
  }),
  translations: {
    de: {
      news: {
        nav: 'Nachrichten',
        actions: { read: 'Lesen' },
      },
    },
  },
};

describe('plugin registries', () => {
  it('normalizes and merges plugin registry contracts', () => {
    const registry = createPluginRegistry([{ ...newsPlugin, id: ' news ', displayName: ' News ' }]);

    expect([...registry.keys()]).toEqual(['news']);
    expect(registry.get('news')?.displayName).toBe('News');
    expect(mergePluginRouteDefinitions([...registry.values()])).toHaveLength(1);
    expect(mergePluginNavigationItems([...registry.values()])).toHaveLength(1);
    expect(mergePluginActions([...registry.values()])).toHaveLength(2);
    expect(mergePluginPermissions([...registry.values()])).toHaveLength(2);
    expect(mergePluginContentTypes([...registry.values()])).toHaveLength(1);
    expect(mergePluginAdminResourceDefinitions([...registry.values()])).toHaveLength(1);
    expect(mergePluginAuditEventDefinitions([...registry.values()])).toHaveLength(1);
    expect(mergePluginModuleIamContracts([...registry.values()])).toHaveLength(1);
    expect(mergePluginTranslations([...registry.values()]).de).toEqual({
      news: {
        nav: 'Nachrichten',
        actions: { read: 'Lesen' },
      },
    });
  });

  it('builds action and audit registries including legacy aliases', () => {
    const actions = createPluginActionRegistry([newsPlugin]);
    const permissions = createPluginPermissionRegistry([newsPlugin]);
    const modules = createPluginModuleIamRegistry([newsPlugin]);
    const readAction = actions.get('news.read');
    const legacyAction = actions.get('news-read');
    const auditEvents = createPluginAuditEventRegistry([newsPlugin]);

    expect(readAction).toMatchObject({
      actionId: 'news.read',
      namespace: 'news',
      actionName: 'read',
      ownerPluginId: 'news',
      featureFlag: 'news-enabled',
      legacyAliases: ['news-read'],
    });
    expect(legacyAction).toMatchObject({
      actionId: 'news.read',
      deprecatedAlias: 'news-read',
    });
    expect(auditEvents.get('news.created')).toMatchObject({
      namespace: 'news',
      eventName: 'created',
      ownerPluginId: 'news',
    });
    expect(permissions.get('news.read')).toMatchObject({
      permissionId: 'news.read',
      namespace: 'news',
      permissionName: 'read',
      ownerPluginId: 'news',
    });
    expect(modules.get('news')).toMatchObject({
      moduleId: 'news',
      ownerPluginId: 'news',
      permissionIds: ['news.read', 'news.create'],
      systemRoles: [
        { roleName: 'app_manager', permissionIds: ['news.read'] },
        { roleName: 'editor', permissionIds: ['news.read', 'news.create'] },
      ],
    });
  });

  it('builds the complete build-time registry from plugin and host resources', () => {
    const registry = createBuildTimeRegistry({
      plugins: [newsPlugin],
      adminResources: [
        {
          resourceId: 'host.reports',
          basePath: 'reports',
          titleKey: 'host.reports.title',
          guard: 'content',
          views: {
            list: { bindingKey: 'host.reports.list' },
            create: { bindingKey: 'host.reports.create' },
            detail: { bindingKey: 'host.reports.detail' },
          },
        },
      ],
    });

    expect(registry.plugins).toHaveLength(1);
    expect([...registry.pluginRegistry.keys()]).toEqual(['news']);
    expect(registry.routes).toHaveLength(1);
    expect(registry.navigation).toHaveLength(1);
    expect(registry.pluginActionRegistry.get('news.read')).toMatchObject({
      actionId: 'news.read',
      ownerPluginId: 'news',
    });
    expect(registry.pluginPermissions).toHaveLength(2);
    expect(registry.pluginPermissionRegistry.get('news.read')).toMatchObject({
      permissionId: 'news.read',
      ownerPluginId: 'news',
    });
    expect(registry.pluginModuleIamRegistry.get('news')).toMatchObject({
      moduleId: 'news',
      ownerPluginId: 'news',
    });
    expect(registry.pluginModuleIamContracts).toEqual([
      expect.objectContaining({
        moduleId: 'news',
        ownerPluginId: 'news',
      }),
    ]);
    expect(registry.contentTypes).toHaveLength(1);
    expect(registry.auditEvents).toHaveLength(1);
    expect(registry.pluginAuditEventRegistry.get('news.created')).toMatchObject({
      eventType: 'news.created',
      ownerPluginId: 'news',
    });
    expect(registry.translations.de).toEqual({
      news: {
        nav: 'Nachrichten',
        actions: { read: 'Lesen' },
      },
    });
    expect(registry.adminResources.map((resource) => resource.resourceId)).toEqual(['news.sources', 'host.reports']);
    expect(registry.adminResourceRegistry.has('news.sources')).toBe(true);
    expect(registry.adminResourceRegistry.has('host.reports')).toBe(true);
  });

  it('rejects admin resources whose specialized content type is not registered in the build-time snapshot', () => {
    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            routes: [],
            adminResources: definePluginAdminResources('news', [
              {
                resourceId: 'news.content',
                basePath: 'news',
                titleKey: 'news.nav',
                guard: 'content',
                views: {
                  list: { bindingKey: 'content' },
                  create: { bindingKey: 'contentCreate' },
                  detail: { bindingKey: 'contentDetail' },
                },
                contentUi: {
                  contentType: 'news.missing',
                  bindings: {
                    list: { bindingKey: 'news.list' },
                    editor: { bindingKey: 'news.editor' },
                  },
                },
              },
            ]),
          },
        ],
      })
    ).toThrow('unknown_admin_resource_content_type:news.content:news.missing');
  });

  it('creates deterministic plugin guardrail errors', () => {
    expect(
      createPluginGuardrailError({
        code: 'plugin_guardrail_route_bypass',
        pluginNamespace: 'news',
        contributionId: 'news.list',
        fieldOrReason: 'beforeLoad',
      }).message
    ).toBe('plugin_guardrail_route_bypass:news:news.list:beforeLoad');
  });

  it('rejects invalid plugin action definitions', () => {
    expect(() => definePluginActions('', [])).toThrow('invalid_plugin_action_namespace');
    expect(() => definePluginActions('core', [])).toThrow('reserved_plugin_action_namespace:core');
    expect(() => definePluginActions('news', [{ id: 'content.read', titleKey: 'x' }])).toThrow(
      'plugin_action_namespace_mismatch:news:content:content.read'
    );
    expect(() => definePluginActions('news', [{ id: 'news.read', titleKey: '' }])).toThrow(
      'invalid_plugin_action_definition:news.read'
    );
    expect(() =>
      definePluginActions('news', [
        {
          id: 'news.read',
          titleKey: 'news.read',
          legacyAliases: ['news-read', 'news-read'],
        },
      ])
    ).toThrow('duplicate_plugin_action_alias:news.read:news-read');
    expect(() =>
      definePluginActions('news', [{ id: 'news.read', titleKey: 'news.read', legacyAliases: ['bad.alias'] }])
    ).toThrow('invalid_plugin_action_alias:news.read');
  });

  it('rejects invalid plugin module IAM contracts', () => {
    expect(() =>
      definePluginModuleIamContract('news', {
        moduleId: 'events',
        permissionIds: ['news.read'],
        systemRoles: [],
      })
    ).toThrow('plugin_module_iam_module_id_mismatch:news:events');

    expect(() =>
      definePluginModuleIamContract('news', {
        moduleId: 'news',
        permissionIds: ['events.read'],
        systemRoles: [],
      })
    ).toThrow('plugin_module_iam_permission_namespace_mismatch:news:events:events.read');
  });

  it('rejects invalid plugin permission definitions and references', () => {
    expect(() => definePluginPermissions('content', [])).toThrow('reserved_plugin_permission_namespace:content');
    expect(() => definePluginPermissions('n', [])).toThrow('invalid_plugin_namespace:n');
    expect(() => definePluginPermissions('news', [{ id: 'content.read', titleKey: 'x' }])).toThrow(
      'plugin_permission_namespace_mismatch:news:content:content.read'
    );
    expect(() => definePluginPermissions('news', [{ id: 'news.read', titleKey: '' }])).toThrow(
      'invalid_plugin_permission_definition:news.read'
    );
    expect(() =>
      definePluginPermissions('news', [
        { id: 'news.read', titleKey: 'news.permissions.read' },
        { id: 'news.read', titleKey: 'news.permissions.read' },
      ])
    ).toThrow('duplicate_plugin_permission:news.read');
    expect(() =>
      createPluginRegistry([{ ...newsPlugin, routes: [{ id: 'news.old', path: '/plugins/news', guard: 'content.read', component }] }])
    ).toThrow('legacy_content_plugin_permission_guard:news:news.old:content.read');
    expect(() =>
      createPluginRegistry([{ ...newsPlugin, routes: [{ id: 'news.foreign', path: '/plugins/news', guard: 'events.read', component }] }])
    ).toThrow('plugin_permission_reference_namespace_mismatch:news:news.foreign:events:events.read');
    expect(() =>
      createPluginRegistry([{ ...newsPlugin, routes: [{ id: 'news.missing', path: '/plugins/news', guard: 'news.export', component }] }])
    ).toThrow('plugin_permission_reference_missing:news:news.missing:news.export');
  });

  it('rejects invalid plugin registry ownership and duplicates', () => {
    expect(() => createPluginRegistry([{ ...newsPlugin, id: 'core' }])).toThrow('reserved_plugin_namespace:core');
    expect(() => createPluginRegistry([newsPlugin, newsPlugin])).toThrow('duplicate_plugin:news');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          routes: [{ id: 'bad-route', path: '/plugins/news/bad', actionId: 'other.read', component }],
        },
      ])
    ).toThrow('plugin_route_action_owner_mismatch:news:bad-route:other.read');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          navigation: [
            {
              id: 'bad-nav',
              to: '/bad',
              titleKey: 'bad',
              section: 'dataManagement',
              actionId: 'news.missing',
            },
          ],
        },
      ])
    ).toThrow('plugin_navigation_action_missing:news:bad-nav:news.missing');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          contentTypes: [{ contentType: 'other.article', displayName: 'Other' }],
        },
      ])
    ).toThrow('plugin_content_type_namespace_mismatch:news:other:other.article');
  });

  it('rejects invalid plugin registry branch contracts', () => {
    expect(() => createPluginRegistry([{ ...newsPlugin, id: ' ', displayName: 'News' }])).toThrow(
      'invalid_plugin_definition'
    );
    expect(() => createPluginRegistry([{ ...newsPlugin, displayName: ' ' }])).toThrow('invalid_plugin_definition');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          routes: [{ id: 'news.invalid-action', path: '/plugins/news/invalid', actionId: 'invalid', component }],
        },
      ])
    ).toThrow('invalid_plugin_route_action_id:news:news.invalid-action:invalid');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          routes: [
            {
              id: 'news.guard-mismatch',
              path: '/plugins/news/guard-mismatch',
              guard: 'news.create',
              actionId: 'news.read',
              component,
            },
          ],
        },
      ])
    ).toThrow('plugin_route_action_guard_mismatch:news:news.guard-mismatch:news.read');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          navigation: [
            {
              id: 'news.invalid-nav-action',
              to: '/plugins/news',
              titleKey: 'news.nav',
              section: 'dataManagement',
              actionId: 'invalid',
            },
          ],
        },
      ])
    ).toThrow('invalid_plugin_navigation_action_id:news:news.invalid-nav-action:invalid');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          navigation: [
            {
              id: 'news.foreign-nav',
              to: '/plugins/news',
              titleKey: 'news.nav',
              section: 'dataManagement',
              actionId: 'other.read',
            },
          ],
        },
      ])
    ).toThrow('plugin_navigation_action_owner_mismatch:news:news.foreign-nav:other.read');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          navigation: [
            {
              id: 'news.nav-guard-mismatch',
              to: '/plugins/news',
              titleKey: 'news.nav',
              section: 'dataManagement',
              actionId: 'news.read',
              requiredAction: 'news.create',
            },
          ],
        },
      ])
    ).toThrow('plugin_navigation_action_guard_mismatch:news:news.nav-guard-mismatch:news.read');
    expect(() =>
      createPluginRegistry([{ ...newsPlugin, contentTypes: [{ contentType: 'invalid', displayName: 'Invalid' }] }])
    ).toThrow('invalid_plugin_content_type:invalid');
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          auditEvents: [{ eventType: 'other.created' }],
        },
      ])
    ).toThrow('plugin_audit_event_namespace_mismatch:news:other:other.created');
  });

  it('rejects plugin route guardrail bypass fields and non-canonical paths', () => {
    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          routes: [
            {
              id: 'news.bypass',
              path: '/plugins/news',
              component,
              beforeLoad: () => undefined,
            } as never,
          ],
        },
      ])
    ).toThrow('plugin_guardrail_route_bypass:news:news.bypass:beforeLoad');

    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          routes: [
            {
              id: 'news.loader',
              path: '/plugins/news',
              component,
              loader: () => undefined,
            } as never,
          ],
        },
      ])
    ).toThrow('plugin_guardrail_route_bypass:news:news.loader:loader');

    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          routes: [
            {
              id: 'news.foreign',
              path: '/admin/news',
              component,
            },
          ],
        },
      ])
    ).toThrow('plugin_guardrail_route_bypass:news:news.foreign:path');

    expect(() =>
      createPluginRegistry([
        {
          ...newsPlugin,
          routes: [
            {
              id: 'news.list',
              path: '/plugins/news',
              guard: 'news.read',
              component,
            },
          ],
          adminResources: definePluginAdminResources('news', [
            {
              resourceId: 'news.content',
              basePath: 'news',
              titleKey: 'news.navigation.title',
              guard: 'content',
              views: {
                list: { bindingKey: 'content' },
                create: { bindingKey: 'contentCreate' },
                detail: { bindingKey: 'contentDetail' },
              },
              contentUi: {
                contentType: 'news.article',
                bindings: {
                  list: { bindingKey: 'news.list' },
                },
              },
            },
          ]),
        },
      ])
    ).toThrow('plugin_guardrail_route_bypass:news:news.list:path');
  });

  it('rejects plugin authorization, audit, persistence and dynamic-registration bypass fields', () => {
    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            actions: [{ id: 'news.approve', titleKey: 'news.actions.approve', authorize: () => true } as never],
          },
        ],
      })
    ).toThrow('plugin_guardrail_authorization_bypass:news:news.approve:authorize');

    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            auditEvents: [{ eventType: 'news.created', emitAudit: () => undefined } as never],
          },
        ],
      })
    ).toThrow('plugin_guardrail_audit_bypass:news:news.created:emitAudit');

    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            contentTypes: [{ contentType: 'news.article', displayName: 'Article', repository: {} } as never],
          },
        ],
      })
    ).toThrow('plugin_guardrail_persistence_bypass:news:news.article:repository');

    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            registerContentType: () => undefined,
          } as never,
        ],
      })
    ).toThrow('plugin_guardrail_dynamic_registration:news:news:registerContentType');
  });

  it('keeps phased build-time registry failures deterministic', () => {
    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            contentTypes: [{ contentType: 'news.article', displayName: 'Article', repository: {} } as never],
          },
        ],
      })
    ).toThrow('plugin_guardrail_persistence_bypass:news:news.article:repository');

    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            auditEvents: [{ eventType: 'news.created' }, { eventType: 'news.created' }],
          },
        ],
      })
    ).toThrow('duplicate_plugin_audit_event:news.created');

    expect(() =>
      createBuildTimeRegistry({
        plugins: [
          {
            ...newsPlugin,
            routes: [{ id: 'news.missing-action', path: '/plugins/news/missing', actionId: 'news.missing', component }],
          },
        ],
      })
    ).toThrow('plugin_route_action_missing:news:news.missing-action:news.missing');
  });

  it('fails fast when host admin resources conflict with plugin admin resources', () => {
    expect(() =>
      createBuildTimeRegistry({
        plugins: [newsPlugin],
        adminResources: [
          {
            resourceId: 'host.sources',
            basePath: 'sources',
            titleKey: 'host.sources.title',
            guard: 'content',
            views: {
              list: { bindingKey: 'host.sources.list' },
              create: { bindingKey: 'host.sources.create' },
              detail: { bindingKey: 'host.sources.detail' },
            },
          },
        ],
      })
    ).toThrow('admin_resource_base_path_conflict:news.sources:host.sources:sources');
  });

  it('keeps plugin UI components and host-invoked content validation hooks allowed', () => {
    const validatePayload = () => [] as const;
    const registry = createBuildTimeRegistry({
      plugins: [
        {
          ...newsPlugin,
          contentTypes: [
            {
              contentType: 'news.article',
              displayName: 'Article',
              validatePayload,
            },
          ],
        },
      ],
    });

    expect(registry.routes[0]?.component).toBe(component);
    expect(registry.contentTypes[0]?.validatePayload).toBe(validatePayload);
  });
});

describe('admin resource registry', () => {
  const reports = {
    resourceId: 'news.reports',
    basePath: '/reports/',
    titleKey: 'news.reports.title',
    guard: 'content' as const,
    views: {
      list: { bindingKey: 'news.reports.list' },
      create: { bindingKey: 'news.reports.create' },
      detail: { bindingKey: 'news.reports.detail' },
    },
  };

  const specializedContentResource = {
    resourceId: 'news.content',
    basePath: 'news',
    titleKey: 'news.navigation.title',
    guard: 'content' as const,
    views: {
      list: { bindingKey: 'content' },
      create: { bindingKey: 'contentCreate' },
      detail: { bindingKey: 'contentDetail' },
    },
    contentUi: {
      contentType: 'news.article',
      bindings: {
        list: { bindingKey: 'news.list' },
        detail: { bindingKey: 'news.detail' },
        editor: { bindingKey: 'news.editor' },
      },
    },
  };

  it('normalizes resources and rejects duplicate ids or paths', () => {
    const registry = createAdminResourceRegistry([reports]);

    expect(registry.get('news.reports')?.basePath).toBe('reports');
    expect(mergeAdminResourceDefinitions([reports])).toEqual([registry.get('news.reports')]);
    expect(() => createAdminResourceRegistry([reports, reports])).toThrow('duplicate_admin_resource:news.reports');
    expect(() =>
      createAdminResourceRegistry([
        { ...reports, resourceId: 'news.reports-a' },
        { ...reports, resourceId: 'news.reports-b' },
      ])
    ).toThrow('admin_resource_base_path_conflict:news.reports-a:news.reports-b:reports');
  });

  it('normalizes specialized content ui bindings for content resources', () => {
    const registry = createAdminResourceRegistry([specializedContentResource]);

    expect(registry.get('news.content')?.contentUi).toEqual({
      contentType: 'news.article',
      bindings: {
        list: { bindingKey: 'news.list' },
        detail: { bindingKey: 'news.detail' },
        editor: { bindingKey: 'news.editor' },
      },
    });
  });

  it('validates namespace, base path and required views', () => {
    expect(() => definePluginAdminResources('core', [])).toThrow('reserved_plugin_namespace:core');
    expect(() => definePluginAdminResources('news', [{ ...reports, resourceId: 'other.reports' }])).toThrow(
      'plugin_admin_resource_namespace_mismatch:news:other:other.reports'
    );
    expect(() => createAdminResourceRegistry([{ ...reports, basePath: ' / ' }])).toThrow(
      'invalid_admin_resource_base_path'
    );
    expect(() => createAdminResourceRegistry([{ ...reports, basePath: 'nested/path' }])).toThrow(
      'invalid_admin_resource_base_path:nested/path'
    );
    expect(() => createAdminResourceRegistry([{ ...reports, basePath: 'UPPER' }])).toThrow(
      'invalid_admin_resource_base_path:UPPER'
    );
    expect(() =>
      createAdminResourceRegistry([{ ...reports, views: { ...reports.views, summary: { bindingKey: 'x' } } } as never])
    ).toThrow('plugin_guardrail_unsupported_binding:news:news.reports:views.summary');
    expect(() =>
      createAdminResourceRegistry([
        { ...reports, views: { ...reports.views, history: { bindingKey: 'news.reports.history', extra: true } } } as never,
      ])
    ).toThrow('plugin_guardrail_unsupported_binding:news:news.reports.history:extra');
    expect(() =>
      createAdminResourceRegistry([{ ...reports, views: { ...reports.views, detail: { bindingKey: '' } } }])
    ).toThrow('invalid_admin_resource_view:news.reports:detail');
    expect(() =>
      createAdminResourceRegistry([
        {
          ...specializedContentResource,
          contentUi: {
            contentType: 'news.article',
            bindings: {
              list: { bindingKey: 'news.list', unsupported: true } as never,
            },
          },
        },
      ])
    ).toThrow('plugin_guardrail_unsupported_binding:news:news.content.contentUi.bindings.list:unsupported');
    expect(() =>
      createAdminResourceRegistry([
        {
          ...specializedContentResource,
          guard: 'adminUsers' as const,
        },
      ])
    ).toThrow('invalid_admin_resource_content_ui_guard:news.content:adminUsers');
    expect(() =>
      definePluginAdminResources('news', [
        {
          ...specializedContentResource,
          contentUi: {
            contentType: 'events.article',
          },
        },
      ])
    ).toThrow('plugin_admin_resource_content_type_namespace_mismatch:news:events:events.article');
  });

  it('normalizes host-managed list and detail capabilities', () => {
    const registry = createAdminResourceRegistry([
      {
        ...reports,
        capabilities: {
          list: {
            search: {
              placeholderKey: 'news.reports.search.placeholder',
              fields: [' title ', 'summary'],
            },
            filters: [
              {
                id: ' status ',
                labelKey: 'news.reports.filters.status',
                bindingKey: ' news.reports.filters.status ',
                options: [
                  { value: ' draft ', labelKey: 'news.reports.status.draft' },
                  { value: 'published', labelKey: 'news.reports.status.published' },
                ],
                defaultValue: 'draft',
              },
            ],
            sorting: {
              defaultField: 'updatedAt',
              defaultDirection: 'desc',
              fields: [{ id: 'updatedAt', labelKey: 'news.reports.sort.updatedAt', bindingKey: 'news.reports.updatedAt' }],
            },
            pagination: {
              defaultPageSize: 25,
              pageSizeOptions: [10, 25, 50],
            },
            bulkActions: [
              {
                id: 'archive',
                labelKey: 'news.reports.bulk.archive',
                actionId: 'content.changeStatus',
                bindingKey: 'news.reports.bulk.archive',
                selectionModes: ['explicitIds', 'allMatchingQuery'],
              },
            ],
          },
          detail: {
            history: {
              bindingKey: 'news.reports.history',
              titleKey: 'news.reports.history.title',
            },
            revisions: {
              bindingKey: 'news.reports.revisions',
              restoreActionId: 'content.readHistory',
              titleKey: 'news.reports.revisions.title',
            },
          },
        },
      },
    ]);

    expect(registry.get('news.reports')?.capabilities).toMatchObject({
      list: {
        search: {
          param: 'q',
          placeholderKey: 'news.reports.search.placeholder',
          fields: ['title', 'summary'],
        },
        filters: [
          {
            id: 'status',
            param: 'status',
            defaultValue: 'draft',
            options: [
              { value: 'draft', labelKey: 'news.reports.status.draft' },
              { value: 'published', labelKey: 'news.reports.status.published' },
            ],
          },
        ],
        sorting: {
          param: 'sort',
          defaultField: 'updatedAt',
          defaultDirection: 'desc',
        },
        pagination: {
          pageParam: 'page',
          pageSizeParam: 'pageSize',
        },
        bulkActions: [
          {
            id: 'archive',
            actionId: 'content.changeStatus',
            selectionModes: ['explicitIds', 'allMatchingQuery'],
          },
        ],
      },
      detail: {
        history: {
          bindingKey: 'news.reports.history',
        },
        revisions: {
          restoreActionId: 'content.readHistory',
        },
      },
    });
  });

  it('rejects unsupported or conflicting admin resource capabilities', () => {
    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              search: { placeholderKey: 'news.search', fields: ['title'], custom: true },
            },
          },
        } as never,
      ])
    ).toThrow('plugin_guardrail_unsupported_binding:news:news.reports.capabilities.list.search:custom');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              search: { param: 'status', placeholderKey: 'news.search', fields: ['title'] },
              filters: [
                {
                  id: 'status',
                  labelKey: 'news.status',
                  bindingKey: 'news.status',
                  options: [{ value: 'draft', labelKey: 'news.draft' }],
                },
              ],
            },
          },
        },
      ])
    ).toThrow('duplicate_admin_resource_search_param:news.reports:status');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              bulkActions: [
                {
                  id: 'archive',
                  labelKey: 'news.archive',
                  actionId: 'archive',
                  bindingKey: 'news.archive',
                  selectionModes: ['explicitIds'],
                },
              ],
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_action_id:news.reports:capabilities.list.bulkActions.archive.actionId:archive');
  });

  it('rejects invalid admin resource list capability branches', () => {
    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              search: { placeholderKey: 'news.search', fields: [] },
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_capability:news.reports:capabilities.list.search.fields');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              filters: [
                {
                  id: 'status',
                  labelKey: 'news.status',
                  bindingKey: 'news.status',
                  options: [],
                },
              ],
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_capability:news.reports:capabilities.list.filters.status.options');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              filters: [
                {
                  id: 'status',
                  labelKey: 'news.status',
                  bindingKey: 'news.status',
                  defaultValue: 'archived',
                  options: [{ value: 'draft', labelKey: 'news.draft' }],
                },
              ],
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_filter_default:news.reports:status:archived');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              filters: [
                {
                  id: 'status',
                  labelKey: 'news.status',
                  bindingKey: 'news.status',
                  options: [{ value: 'draft', labelKey: 'news.draft' }],
                },
                {
                  id: 'status',
                  labelKey: 'news.status.duplicate',
                  bindingKey: 'news.status.duplicate',
                  options: [{ value: 'published', labelKey: 'news.published' }],
                },
              ],
            },
          },
        },
      ])
    ).toThrow('duplicate_admin_resource_filter:news.reports:status');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              sorting: {
                defaultField: 'title',
                defaultDirection: 'asc',
                fields: [],
              },
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_capability:news.reports:capabilities.list.sorting.fields');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              sorting: {
                defaultField: 'missing',
                defaultDirection: 'asc',
                fields: [{ id: 'title', labelKey: 'news.title', bindingKey: 'news.title' }],
              },
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_sort_default:news.reports:missing');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              sorting: {
                defaultField: 'title',
                defaultDirection: 'sideways' as never,
                fields: [{ id: 'title', labelKey: 'news.title', bindingKey: 'news.title' }],
              },
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_sort_direction:news.reports:sideways');
  });

  it('rejects invalid admin resource pagination and bulk action branches', () => {
    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              pagination: {
                defaultPageSize: 0,
                pageSizeOptions: [25],
              },
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_pagination:news.reports');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              pagination: {
                defaultPageSize: 25,
                pageSizeOptions: [25, 25],
              },
            },
          },
        },
      ])
    ).toThrow('duplicate_admin_resource_page_size:news.reports:25');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              pagination: {
                defaultPageSize: 50,
                pageSizeOptions: [25],
              },
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_pagination_default:news.reports:50');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              bulkActions: [
                {
                  id: 'archive',
                  labelKey: 'news.archive',
                  actionId: 'news.archive',
                  bindingKey: 'news.archive',
                  selectionModes: [],
                },
              ],
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_bulk_action_selection:news.reports:archive');

    expect(() =>
      createAdminResourceRegistry([
        {
          ...reports,
          capabilities: {
            list: {
              bulkActions: [
                {
                  id: 'archive',
                  labelKey: 'news.archive',
                  actionId: 'news.archive',
                  bindingKey: 'news.archive',
                  selectionModes: ['explicitIds'],
                },
                {
                  id: 'archive',
                  labelKey: 'news.archive.duplicate',
                  actionId: 'news.archive',
                  bindingKey: 'news.archive.duplicate',
                  selectionModes: ['currentPage'],
                },
              ],
            },
          },
        },
      ])
    ).toThrow('duplicate_admin_resource_bulk_action:news.reports:archive');
  });

  it('normalizes sparse admin resource capabilities and rejects invalid resource identifiers', () => {
    const registry = createAdminResourceRegistry([
      {
        ...reports,
        capabilities: {
          detail: {},
        },
      },
    ]);

    expect(registry.get('news.reports')?.capabilities).toEqual({
      list: undefined,
      detail: { history: undefined, revisions: undefined },
    });
    expect(() => definePluginAdminResources('news', [{ ...reports, resourceId: 'reports' }])).toThrow(
      'invalid_plugin_admin_resource:reports'
    );
    expect(() => createAdminResourceRegistry([{ ...reports, titleKey: ' ' }])).toThrow(
      'invalid_admin_resource_definition'
    );
  });

  it('rejects content ui contributions without a content type', () => {
    expect(() =>
      createAdminResourceRegistry([
        {
          ...specializedContentResource,
          contentUi: {
            contentType: '   ',
            bindings: {
              editor: { bindingKey: 'news.editor' },
            },
          },
        },
      ])
    ).toThrow('invalid_admin_resource_content_type:news.content');
  });
});

describe('content type registry', () => {
  it('normalizes plugin content types and resolves registered definitions', () => {
    const definitions = definePluginContentTypes('news', [
      {
        contentType: ' news.article ',
        displayName: ' Article ',
        actions: [{ key: ' publish ', label: ' Publish ', domainCapability: 'content.publish' }],
      },
    ]);
    const registry = createContentTypeRegistry(definitions);

    expect(registry.get('news.article')?.displayName).toBe('Article');
    expect(registry.get('news.article')?.actions).toEqual([
      { key: 'publish', label: 'Publish', domainCapability: 'content.publish' },
    ]);
    expect(getContentTypeDefinition(registry, ' news.article ')).toBe(registry.get('news.article'));
  });

  it('rejects invalid content type definitions', () => {
    expect(() => definePluginContentTypes('core', [])).toThrow('reserved_plugin_namespace:core');
    expect(() => definePluginContentTypes('news', [{ contentType: 'other.article', displayName: 'Other' }])).toThrow(
      'plugin_content_type_namespace_mismatch:news:other:other.article'
    );
    expect(() => createContentTypeRegistry([{ contentType: '', displayName: 'Missing' }])).toThrow(
      'invalid_content_type_definition'
    );
    expect(() =>
      createContentTypeRegistry([
        { contentType: 'news.article', displayName: 'Article' },
        { contentType: 'news.article', displayName: 'Duplicate' },
      ])
    ).toThrow('duplicate_content_type:news.article');
    expect(() =>
      createContentTypeRegistry([
        {
          contentType: 'news.article',
          displayName: 'Article',
          actions: [{ key: 'publish', label: 'Publish' } as never],
        },
      ])
    ).toThrow('capability_mapping_missing:news.article:publish');
    expect(() =>
      createContentTypeRegistry([
        {
          contentType: 'news.article',
          displayName: 'Article',
          actions: [{ key: 'publish', label: 'Publish', domainCapability: 'content.unknown' } as never],
        },
      ])
    ).toThrow('capability_mapping_missing:news.article:publish');
  });
});

describe('audit event helpers', () => {
  it('validates audit event namespaces', () => {
    expect(definePluginAuditEvents('news', [{ eventType: ' news.created ', titleKey: ' news.audit.created ' }])).toEqual([
      { eventType: 'news.created', titleKey: 'news.audit.created' },
    ]);
    expect(() => definePluginAuditEvents('core', [])).toThrow('reserved_plugin_namespace:core');
    expect(() => definePluginAuditEvents('news', [{ eventType: 'other.created' }])).toThrow(
      'plugin_audit_event_namespace_mismatch:news:other:other.created'
    );
    expect(() =>
      createPluginAuditEventRegistry([
        {
          ...newsPlugin,
          auditEvents: [{ eventType: 'news.created' }, { eventType: 'news.created' }],
        },
      ])
    ).toThrow('duplicate_plugin_audit_event:news.created');
  });
});
