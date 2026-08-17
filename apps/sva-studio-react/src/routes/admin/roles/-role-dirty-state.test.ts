import { describe, expect, it } from 'vitest';

import {
  areRoleGeneralDraftsEqual,
  areRolePermissionDraftsEqual,
  normalizeRoleGeneralDraft,
} from './-role-dirty-state';

describe('role dirty state', () => {
  it('ignores non-semantic surrounding whitespace in general data', () => {
    expect(
      areRoleGeneralDraftsEqual(
        normalizeRoleGeneralDraft({ displayName: ' Redaktion ', description: ' Text ' }),
        normalizeRoleGeneralDraft({ displayName: 'Redaktion', description: 'Text' })
      )
    ).toBe(true);
  });

  it('detects permission and scope changes in canonical order', () => {
    const stored = [{ permissionId: 'permission-1', accessScope: 'own' as const }];

    expect(areRolePermissionDraftsEqual(stored, stored)).toBe(true);
    expect(
      areRolePermissionDraftsEqual(stored, [
        { permissionId: 'permission-1', accessScope: 'organization' },
      ])
    ).toBe(false);
  });
});
