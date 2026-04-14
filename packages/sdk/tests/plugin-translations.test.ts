import { describe, expect, it } from 'vitest';

import {
  registerPluginTranslationResolver,
  translatePluginKey,
  usePluginTranslation,
} from '../src/plugin-translations.js';

describe('plugin translations', () => {
  it('falls back to the fully qualified key with the default resolver', () => {
    expect(translatePluginKey('news', 'messages.loading')).toBe('news.messages.loading');
  });

  it('passes namespaced keys and variables through the registered resolver', () => {
    registerPluginTranslationResolver((key, variables) => `${key}:${variables?.count ?? 'none'}`);

    expect(translatePluginKey('news', 'messages.loading', { count: 2 })).toBe('news.messages.loading:2');
  });

  it('returns a scoped translator helper for plugin components', () => {
    registerPluginTranslationResolver((key) => `translated:${key}`);
    const t = usePluginTranslation('example');

    expect(t('navigation.title')).toBe('translated:example.navigation.title');
  });
});
