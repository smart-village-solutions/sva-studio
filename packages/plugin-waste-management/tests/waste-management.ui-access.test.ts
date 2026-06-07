import { describe, expect, it } from 'vitest';

import { deriveWasteManagementUiAccess } from '../src/waste-management.ui-access.js';

describe('waste-management.ui-access', () => {
  it('keeps read-only users away from settings and tools tabs', () => {
    const access = deriveWasteManagementUiAccess(['waste-management.read']);

    expect(access.visibleTabIds).toEqual(['fractions', 'tours', 'locations', 'scheduling']);
    expect(access.canAccessSettings).toBe(false);
    expect(access.canAccessTools).toBe(false);
    expect(access.canRunInitialize).toBe(false);
    expect(access.canRunMigrations).toBe(false);
    expect(access.canRunImport).toBe(false);
    expect(access.canRunSeed).toBe(false);
    expect(access.canRunReset).toBe(false);
    expect(access.canDuplicateTour).toBe(false);
  });

  it('maps granular permissions to the matching settings and tools capabilities', () => {
    const access = deriveWasteManagementUiAccess([
      'waste-management.read',
      'waste-management.settings.manage',
      'waste-management.import.execute',
      'waste-management.reset.execute',
    ]);

    expect(access.visibleTabIds).toEqual(['fractions', 'tours', 'locations', 'scheduling', 'output', 'tools', 'settings']);
    expect(access.canAccessSettings).toBe(true);
    expect(access.canAccessTools).toBe(true);
    expect(access.canRunInitialize).toBe(true);
    expect(access.canRunMigrations).toBe(true);
    expect(access.canRunImport).toBe(true);
    expect(access.canRunSeed).toBe(false);
    expect(access.canRunReset).toBe(true);
    expect(access.canDuplicateTour).toBe(false);
  });

  it('shows duplicate action only when user can manage tours and scheduling', () => {
    expect(
      deriveWasteManagementUiAccess([
        'waste-management.read',
        'waste-management.tours.manage',
      ]).canDuplicateTour
    ).toBe(false);

    expect(
      deriveWasteManagementUiAccess([
        'waste-management.read',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
      ]).canDuplicateTour
    ).toBe(true);
  });
});
