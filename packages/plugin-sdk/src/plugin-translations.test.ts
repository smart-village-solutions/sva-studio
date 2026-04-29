import { describe, expect, it } from 'vitest';

import { registerPluginTranslationResolver, translatePluginKey, usePluginTranslation } from './plugin-translations.js';

describe('plugin-translations', () => {
  it('registers a resolver and translates namespaced plugin keys directly and via the hook helper', () => {
    registerPluginTranslationResolver((key, variables) =>
      `${key}:${variables ? JSON.stringify(variables) : 'none'}`
    );

    expect(translatePluginKey('news', 'editor.title')).toBe('news.editor.title:none');

    const t = usePluginTranslation('events');
    expect(t('list.empty', { count: 0 })).toBe('events.list.empty:{"count":0}');
  });
});
