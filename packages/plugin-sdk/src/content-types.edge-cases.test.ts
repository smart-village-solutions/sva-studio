import { describe, expect, it } from 'vitest';

import {
  createContentTypeRegistry,
  definePluginContentTypes,
  genericContentTypeDefinition,
  getContentTypeDefinition,
} from './content-types.js';
import { normalizePluginNamespace } from './plugin-identifiers.js';

describe('content type edge cases', () => {
  it('exposes the generic content type and trims lookup identifiers', () => {
    const registry = createContentTypeRegistry([genericContentTypeDefinition]);

    expect(genericContentTypeDefinition.contentType).toBe('generic');
    expect(getContentTypeDefinition(registry, '  generic  ')).toEqual(genericContentTypeDefinition);
  });

  it('rejects invalid content type actions and malformed normalized content types', () => {
    expect(() =>
      definePluginContentTypes('news', [
        {
          contentType: 'news.article',
          displayName: 'Artikel',
          actions: [{ key: '   ', label: 'Freigeben', domainCapability: 'publish' }],
        },
      ])
    ).toThrow('invalid_content_type_action_definition');

    expect(() =>
      definePluginContentTypes('news', [
        {
          contentType: 'news.article',
          displayName: '   ',
        },
      ])
    ).toThrow('invalid_content_type_definition');

    expect(() =>
      definePluginContentTypes('news', [
        {
          contentType: 'news article',
          displayName: 'Artikel',
        },
      ])
    ).toThrow('invalid_plugin_content_type:news article');
  });

  it('rejects empty plugin namespaces before any content type normalization starts', () => {
    expect(() => normalizePluginNamespace('   ')).toThrow('invalid_plugin_namespace');
  });
});
