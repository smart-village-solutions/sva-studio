import { describe, expect, it } from 'vitest';

import {
  isReservedPluginNamespace,
  isValidPluginNamespace,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';

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
    expect(parseNamespacedPluginIdentifier('news.pushNotification')).toEqual({
      namespace: 'news',
      name: 'pushNotification',
    });
  });

  it.each(['news', 'calendar--tools', 'calendar-', 'c4', 'a'.repeat(31)])(
    'accepts %s as a plugin namespace in the predicate and the normalizer',
    (namespace) => {
      expect(isValidPluginNamespace(namespace)).toBe(true);
      expect(normalizePluginNamespace(namespace)).toBe(namespace);
    }
  );

  it.each(['', 'a', '1news', 'News', 'news.tools', 'news_tools', 'a'.repeat(32)])(
    'rejects %j as a plugin namespace in the predicate and the normalizer',
    (namespace) => {
      expect(isValidPluginNamespace(namespace)).toBe(false);
      expect(() => normalizePluginNamespace(namespace)).toThrow('invalid_plugin_namespace');
    }
  );

  it('checks the exact value in the predicate while the normalizer trims first', () => {
    expect(isValidPluginNamespace(' news ')).toBe(false);
    expect(normalizePluginNamespace(' news ')).toBe('news');
  });
});
