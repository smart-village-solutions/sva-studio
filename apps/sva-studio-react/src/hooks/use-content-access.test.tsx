import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useContentAccess } from './use-content-access';

const authMockValue = {
  user: {
    id: 'editor-1',
    name: 'Editor',
    roles: ['editor'],
    instanceId: 'de-musterhausen',
  },
  invalidatePermissions: vi.fn(),
};

const asIamErrorMock = vi.fn((error: unknown) => error);

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
  asIamError: (...args: Parameters<typeof asIamErrorMock>) => asIamErrorMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('useContentAccess', () => {
  beforeEach(() => {
    authMockValue.user = {
      id: 'editor-1',
      name: 'Editor',
      roles: ['editor'],
      instanceId: 'de-musterhausen',
    };
    authMockValue.invalidatePermissions.mockReset();
    asIamErrorMock.mockReset();
    asIamErrorMock.mockImplementation((error: unknown) => error);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an idle state when no instance is available', () => {
    authMockValue.user = {
      id: 'editor-1',
      name: 'Editor',
      roles: ['editor'],
      instanceId: undefined,
    } as unknown as typeof authMockValue.user;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useContentAccess());

    expect(result.current).toEqual({
      access: null,
      isLoading: false,
      error: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('summarizes fetched permissions into content access', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        permissions: [
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
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useContentAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.access).toEqual({
        state: 'editable',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        organizationIds: ['org-1'],
        sourceKinds: ['direct_role', 'group_role'],
      });
      expect(result.current.error).toBeNull();
    });

    expect(fetchMock).toHaveBeenCalledWith('/iam/me/permissions?instanceId=de-musterhausen', {
      credentials: 'include',
      signal: expect.any(AbortSignal),
    });
  });

  it('invalidates permissions and exposes a server denied access state on 403', async () => {
    const forbiddenError = { status: 403, code: 'forbidden', message: 'Forbidden' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal('fetch', fetchMock);
    asIamErrorMock.mockImplementation(() => forbiddenError);

    const { result } = renderHook(() => useContentAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(forbiddenError);
      expect(result.current.access).toEqual({
        state: 'server_denied',
        canRead: false,
        canCreate: false,
        canUpdate: false,
        reasonCode: 'server_forbidden',
        organizationIds: [],
        sourceKinds: [],
      });
    });

    expect(authMockValue.invalidatePermissions).toHaveBeenCalledTimes(1);
  });
});