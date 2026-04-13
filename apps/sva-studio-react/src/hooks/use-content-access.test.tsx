import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useContentAccess } from './use-content-access';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
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
  fetchWithRequestTimeout: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

vi.mock('@sva/sdk/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
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
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
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

    expect(fetchMock).toHaveBeenCalledWith(
      '/iam/me/permissions?instanceId=de-musterhausen',
      undefined,
      {
        signal: expect.any(AbortSignal),
        timeoutMs: 10_000,
      }
    );
    expect(browserLoggerMock.debug).toHaveBeenCalledWith(
      'content_access_load_succeeded',
      expect.objectContaining({ operation: 'load_content_access', instance_id: 'de-musterhausen' })
    );
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
    expect(browserLoggerMock.debug).toHaveBeenCalledWith(
      'permission_invalidated_after_403',
      expect.objectContaining({ operation: 'load_content_access', instance_id: 'de-musterhausen' })
    );
    expect(browserLoggerMock.warn).toHaveBeenCalledWith(
      'content_access_load_failed',
      expect.objectContaining({
        operation: 'load_content_access',
        instance_id: 'de-musterhausen',
        status: 403,
      })
    );
  });

  it('stores non-forbidden errors without invalidating permissions', async () => {
    const serverError = { status: 500, code: 'http_500', message: 'http_500' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    asIamErrorMock.mockImplementation(() => serverError);

    const { result } = renderHook(() => useContentAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(serverError);
      expect(result.current.access).toBeNull();
    });

    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });

  it('aborts pending requests on unmount without updating state afterwards', async () => {
    let rejectFetch: ((reason?: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectFetch = reject;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = renderHook(() => useContentAccess());

    expect(result.current.isLoading).toBe(true);

    unmount();
    rejectFetch?.(new Error('late failure'));
    await Promise.resolve();

    expect(asIamErrorMock).not.toHaveBeenCalled();
    expect(authMockValue.invalidatePermissions).not.toHaveBeenCalled();
  });
});
