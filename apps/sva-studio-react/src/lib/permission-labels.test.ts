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
    expect(resolvePermissionTitle('categories.read')).toBeTruthy();
    expect(resolvePermissionTitle('unknown.read')).toBeUndefined();
  });

  it.each(['de', 'en'] as const)('resolves every registered plugin permission in %s', (locale) => {
    setActiveLocale(locale);
    for (const permissionId of registeredPluginPermissionIds) {
      expect(resolvePermissionTitle(permissionId), permissionId).toBeTruthy();
    }
  });
});
