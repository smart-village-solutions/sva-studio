import { describe, expect, it } from 'vitest';

import { summarizeContentAccess, withServerDeniedContentAccess } from './content-management.ts';

describe('content-management access helpers', () => {
  it('marks content as editable when read and update permissions are allowed', () => {
    expect(
      summarizeContentAccess([
        {
          action: 'content.read',
          resourceType: 'content',
          effect: 'allow',
          organizationId: 'org-1',
          provenance: { sourceKinds: ['direct_role'] },
        },
        {
          action: 'content.update',
          resourceType: 'content',
          effect: 'allow',
          organizationId: 'org-1',
          provenance: { sourceKinds: ['group_role'] },
        },
      ])
    ).toEqual({
      state: 'editable',
      canRead: true,
      canCreate: false,
      canUpdate: true,
      organizationIds: ['org-1'],
      sourceKinds: ['direct_role', 'group_role'],
    });
  });

  it('marks content as read only when only read permission exists', () => {
    expect(
      summarizeContentAccess([
        {
          action: 'content.read',
          resourceType: 'content',
          effect: 'allow',
        },
      ])
    ).toEqual({
      state: 'read_only',
      canRead: true,
      canCreate: false,
      canUpdate: false,
      reasonCode: 'content_update_missing',
      organizationIds: [],
      sourceKinds: [],
    });
  });

  it('marks content as blocked when read is missing', () => {
    expect(summarizeContentAccess([])).toEqual({
      state: 'blocked',
      canRead: false,
      canCreate: false,
      canUpdate: false,
      reasonCode: 'context_restricted',
      organizationIds: [],
      sourceKinds: [],
    });
  });

  it('can convert any access summary into a server denied state', () => {
    expect(
      withServerDeniedContentAccess({
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: ['org-1'],
        sourceKinds: ['direct_role'],
      })
    ).toEqual({
      state: 'server_denied',
      canRead: true,
      canCreate: true,
      canUpdate: false,
      reasonCode: 'server_forbidden',
      organizationIds: ['org-1'],
      sourceKinds: ['direct_role'],
    });
  });
});
