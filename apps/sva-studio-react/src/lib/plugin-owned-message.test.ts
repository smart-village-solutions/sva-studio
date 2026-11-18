import { describe, expect, it } from 'vitest';

import { isPluginOwnedMessageKey } from './plugin-owned-message';

const wasteTranslations = {
  de: {
    wasteManagement: {
      readiness: { unavailable: 'Abfallkalender nicht verfügbar.', empty: '   ' },
      deOnly: { leaf: 'Nur Deutsch' },
    },
  },
  en: {
    wasteManagement: { readiness: { unavailable: 'Waste calendar unavailable.' } },
  },
} as const;

const multiNamespaceTranslations = {
  de: { wasteManagement: { readiness: { blocked: 'Gesperrt' } }, wasteShared: { label: 'X' } },
  en: { wasteManagement: { readiness: { blocked: 'Blocked' } } },
} as const;

describe('isPluginOwnedMessageKey', () => {
  it('accepts a key for which the plugin ships text in any locale', () => {
    expect(
      isPluginOwnedMessageKey('wasteManagement.readiness.unavailable', wasteTranslations)
    ).toBe(true);
    expect(isPluginOwnedMessageKey('wasteManagement.deOnly.leaf', wasteTranslations)).toBe(true);
  });

  it('keeps owned keys of plugins with several top-level translation namespaces', () => {
    expect(
      isPluginOwnedMessageKey('wasteManagement.readiness.blocked', multiNamespaceTranslations)
    ).toBe(true);
  });

  it('rejects host keys and keys of other plugins', () => {
    expect(
      isPluginOwnedMessageKey('admin.instances.pluginReadiness.title', wasteTranslations)
    ).toBe(false);
    expect(
      isPluginOwnedMessageKey('ssf.errors.rootDatabaseNotConfigured', wasteTranslations)
    ).toBe(false);
  });

  it('rejects unknown, non-leaf, blank, prototype and free-text keys', () => {
    expect(isPluginOwnedMessageKey('wasteManagement.readiness.missing', wasteTranslations)).toBe(
      false
    );
    expect(isPluginOwnedMessageKey('wasteManagement.readiness', wasteTranslations)).toBe(false);
    expect(isPluginOwnedMessageKey('wasteManagement.readiness.empty', wasteTranslations)).toBe(
      false
    );
    expect(isPluginOwnedMessageKey('wasteManagement.constructor.name', wasteTranslations)).toBe(
      false
    );
    expect(
      isPluginOwnedMessageKey('wasteManagement.readiness.unavailable and call us', wasteTranslations)
    ).toBe(false);
    expect(isPluginOwnedMessageKey(undefined, wasteTranslations)).toBe(false);
  });

  it('rejects every key when the plugin ships no translations', () => {
    expect(isPluginOwnedMessageKey('unknown.errors.failed', undefined)).toBe(false);
  });
});
