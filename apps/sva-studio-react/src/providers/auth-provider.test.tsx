import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './auth-provider';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const localStorageState = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageState.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageState.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageState.clear();
  }),
};

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

const AuthProbe = () => {
  const auth = useAuth();

  return (
    <div>
      <p data-testid="status">{auth.isLoading ? 'loading' : 'ready'}</p>
      <p data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</p>
      <p data-testid="has-resolved-session">{auth.hasResolvedSession ? 'yes' : 'no'}</p>
      <p data-testid="is-recovering-session">{auth.isRecoveringSession ? 'yes' : 'no'}</p>
      <p data-testid="session-recovery-failed">{auth.sessionRecoveryFailed ? 'yes' : 'no'}</p>
      <p data-testid="user-id">{auth.user?.id ?? 'none'}</p>
      <p data-testid="user-roles">{auth.user?.roles.join(',') ?? 'none'}</p>
      <button type="button" onClick={() => void auth.refetch()}>
        refetch
      </button>
      <button type="button" onClick={() => void auth.invalidatePermissions()}>
        invalidate
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorageState.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
  });

  afterEach(() => {
    cleanup();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
    localStorageState.clear();
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('loads authenticated user via /auth/me', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>)
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    expect(screen.getByTestId('has-resolved-session').textContent).toBe('yes');
    expect(screen.getByTestId('session-recovery-failed').textContent).toBe('no');
    expect(screen.getByTestId('user-id').textContent).toBe('user-1');
    expect(screen.getByTestId('user-roles').textContent).toBe('editor');
    expect(browserLoggerMock.info).toHaveBeenCalledWith(
      'auth_session_authenticated',
      expect.objectContaining({
        operation: 'load_session',
        instance_id: 'instance-1',
      })
    );
  });

  it('resolves to the signed-out state immediately while silent recovery still runs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } satisfies Partial<Response>)
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('yes');
    });

    expect(screen.getByTestId('status').textContent).toBe('ready');
    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('has-resolved-session').textContent).toBe('yes');
    expect(screen.getByTestId('user-id').textContent).toBe('none');

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'sva-auth:silent-sso', status: 'failure' },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('no');
    });

    expect(browserLoggerMock.info).toHaveBeenCalledWith(
      'auth_session_unauthenticated',
      expect.objectContaining({
        status: 401,
      })
    );
  });

  it('attempts silent session recovery once after a 401 and retries the session lookup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      } satisfies Partial<Response>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-2',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('yes');
    });
    expect(screen.getByTestId('status').textContent).toBe('ready');
    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('has-resolved-session').textContent).toBe('yes');

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'sva-auth:silent-sso', status: 'success' },
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('no');
    });
    expect(screen.getByTestId('has-resolved-session').textContent).toBe('yes');
    expect(browserLoggerMock.info).toHaveBeenCalledWith(
      'auth_silent_recovery_succeeded',
      expect.objectContaining({
        operation: 'silent_session_recovery',
      })
    );
  });

  it('stays unauthenticated when silent recovery fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('yes');
    });
    expect(screen.getByTestId('status').textContent).toBe('ready');
    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('has-resolved-session').textContent).toBe('yes');

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'sva-auth:silent-sso', status: 'failed' },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('is-recovering-session').textContent).toBe('no');
    expect(screen.getByTestId('session-recovery-failed').textContent).toBe('no');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('marks a known session as expired and redirects to the notice page after failed recovery', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } satisfies Partial<Response>);
    const assignMock = vi.fn();
    const originalLocation = window.location;

    window.localStorage.setItem('sva_auth_had_session', '1');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/admin/users',
        search: '?page=2',
        assign: assignMock,
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('yes');
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'sva-auth:silent-sso', status: 'failed' },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-recovery-failed').textContent).toBe('yes');
    });

    expect(assignMock).toHaveBeenCalledWith('/?auth=session-expired&returnTo=%2Fadmin%2Fusers%3Fpage%3D2');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('ignores cross-origin silent-sso messages and accepts same-origin success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 } satisfies Partial<Response>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-3',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('yes');
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://example.invalid',
        data: { type: 'sva-auth:silent-sso', status: 'success' },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-recovering-session').textContent).toBe('yes');
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'sva-auth:silent-sso', status: 'success' },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });
  });

  it('supports explicit refetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            roles: ['admin'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('user-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('user-1');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/auth/me',
      expect.objectContaining({
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/auth/me',
      expect.objectContaining({
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('invalidates permissions via silent auth refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            roles: ['system_admin'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    fireEvent.click(screen.getByRole('button', { name: 'invalidate' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-roles').textContent).toBe('system_admin');
    });

    expect(screen.getByTestId('status').textContent).toBe('ready');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resets local auth state on logout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        }),
      } satisfies Partial<Response>)
      .mockResolvedValueOnce({
        ok: true,
      } satisfies Partial<Response>);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });

    expect(screen.getByTestId('session-recovery-failed').textContent).toBe('no');
    expect(window.localStorage.getItem('sva_auth_had_session')).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-sva-logout-intent': 'user',
        },
        signal: expect.any(AbortSignal),
      })
    );
  });
});
