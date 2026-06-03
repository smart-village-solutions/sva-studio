import { describe, expect, it } from 'vitest';

import {
  collectAvailableKeys,
  collectTranslationKeysFromSource,
  SOURCE_ROOTS,
} from './check-i18n-keys.ts';

describe('check-i18n-keys', () => {
  it('scans app and plugin ui source roots', () => {
    expect(SOURCE_ROOTS).toContain('apps/sva-studio-react/src');
    expect(SOURCE_ROOTS).toContain('packages/plugin-waste-management/src');
  });

  it('includes plugin translation keys in the available key set', () => {
    const keys = collectAvailableKeys();

    expect(keys.has('news.navigation.title')).toBe(true);
    expect(keys.has('events.navigation.title')).toBe(true);
    expect(keys.has('poi.navigation.title')).toBe(true);
    expect(keys.has('wasteManagement.page.title')).toBe(true);
  });

  it('extracts keys from both t(...) and pt(...) usage', () => {
    const keys = collectTranslationKeysFromSource(`
      const title = t('navigation.dashboard');
      const pluginTitle = pt('page.title');
      const duplicate = pt("page.title");
    `);

    expect([...keys]).toEqual(['navigation.dashboard', 'page.title']);
  });

  it('prefixes pt(...) keys with the plugin namespace and ignores dynamic template keys', () => {
    const keys = collectTranslationKeysFromSource(
      `
        const pluginTitle = pt('page.title');
        const validation = pt(\`validation.\${error.message}\`);
        const appTitle = t('navigation.dashboard');
      `,
      { namespace: 'news' }
    );

    expect([...keys]).toEqual(['news.page.title', 'navigation.dashboard']);
  });
});
