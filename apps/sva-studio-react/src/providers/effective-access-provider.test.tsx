import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EffectiveAccessProvider, useEffectiveAccess } from './effective-access-provider';

const fetchWithRequestTimeoutMock = vi.fn();
const iamMocks = vi.hoisted(() => ({
  readIamErrorResponse: vi.fn(),
}));
const authMockValue = {
  hasResolvedSession: true,
  isAuthenticated: true,
  isLoading: false,
  user: {
    id: 'user-1',
    instanceId: 'instance-1' as string | undefined,
    assignedModules: ['news'],
    roles: ['custom_role'],
  },
};
const organizationContextMockValue = {
  context: { activeOrganizationId: 'org-1' as string | null },
  error: null as null | { code: string },
  isLoading: false,
};

vi.mock('../lib/iam-api', () => ({
  EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT: 'sva:effective-access-invalidation-required',
  IamHttpError: class IamHttpError extends Error {
    status: number;
    code: string;
    constructor(input: { status: number; code: string; message: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
    }
  },
  asIamError: (cause: unknown) =>
    cause && typeof cause === 'object' && 'code' in cause
      ? cause
      : { status: 503, code: 'database_unavailable', message: 'database_unavailable' },
  fetchWithRequestTimeout: (...args: unknown[]) => fetchWithRequestTimeoutMock(...args),
  readIamErrorResponse: (...args: unknown[]) => iamMocks.readIamErrorResponse(...args),
}));

vi.mock('../lib/browser-operation-logging', () => ({
  createOperationLogger: () => ({}),
  logBrowserOperationFailure: vi.fn(),
}));

vi.mock('../hooks/use-organization-context', () => ({
  useOrganizationContext: () => organizationContextMockValue,
}));

vi.mock('./auth-provider', () => ({
  useAuth: () => authMockValue,
}));

const response = (
  permissions: readonly { action: string }[],
  instanceId = 'instance-1',
  snapshotVersion?: string
) => ({
  ok: true,
  json: async () => ({ instanceId, permissions, snapshotVersion }),
});

describe('EffectiveAccessProvider', () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <EffectiveAccessProvider>{children}</EffectiveAccessProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    authMockValue.hasResolvedSession = true;
    authMockValue.isAuthenticated = true;
    authMockValue.isLoading = false;
    authMockValue.user.instanceId = 'instance-1';
    authMockValue.user.assignedModules = ['news'];
    authMockValue.user.roles = ['custom_role'];
    organizationContextMockValue.context.activeOrganizationId = 'org-1';
    organizationContextMockValue.error = null;
    organizationContextMockValue.isLoading = false;
    fetchWithRequestTimeoutMock.mockResolvedValue(response([{ action: 'news.read' }]));
    iamMocks.readIamErrorResponse.mockResolvedValue({
      status: 403,
      code: 'forbidden',
      message: 'forbidden',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads one tenant snapshot and applies permission and module gates', async () => {
    fetchWithRequestTimeoutMock.mockResolvedValueOnce(
      response([{ action: 'news.read' }], 'instance-1', 'ir1-ur2')
    );
    const { result } = renderHook(() => useEffectiveAccess(), { wrapper });

    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    expect(result.current.permissionActions).toEqual(['news.read']);
    expect(result.current.snapshot).toMatchObject({ snapshotVersion: 'ir1-ur2' });
    expect(
      result.current.decide({
        kind: 'tenant',
        actions: { mode: 'allOf', values: ['news.read'] },
        moduleId: 'news',
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_permission' });
    expect(
      result.current.decide({
        kind: 'tenant',
        actions: { mode: 'allOf', values: ['news.read'] },
        moduleId: 'events',
      })
    ).toEqual({ status: 'denied', reason: 'module_assignment_missing' });
  });

  it('clears the old scope immediately and ignores a late response from it', async () => {
    let resolveFirst: ((value: ReturnType<typeof response>) => void) | undefined;
    const firstRequest = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveFirst = resolve;
    });
    fetchWithRequestTimeoutMock
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(response([{ action: 'events.read' }]));

    const { result, rerender } = renderHook(() => useEffectiveAccess(), { wrapper });
    await waitFor(() => expect(result.current.snapshot.status).toBe('loading'));

    organizationContextMockValue.context.activeOrganizationId = 'org-2';
    rerender();
    await waitFor(() => expect(result.current.permissionActions).toEqual(['events.read']));

    await act(async () => {
      resolveFirst?.(response([{ action: 'news.read' }]));
      await firstRequest;
    });

    expect(result.current.permissionActions).toEqual(['events.read']);
    expect(result.current.snapshot.scope).toMatchObject({
      kind: 'tenant',
      organizationId: 'org-2',
    });
  });

  it('retries only effective access without refreshing or revoking the session', async () => {
    fetchWithRequestTimeoutMock.mockRejectedValueOnce({ code: 'database_unavailable' });
    const { result } = renderHook(() => useEffectiveAccess(), { wrapper });

    await waitFor(() => expect(result.current.snapshot.status).toBe('error'));
    expect(result.current.permissionActions).toEqual([]);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));
    expect(result.current.permissionActions).toEqual(['news.read']);
    expect(fetchWithRequestTimeoutMock).toHaveBeenCalled();
    expect(fetchWithRequestTimeoutMock.mock.calls).toSatisfy((calls: unknown[][]) =>
      calls.every(([path]) => typeof path === 'string' && path.startsWith('/iam/me/permissions?'))
    );
  });

  it('preserves IAM error codes from permission snapshot responses', async () => {
    const failedResponse = { ok: false, status: 403 };
    fetchWithRequestTimeoutMock.mockResolvedValueOnce(failedResponse);
    const { result } = renderHook(() => useEffectiveAccess(), { wrapper });

    await waitFor(() => expect(result.current.snapshot.status).toBe('error'));

    expect(iamMocks.readIamErrorResponse).toHaveBeenCalledWith(failedResponse);
    expect(result.current.snapshot).toMatchObject({ errorCode: 'forbidden' });
  });

  it('classifies invalid permission snapshot payloads as invalid responses', async () => {
    fetchWithRequestTimeoutMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ instanceId: 'instance-1', permissions: null }),
    });
    const { result } = renderHook(() => useEffectiveAccess(), { wrapper });

    await waitFor(() => expect(result.current.snapshot.status).toBe('error'));

    expect(result.current.snapshot).toMatchObject({ errorCode: 'invalid_response' });
  });

  it('deduplicates local and server-triggered invalidation per snapshot generation', async () => {
    const { result } = renderHook(() => useEffectiveAccess(), { wrapper });
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    act(() => {
      result.current.invalidate();
      result.current.invalidate();
    });
    await waitFor(() => expect(fetchWithRequestTimeoutMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    act(() => {
      globalThis.dispatchEvent(new CustomEvent('sva:effective-access-invalidation-required'));
      globalThis.dispatchEvent(new CustomEvent('sva:effective-access-invalidation-required'));
    });
    await waitFor(() => expect(fetchWithRequestTimeoutMock).toHaveBeenCalledTimes(3));
  });

  it('uses only technical roles for platform access without loading tenant permissions', async () => {
    authMockValue.user.instanceId = undefined;
    authMockValue.user.roles = ['instance_registry_admin'];

    const { result } = renderHook(() => useEffectiveAccess(), { wrapper });
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    expect(fetchWithRequestTimeoutMock).not.toHaveBeenCalled();
    expect(
      result.current.decide({
        kind: 'platform',
        roles: { mode: 'anyOf', values: ['instance_registry_admin'] },
      })
    ).toEqual({ status: 'allowed', reason: 'allowed_by_permission' });
  });

  it('revokes module-gated access when the session module projection changes', async () => {
    const { result, rerender } = renderHook(() => useEffectiveAccess(), { wrapper });
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    authMockValue.user.assignedModules = [];
    rerender();
    await waitFor(() => expect(result.current.snapshot.status).toBe('ready'));

    expect(
      result.current.decide({
        kind: 'tenant',
        actions: { mode: 'allOf', values: ['news.read'] },
        moduleId: 'news',
      })
    ).toEqual({ status: 'denied', reason: 'module_assignment_missing' });
  });
});
