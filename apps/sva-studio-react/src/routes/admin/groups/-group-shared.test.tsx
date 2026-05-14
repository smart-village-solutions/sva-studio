import { describe, expect, it } from 'vitest';

import {
  createGroupFormValues,
  diffGroupRoleIds,
  normalizeGroupKey,
  toCreateGroupPayload,
} from './-group-shared';

describe('group shared helpers', () => {
  it('normalizes group keys', () => {
    expect(normalizeGroupKey(' Admins Team ')).toBe('admins_team');
  });

  it('builds the create payload from form values', () => {
    expect(
      toCreateGroupPayload({
        groupKey: ' Admins Team ',
        displayName: ' Admins Team ',
        description: ' Administrative Gruppe ',
      })
    ).toEqual({
      groupKey: 'admins_team',
      displayName: 'Admins Team',
      description: 'Administrative Gruppe',
    });
  });

  it('provides role diffs for group detail updates', () => {
    expect(diffGroupRoleIds(['role-1'], ['role-2', 'role-1'])).toEqual({
      roleIdsToAssign: ['role-2'],
      roleIdsToRemove: [],
    });
    expect(diffGroupRoleIds(['role-1', 'role-2'], ['role-2'])).toEqual({
      roleIdsToAssign: [],
      roleIdsToRemove: ['role-1'],
    });
  });

  it('provides the default group form state', () => {
    expect(createGroupFormValues()).toEqual({
      groupKey: '',
      displayName: '',
      description: '',
    });
  });
});
