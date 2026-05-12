import { describe, expect, it } from 'vitest';

import { isReservedPluginNamespace, parseNamespacedPluginIdentifier } from './plugin-identifiers.js';

describe('plugin identifiers', () => {
  it('detects reserved plugin namespaces without narrowing casts', () => {
    expect(isReservedPluginNamespace('content')).toBe(true);
    expect(isReservedPluginNamespace('news')).toBe(false);
  });

  it('parses valid namespaced identifiers and rejects invalid ones', () => {
    expect(parseNamespacedPluginIdentifier('news.publish')).toEqual({
      namespace: 'news',
      name: 'publish',
    });
    expect(parseNamespacedPluginIdentifier('News.publish')).toBeUndefined();
  });
});
