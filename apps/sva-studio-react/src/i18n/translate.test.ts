import { describe, expect, it } from 'vitest';

import { createTranslator, createTranslatorFromResources } from './translate';
import { i18nResources } from './resources';

describe('translate', () => {
  it('resolves account namespace keys for de locale', () => {
    const t = createTranslator('de');

    expect(t('account.profile.title')).toBe('Mein Konto');
    expect(t('account.messages.saveSuccess')).toBe('Profil wurde erfolgreich gespeichert.');
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
    const resources = {
      ...i18nResources,
      en: {
        ...i18nResources.en,
        account: {
          ...i18nResources.en.account,
          profile: {
            ...i18nResources.en.account.profile,
            title: undefined,
          },
        },
      },
    };
    const t = createTranslatorFromResources(resources, 'en');
    expect(t('account.profile.title')).toBe('Mein Konto');
  });

  it('returns key when translation is missing in all locales', () => {
    const t = createTranslator('de');
    const missingKey = ['admin', 'users', 'page', 'unknown'].join('.') as never;

    expect(t(missingKey)).toBe('admin.users.page.unknown');
  });
});
