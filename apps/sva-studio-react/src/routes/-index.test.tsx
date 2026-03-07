import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePage } from './-home-page';

const useAuthMock = vi.fn();

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

describe('HomePage IAM integration', () => {
  afterEach(() => {
    cleanup();
    globalThis.history.replaceState({}, '', '/');
    useAuthMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('calls /iam/authorize for authenticated users with instanceId', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          allowed: true,
          reason: 'allowed_by_rbac',
        }),
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Erlaubt \(allowed_by_rbac\)/)).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/iam/authorize',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('shows denied decision when /iam/authorize returns non-OK status', async () => {
    const invalidatePermissions = vi.fn();
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-2',
        name: 'Denied User',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 403,
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Verweigert \(authorize_http_403\)/)).toBeTruthy();
    });
    expect(invalidatePermissions).toHaveBeenCalledTimes(1);
  });

  it('shows denied decision without invalidating permissions for non-403 status', async () => {
    const invalidatePermissions = vi.fn();
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-4',
        name: 'Server Error User',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 500,
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Verweigert \(authorize_http_500\)/)).toBeTruthy();
    });

    expect(invalidatePermissions).not.toHaveBeenCalled();
  });

  it('ignores authorize success response when component unmounts before fetch resolves', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-unmount-success',
        name: 'Unmount Success',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    const deferred = createDeferred<Partial<Response>>();
    const fetchMock = vi.fn().mockImplementation(() => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<HomePage />);
    unmount();

    deferred.resolve({
      ok: true,
      json: async () => ({ allowed: true, reason: 'late_success' }),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText(/late_success/)).toBeNull();
  });

  it('stops processing 403 flow when component unmounts during permission invalidation', async () => {
    const invalidateDeferred = createDeferred<void>();
    const invalidatePermissions = vi.fn().mockImplementation(() => invalidateDeferred.promise);
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-unmount-403',
        name: 'Unmount Forbidden',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 403,
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<HomePage />);

    await waitFor(() => {
      expect(invalidatePermissions).toHaveBeenCalledTimes(1);
    });

    unmount();
    invalidateDeferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText(/authorize_http_403/)).toBeNull();
  });

  it('shows caught authorize error reason when authorize request fails', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-5',
        name: 'Offline User',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    const fetchMock = vi.fn().mockRejectedValue(new Error('network_down'));

    vi.stubGlobal('fetch', fetchMock);
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Verweigert \(network_down\)/)).toBeTruthy();
    });
  });

  it('ignores caught authorize error when component unmounts before rejection arrives', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-unmount-catch',
        name: 'Unmount Catch',
        roles: ['editor'],
        instanceId: '11111111-1111-1111-8111-111111111111',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    const deferred = createDeferred<never>();
    const fetchMock = vi.fn().mockImplementation(() => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<HomePage />);
    unmount();

    deferred.reject(new Error('late_error'));
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText(/late_error/)).toBeNull();
  });

  it('does not call /iam/authorize when user has no instanceId', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-3',
        name: 'No Instance User',
        roles: ['editor'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    render(<HomePage />);

    expect(screen.getByText('No Instance User')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Keine Authorize-Entscheidung verfügbar.')).toBeTruthy();
  });

  it('shows a helpful message after insufficient role redirect', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    globalThis.history.replaceState({}, '', '/?error=auth.insufficientRole');

    render(<HomePage />);

    expect(
      screen.getByText('Keine Berechtigung für diese Seite. Bitte wenden Sie sich an die Administration.')
    ).toBeTruthy();
  });

  it('shows auth query error message for failed login', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    globalThis.history.replaceState({}, '', '/?auth=error');

    render(<HomePage />);

    expect(screen.getByText('Login fehlgeschlagen. Bitte erneut versuchen.')).toBeTruthy();
  });

  it('shows auth query error message for expired login state', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    globalThis.history.replaceState({}, '', '/?auth=state-expired');

    render(<HomePage />);

    expect(screen.getByText('Login abgebrochen oder abgelaufen. Bitte erneut anmelden.')).toBeTruthy();
  });

  it('shows generic auth load error from auth provider state', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: new Error('session-failed'),
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByText('Fehler beim Laden der Session. Bitte erneut anmelden.')).toBeTruthy();
  });
});
