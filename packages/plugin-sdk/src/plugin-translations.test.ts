import { useContentMediaTranslation } from './content-media-contracts-public-api.js';
import { describe, expect, it } from 'vitest';

import {
  registerPluginTranslationResolver,
  translatePluginKey,
  usePluginTranslation,
} from './plugin-translations.js';

describe('plugin-translations', () => {
  it('registers a resolver and translates namespaced plugin keys directly and via the hook helper', () => {
    registerPluginTranslationResolver(
      (key, variables) => `${key}:${variables ? JSON.stringify(variables) : 'none'}`
    );

    expect(translatePluginKey('news', 'editor.title')).toBe('news.editor.title:none');

    const t = usePluginTranslation('events');
    expect(t('list.empty', { count: 0 })).toBe('events.list.empty:{"count":0}');
  });

  it('keeps the shared media UI on its fixed narrow translation contract', () => {
    registerPluginTranslationResolver((key) => `translated:${key}`);
    const t = useContentMediaTranslation();
    expect(t('editor.imageTitle')).toBe('translated:media.editor.imageTitle');
    expect(useContentMediaTranslation()).toBe(t);
  });

  it('returns a stable translation function per plugin id across repeated calls', () => {
    registerPluginTranslationResolver((key) => `translated:${key}`);

    const first = usePluginTranslation('poi');
    const second = usePluginTranslation('poi');

    expect(first).toBe(second);
    expect(first('messages.saved')).toBe('translated:poi.messages.saved');
  });
});
