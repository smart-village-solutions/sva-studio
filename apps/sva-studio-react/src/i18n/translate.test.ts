import { describe, expect, it } from 'vitest';

import { createTranslator } from './translate';

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
});
