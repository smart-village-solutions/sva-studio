import { describe, expect, it } from 'vitest';

import {
  createAdminResourceRegistry,
  createBuildTimeRegistry,
  createContentTypeRegistry,
  createPluginActionRegistry,
  createPluginAuditEventRegistry,
  createPluginGuardrailError,
  createPluginRegistry,
  definePluginActions,
  definePluginAdminResources,
  definePluginAuditEvents,
  definePluginContentTypes,
  getContentTypeDefinition,
  mergeAdminResourceDefinitions,
  mergePluginActions,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginNavigationItems,
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
      guard: 'content.read',
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
      requiredAction: 'content.read',
    },
  ],
  actions: [
    {
      id: 'news.read',
      titleKey: 'news.actions.read',
      requiredAction: 'content.read',
      featureFlag: ' news-enabled ',
      legacyAliases: ['news-read'],
    },
    {
      id: 'news.create',
      titleKey: 'news.actions.create',
      requiredAction: 'content.create',
    },
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
    expect(mergePluginContentTypes([...registry.values()])).toHaveLength(1);
    expect(mergePluginAdminResourceDefinitions([...registry.values()])).toHaveLength(1);
    expect(mergePluginAuditEventDefinitions([...registry.values()])).toHaveLength(1);
    expect(mergePluginTranslations([...registry.values()]).de).toEqual({
      news: {
        nav: 'Nachrichten',
        actions: { read: 'Lesen' },
      },
    });
  });

  it('builds action and audit registries including legacy aliases', () => {
    const actions = createPluginActionRegistry([newsPlugin]);
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
              guard: 'content.create',
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
              requiredAction: 'content.create',
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
          actions: [{ key: 'publish', label: 'Publish' }],
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
