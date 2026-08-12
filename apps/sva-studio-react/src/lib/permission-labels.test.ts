import { corePermissionCatalog } from '@sva/core';
import { describe, expect, it } from 'vitest';

import { setActiveLocale } from '../i18n';
import {
  hostPermissionTitleCoverage,
  registeredPluginPermissionIds,
  resolvePermissionTitle,
} from './permission-labels';

describe('permission labels', () => {
  it('covers every core permission and host media permission', () => {
    const translated = new Set(hostPermissionTitleCoverage.translatedPermissionIds);
    for (const permission of corePermissionCatalog) {
      expect(translated.has(permission.key), permission.key).toBe(true);
    }
    for (const permission of [
      'media.read',
      'media.create',
      'media.update',
      'media.reference.manage',
      'media.delete',
      'media.deliver.protected',
    ]) {
      expect(translated.has(permission), permission).toBe(true);
    }
  });

  it('resolves localized host and plugin permission titles with an unknown fallback', () => {
    setActiveLocale('de');
    expect(resolvePermissionTitle('iam.user.write')).toBe('Benutzer bearbeiten');
    expect(resolvePermissionTitle('modules.read')).toBe('Module anzeigen');
    expect(resolvePermissionTitle('categories.read')).toBe('Kategorien lesen');
    expect(resolvePermissionTitle('waste-management.read')).toBe('Abfallkalender lesen');
    setActiveLocale('en');
    expect(resolvePermissionTitle('modules.read')).toBe('View modules');
    expect(resolvePermissionTitle('categories.read')).toBe('Read categories');
    expect(resolvePermissionTitle('waste-management.read')).toBe('Read waste calendar');
    expect(resolvePermissionTitle('unknown.read')).toBeUndefined();
  });

  it.each(['de', 'en'] as const)('resolves every registered plugin permission in %s', (locale) => {
    setActiveLocale(locale);
    for (const permissionId of registeredPluginPermissionIds) {
      expect(resolvePermissionTitle(permissionId), permissionId).toBeTruthy();
    }
  });
});
