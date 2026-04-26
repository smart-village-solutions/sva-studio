import { GENERIC_CONTENT_TYPE } from '@sva/core';
import { describe, expect, it } from 'vitest';

import {
  createContentTypeRegistry,
  definePluginContentTypes,
  genericContentTypeDefinition,
  getContentTypeDefinition,
} from '../src/content-types.js';

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
      definePluginContentTypes('content', [{ contentType: 'content.article', displayName: 'Content' }])
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
});
