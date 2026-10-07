import { createPluginRegistry } from '../src/plugins.js';
import { createStandardContentPluginContribution } from '../src/standard-content-plugin.js';
import { collectRegisteredStudioContentTypes } from '../src/content-types.js';
import { GENERIC_CONTENT_TYPE } from '@sva/core';
import { describe, expect, it } from 'vitest';

import {
  createContentTypeRegistry,
  definePluginContentTypes,
  genericContentTypeDefinition,
  getContentTypeDefinition,
} from '../src/content-types.js';
import {
  createMainserverGenericTypeRegistry,
  resolveMainserverGenericItemContentType,
} from '../src/mainserver-generic-type-registry.js';

describe('content type registry', () => {
  it('registers and resolves content types', () => {
    const registry = createContentTypeRegistry([
      {
        ...genericContentTypeDefinition,
        actions: [{ key: 'publish', label: 'Publish', domainCapability: 'content.publish' }],
      },
    ]);

    expect(getContentTypeDefinition(registry, GENERIC_CONTENT_TYPE)).toMatchObject({
      contentType: GENERIC_CONTENT_TYPE,
      displayName: 'Generischer Inhalt',
      actions: [{ key: 'publish', label: 'Publish', domainCapability: 'content.publish' }],
    });
  });

  it('rejects invalid registrations', () => {
    expect(() =>
      createContentTypeRegistry([
        genericContentTypeDefinition,
        { ...genericContentTypeDefinition, displayName: 'Duplikat' },
      ])
    ).toThrow('duplicate_content_type:generic');

    expect(() =>
      createContentTypeRegistry([{ ...genericContentTypeDefinition, contentType: '   ' }])
    ).toThrow('invalid_content_type_definition');

    expect(() =>
      createContentTypeRegistry([
        {
          ...genericContentTypeDefinition,
          actions: [{ key: 'publish', label: 'Publish' }],
        },
      ])
    ).toThrow('capability_mapping_missing:generic:publish');
  });

  it('enforces namespace ownership for plugin content types', () => {
    expect(() =>
      definePluginContentTypes('', [{ contentType: 'news.article', displayName: 'News' }])
    ).toThrow('invalid_plugin_namespace');

    expect(() =>
      definePluginContentTypes('News', [{ contentType: 'news.article', displayName: 'News' }])
    ).toThrow('invalid_plugin_namespace:News');

    expect(() =>
      definePluginContentTypes('content', [
        { contentType: 'content.article', displayName: 'Content' },
      ])
    ).toThrow('reserved_plugin_namespace:content');

    expect(() =>
      definePluginContentTypes('news', [{ contentType: '   ', displayName: 'News' }])
    ).toThrow('invalid_content_type_definition');

    expect(() =>
      definePluginContentTypes('news', [{ contentType: 'article', displayName: 'News' }])
    ).toThrow('invalid_plugin_content_type:article');

    expect(() =>
      definePluginContentTypes('news', [{ contentType: 'events.article', displayName: 'News' }])
    ).toThrow('plugin_content_type_namespace_mismatch:news:events:events.article');
  });

  it('registers exact Mainserver GenericItem ownership with a generic fallback', () => {
    const registry = createMainserverGenericTypeRegistry([
      {
        contentType: 'faq.faq',
        displayName: 'FAQ',
        mainserverGenericType: 'FAQ',
      },
    ]);

    expect(
      resolveMainserverGenericItemContentType(registry, 'FAQ', 'generic-items.generic-item')
    ).toBe('faq.faq');
    expect(
      resolveMainserverGenericItemContentType(registry, 'faq', 'generic-items.generic-item')
    ).toBe('generic-items.generic-item');
    expect(
      resolveMainserverGenericItemContentType(registry, 'UNKNOWN', 'generic-items.generic-item')
    ).toBe('generic-items.generic-item');
  });

  it('rejects invalid and duplicate Mainserver GenericItem ownership', () => {
    expect(() =>
      definePluginContentTypes('faq', [
        { contentType: 'faq.faq', displayName: 'FAQ', mainserverGenericType: ' FAQ ' },
      ])
    ).toThrow('invalid_mainserver_generic_type:faq.faq');

    expect(() =>
      createMainserverGenericTypeRegistry([
        { contentType: 'faq.faq', displayName: 'FAQ', mainserverGenericType: 'FAQ' },
        { contentType: 'other.faq', displayName: 'Other FAQ', mainserverGenericType: 'FAQ' },
      ])
    ).toThrow('duplicate_mainserver_generic_type:FAQ:faq.faq:other.faq');
  });
});

describe('content mutation declarations', () => {
  const definition = {
    contentType: 'sample.entry',
    displayName: 'Sample',
    mutations: {
      delete: { requiredAction: 'sample.delete', execute: async () => undefined },
      status: {
        requiredAction: 'sample.update',
        supportedStatuses: ['draft', 'published'] as const,
        execute: async () => undefined,
      },
    },
  };
  it('preserves handlers and permits absent capabilities', () => {
    const registry = createContentTypeRegistry([definition]);
    expect(registry.get('sample.entry')?.mutations).toBe(definition.mutations);
    expect(createContentTypeRegistry([]).get('sample.entry')).toBeUndefined();
    expect(
      createContentTypeRegistry([{ contentType: 'sample.entry', displayName: 'Sample' }]).get(
        'sample.entry'
      )?.mutations
    ).toBeUndefined();
  });
  it('rejects duplicate content owners', () => {
    expect(() => createContentTypeRegistry([definition, definition])).toThrow(
      'duplicate_content_type'
    );
  });
  it.each([
    { delete: null },
    { delete: { requiredAction: 'sample.read', execute: async () => undefined } },
    { delete: { requiredAction: 'other.delete', execute: async () => undefined } },
    { delete: { requiredAction: 'sample.delete', execute: undefined } },
    {
      status: {
        requiredAction: 'sample.update',
        supportedStatuses: [],
        execute: async () => undefined,
      },
    },
    {
      status: {
        requiredAction: 'sample.update',
        supportedStatuses: ['draft', 'draft'],
        execute: async () => undefined,
      },
    },
    {
      status: {
        requiredAction: 'sample.update',
        supportedStatuses: ['invalid'],
        execute: async () => undefined,
      },
    },
  ])('rejects malformed capabilities %j', (mutations) => {
    expect(() =>
      createContentTypeRegistry([
        { ...definition, mutations: mutations as unknown as typeof definition.mutations },
      ])
    ).toThrow('invalid_content_mutation');
  });
});

describe('snapshot content mutation ownership', () => {
  const standard = createStandardContentPluginContribution({
    pluginId: 'sample',
    contentType: 'sample.entry',
    displayName: 'Sample',
    titleKey: 'sample.title',
    listBindingKey: 'sampleList',
    detailBindingKey: 'sampleDetail',
    editorBindingKey: 'sampleEditor',
  });
  const execute = async () => undefined;
  const definition = {
    ...standard.contentTypes[0]!,
    mutations: { delete: { requiredAction: 'sample.delete', execute } },
  };
  const plugin = {
    id: 'sample',
    displayName: 'Sample',
    routes: [],
    ...standard,
    contentHistory: { mode: 'host', coverage: 'studio_mutations' } as const,
    contentTypes: [definition],
  };
  it('materializes validated browser handlers through the existing studio contribution', () => {
    const registry = createPluginRegistry([plugin]);
    expect(
      collectRegisteredStudioContentTypes(registry.get('sample')!.contentTypes!)[0]?.mutations
        ?.delete?.execute
    ).toBe(execute);
  });
  it('requires a declared action and matching permission', () => {
    expect(() =>
      createPluginRegistry([
        { ...plugin, actions: standard.actions.filter((action) => action.id !== 'sample.delete') },
      ])
    ).toThrow('plugin_content_mutation_action_missing');
  });
  it.each([
    ['repository', 'plugin_guardrail_persistence_bypass'],
    ['handler', 'plugin_guardrail_route_bypass'],
    ['authorize', 'plugin_guardrail_authorization_bypass'],
    ['binding', 'plugin_guardrail_unsupported_binding'],
    ['registerContentType', 'plugin_guardrail_dynamic_registration'],
  ])('preserves the guardrail diagnostic for %s', (key, code) => {
    expect(() =>
      createPluginRegistry([
        {
          ...plugin,
          contentTypes: [
            {
              ...definition,
              mutations: { delete: { ...definition.mutations.delete, [key]: execute } },
            },
          ],
        },
      ])
    ).toThrow(`${code}:sample:sample.entry.delete:${key}`);
  });
});
