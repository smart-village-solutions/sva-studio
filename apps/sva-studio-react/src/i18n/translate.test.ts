import { describe, expect, it } from 'vitest';

import { createTranslator } from './translate';
import { i18nResources } from './resources';

describe('translate', () => {
  it('resolves account namespace keys for de locale', () => {
    const t = createTranslator('de');

    expect(t('account.profile.title')).toBe('Mein Konto');
    expect(t('account.messages.keycloakRedirectHint')).toContain('Keycloak');
  });

  it('resolves admin.users and admin.roles namespace keys for en locale', () => {
    const t = createTranslator('en');

    expect(t('admin.users.page.title')).toBe('User Management');
    expect(t('admin.roles.table.headerName')).toBe('Role');
  });

  it('interpolates variables', () => {
    const t = createTranslator('de');

    expect(t('admin.users.messages.resultCount', { count: 7 })).toBe('7 Nutzer gefunden.');
  });

  it('keeps placeholder when interpolation variable is missing', () => {
    const t = createTranslator('en');

    expect(t('admin.users.table.selectOne')).toBe('Select user {{name}}');
  });

  it('falls back to default locale when selected locale key is unavailable', () => {
    const original = i18nResources.en.account.profile.title;
    i18nResources.en.account.profile.title = undefined as unknown as string;

    try {
      const t = createTranslator('en');
      expect(t('account.profile.title')).toBe('Mein Konto');
    } finally {
      i18nResources.en.account.profile.title = original;
    }
  });

  it('returns key when translation is missing in all locales', () => {
    const t = createTranslator('de');

    expect(t('admin.users.page.unknown' as never)).toBe('admin.users.page.unknown');
  });
});
