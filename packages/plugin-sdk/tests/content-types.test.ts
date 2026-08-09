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
