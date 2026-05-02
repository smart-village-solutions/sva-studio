import { describe, expect, it } from 'vitest';

import {
  registerPluginTranslationResolver,
  translatePluginKey,
  usePluginTranslation,
} from './plugin-translations.js';

describe('plugin translation helpers', () => {
  it('falls back to the fully qualified key by default', () => {
    registerPluginTranslationResolver((key) => key);

    expect(translatePluginKey('news', 'actions.create')).toBe('news.actions.create');
  });

  it('passes variables through the registered resolver', () => {
    registerPluginTranslationResolver((key, variables) => `${key}:${variables?.page ?? 'n/a'}`);

    expect(translatePluginKey('news', 'pagination.pageLabel', { page: 3 })).toBe(
      'news.pagination.pageLabel:3'
    );
  });

  it('creates plugin-scoped translation functions via usePluginTranslation', () => {
    registerPluginTranslationResolver((key, variables) => `${key}:${variables?.count ?? 0}`);
    const t = usePluginTranslation('poi');

    expect(t('list.title')).toBe('poi.list.title:0');
    expect(t('list.count', { count: 2 })).toBe('poi.list.count:2');
  });
});
