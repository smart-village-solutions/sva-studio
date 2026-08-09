import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useContentAccess } from './use-content-access';

const effectiveAccessMock = {
  snapshot: {
    status: 'unresolved',
    scope: { kind: 'tenant', authGeneration: 1, instanceId: 'instance-1', organizationId: null, moduleAssignmentGeneration: 1 },
    generation: 1,
  } as Record<string, unknown>,
  permissionActions: [] as readonly string[],
  unscopedPermissionActions: [] as readonly string[],
};

vi.mock('../providers/effective-access-provider', () => ({
  useEffectiveAccess: () => effectiveAccessMock,
}));

vi.mock('../lib/iam-api', () => ({
  IamHttpError: class IamHttpError extends Error {
    status: number;
    code: string;
    constructor(input: { status: number; code: string; message: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
    }
  },
}));

describe('useContentAccess', () => {
  beforeEach(() => {
    effectiveAccessMock.snapshot = {
      status: 'unresolved',
      scope: { kind: 'tenant', authGeneration: 1, instanceId: 'instance-1', organizationId: null, moduleAssignmentGeneration: 1 },
      generation: 1,
    };
    effectiveAccessMock.permissionActions = [];
    effectiveAccessMock.unscopedPermissionActions = [];
  });

  it('fails closed while the shared access snapshot is unresolved', () => {
    const { result } = renderHook(() => useContentAccess());
    expect(result.current).toEqual({
      access: null,
      permissionActions: [],
      unscopedPermissionActions: [],
      isLoading: true,
      error: null,
    });
  });

  it('projects content access from the shared ready snapshot', () => {
    effectiveAccessMock.snapshot = {
      status: 'ready',
      scope: { kind: 'tenant', authGeneration: 2, instanceId: 'instance-1', organizationId: 'org-1', moduleAssignmentGeneration: 2 },
      generation: 2,
      assignedModules: ['news'],
      permissions: [
        { action: 'content.read', organizationId: 'org-1', provenance: { sourceKinds: ['direct_role'] } },
        { action: 'content.updatePayload', organizationId: 'org-1', provenance: { sourceKinds: ['group_role'] } },
        { action: 'news.read' },
      ],
    };
    effectiveAccessMock.permissionActions = ['content.read', 'content.updatePayload', 'news.read'];
    effectiveAccessMock.unscopedPermissionActions = ['content.read', 'news.read'];

    const { result } = renderHook(() => useContentAccess());
    expect(result.current.access).toEqual({
      state: 'editable',
      canRead: true,
      canCreate: false,
      canUpdate: true,
      organizationIds: ['org-1'],
      sourceKinds: ['direct_role', 'group_role'],
    });
    expect(result.current.permissionActions).toEqual([
      'content.read',
      'content.updatePayload',
      'news.read',
    ]);
    expect(result.current.unscopedPermissionActions).toEqual(['content.read', 'news.read']);
  });

  it('does not reuse tenant actions for a platform snapshot', () => {
    effectiveAccessMock.snapshot = {
      status: 'ready',
      scope: { kind: 'platform', authGeneration: 2 },
      generation: 2,
      platformRoles: ['instance_registry_admin'],
    };
    effectiveAccessMock.permissionActions = ['content.read'];

    expect(renderHook(() => useContentAccess()).result.current).toEqual({
      access: null,
      permissionActions: [],
      unscopedPermissionActions: [],
      isLoading: false,
      error: null,
    });
  });

  it('returns a denied summary for a server forbidden snapshot without triggering a refetch', () => {
    effectiveAccessMock.snapshot = {
      status: 'error',
      scope: { kind: 'tenant', authGeneration: 3, instanceId: 'instance-1', organizationId: null, moduleAssignmentGeneration: 3 },
      generation: 3,
      errorCode: 'forbidden',
    };

    const { result } = renderHook(() => useContentAccess());
    expect(result.current.access).toMatchObject({ state: 'server_denied', canRead: false, canUpdate: false });
    expect(result.current.permissionActions).toEqual([]);
    expect(result.current.error).toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('preserves non-forbidden snapshot error codes as unavailable IAM errors', () => {
    effectiveAccessMock.snapshot = {
      status: 'error',
      scope: { kind: 'tenant', authGeneration: 4, instanceId: 'instance-1', organizationId: null, moduleAssignmentGeneration: 4 },
      generation: 4,
      errorCode: 'database_unavailable',
    };

    const { result } = renderHook(() => useContentAccess());

    expect(result.current.access).toBeNull();
    expect(result.current.error).toMatchObject({ status: 503, code: 'database_unavailable' });
  });
});
