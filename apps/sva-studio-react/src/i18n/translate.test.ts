import { describe, expect, it, vi } from 'vitest';

import { createTranslator, createTranslatorFromResources, getActiveLocale, setActiveLocale, t } from './translate';
import { i18nResources, mergeI18nResources } from './resources';

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
    expect(t('admin.instances.page.title')).toBe('Instance Management');
    expect(t('admin.instances.actions.create')).toBe('Create instance');
  });

  it('keeps host resources aggregated across feature namespaces', () => {
    expect(i18nResources.de.shell.appName).toBe('SVA Studio');
    expect(i18nResources.de.monitoring.jobs.page.title).toBe('Monitoring Jobs');
    expect(i18nResources.en.account.profile.title).toBe('My Account');
    expect(i18nResources.en.admin.roles.table.headerName).toBe('Role');
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

  it('rejects plugin resource keys that already exist in host resources', () => {
    expect(() =>
      mergeI18nResources({
        de: {
          shell: {
            appName: 'Plugin-owned Studio',
          },
        },
        en: {},
      })
    ).toThrow('duplicate_i18n_key:de:shell.appName');
  });

  it('keeps host resources unchanged when plugin translation merges fail atomically', () => {
    const previousAppName = i18nResources.de.shell.appName;
    const previousPluginBranch = (i18nResources.de as Record<string, unknown>).pluginAtomicityProbe;

    expect(() =>
      mergeI18nResources({
        de: {
          pluginAtomicityProbe: {
            title: 'Temporäre Probe',
          },
          shell: {
            appName: 'Duplikat',
          },
        },
        en: {},
      })
    ).toThrow('duplicate_i18n_key:de:shell.appName');

    expect(i18nResources.de.shell.appName).toBe(previousAppName);
    expect((i18nResources.de as Record<string, unknown>).pluginAtomicityProbe).toBe(previousPluginBranch);
  });

  it('allows idempotent repeated merges of the same plugin-owned translation keys', () => {
    const pluginProbeResources = {
      de: {
        pluginIdempotentProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
      en: {
        pluginIdempotentProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
    } as const;

    expect(() => mergeI18nResources(pluginProbeResources)).not.toThrow();
    expect(() => mergeI18nResources(pluginProbeResources)).not.toThrow();
    expect((i18nResources.de as Record<string, unknown>).pluginIdempotentProbe).toEqual({
      navigation: {
        title: 'Probe',
      },
    });
  });

  it('allows idempotent repeated merges from a new object with identical plugin-owned translation content', () => {
    mergeI18nResources({
      de: {
        pluginSourceProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
      en: {
        pluginSourceProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
    });

    const clonedResources = {
      de: {
        pluginSourceProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
      en: {
        pluginSourceProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
    } as const;

    expect(() => mergeI18nResources(clonedResources)).not.toThrow();
  });

  it('rejects duplicate plugin translation keys when a later merge changes an existing value', () => {
    mergeI18nResources({
      de: {
        pluginConflictProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
      en: {
        pluginConflictProbe: {
          navigation: {
            title: 'Probe',
          },
        },
      },
    });

    expect(() =>
      mergeI18nResources({
        de: {
          pluginConflictProbe: {
            navigation: {
              title: 'Abweichend',
            },
          },
        },
        en: {
          pluginConflictProbe: {
            navigation: {
              title: 'Different',
            },
          },
        },
      })
    ).toThrow('duplicate_i18n_key:de:pluginConflictProbe.navigation.title');
  });

  it('uses the active locale for global translations', () => {
    setActiveLocale('en');

    expect(getActiveLocale()).toBe('en');
    expect(t('shell.sidebar.account')).toBe('My Account');

    setActiveLocale('de');
    expect(t('shell.sidebar.account')).toBe('Mein Konto');
  });

  it('ignores locale mutations outside the browser runtime', () => {
    const previousActiveLocale = getActiveLocale();

    try {
      vi.stubGlobal('window', undefined);

      setActiveLocale('en');

      expect(getActiveLocale()).toBe(previousActiveLocale);
    } finally {
      vi.unstubAllGlobals();
      setActiveLocale(previousActiveLocale);
    }
  });
});
