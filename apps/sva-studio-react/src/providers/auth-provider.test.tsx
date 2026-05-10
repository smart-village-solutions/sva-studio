import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAuthDiagnosticTrail, readAuthDiagnosticTrail } from '../lib/auth-diagnostics';
import { AuthProvider, useAuth } from './auth-provider';

const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const localStorageState = new Map<string, string>();
const sessionStorageState = new Map<string, string>();
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
const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStorageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    sessionStorageState.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    sessionStorageState.delete(key);
  }),
  clear: vi.fn(() => {
    sessionStorageState.clear();
  }),
};

const createJsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'X-Request-Id': `req-${status}`,
    },
  });

const requireScheduledCallback = (callback: (() => void) | null): (() => void) => {
  if (callback === null) {
    throw new Error('Expected scheduled auth refresh callback to be registered.');
  }
  return callback;
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
      <p data-testid="dev-auth-available">{auth.isDevAuthAvailable ? 'yes' : 'no'}</p>
      <p data-testid="user-id">{auth.user?.id ?? 'none'}</p>
      <p data-testid="user-roles">{auth.user?.roles.join(',') ?? 'none'}</p>
      <button type="button" onClick={() => void auth.refetch()}>
        refetch
      </button>
      <button type="button" onClick={() => void auth.loginWithDevAuth()}>
        dev-login
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
    clearAuthDiagnosticTrail();
    vi.stubEnv('VITE_SVA_DEV_AUTH', 'false');
    vi.stubEnv('VITE_MOCK_AUTH', 'false');
    localStorageState.clear();
    sessionStorageState.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    sessionStorageMock.clear.mockClear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock,
    });
  });

  afterEach(() => {
    clearAuthDiagnosticTrail();
    cleanup();
    vi.useRealTimers();
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
    localStorageState.clear();
    sessionStorageState.clear();
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('loads authenticated user via /auth/me', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse(200, {
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      )
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
    expect(screen.getByTestId('dev-auth-available').textContent).toBe('no');
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

  it('refreshes the session shortly before cookie expiry', async () => {
    const now = new Date('2026-05-06T12:00:00.000Z');
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
    let scheduledCallback: (() => void) | null = null;
    const originalSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation(
      ((handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
        if (timeout === 60_000 && scheduledCallback === null && typeof handler === 'function') {
          const callback = handler as (...callbackArgs: unknown[]) => void;
          scheduledCallback = () => {
            callback(...args);
          };
        }
        return originalSetTimeout(handler, timeout, ...args);
      }) as typeof window.setTimeout
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          expiresAt: now.getTime() + 120_000,
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          expiresAt: now.getTime() + 240_000,
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(scheduledCallback).not.toBeNull();

    requireScheduledCallback(scheduledCallback)();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(readAuthDiagnosticTrail()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'auth_pre_expiry_recovery_scheduled' }),
        expect.objectContaining({ event: 'auth_pre_expiry_recovery_started' }),
      ])
    );

    unmount();
    setTimeoutSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  it('retries before expiry when pre-expiry renewal keeps the same expiry', async () => {
    const baseTime = new Date('2026-05-06T12:00:00.000Z');
    let currentTimeMs = baseTime.getTime();
    const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTimeMs);
    const scheduledCallbacks: Array<() => void> = [];
    const scheduledAuthTimeouts: number[] = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation(
      ((handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
        if (
          typeof handler === 'function' &&
          typeof timeout === 'number' &&
          timeout >= 59_000 &&
          timeout <= 60_000
        ) {
          const callback = handler as (...callbackArgs: unknown[]) => void;
          scheduledAuthTimeouts.push(timeout);
          scheduledCallbacks.push(() => {
            callback(...args);
          });
        }
        return originalSetTimeout(handler, timeout, ...args);
      }) as typeof window.setTimeout
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          expiresAt: baseTime.getTime() + 120_000,
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          expiresAt: baseTime.getTime() + 120_000,
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    currentTimeMs += 60_000;
    await act(async () => {
      scheduledCallbacks[0]?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(scheduledAuthTimeouts).toEqual([60_000, 59_000]);
    expect(scheduledCallbacks).toHaveLength(2);

    setTimeoutSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  it('resolves to the signed-out state immediately while silent recovery still runs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'invalid',
            classification: 'session_store_or_session_hydration',
            status: 'recovery_laeuft',
            recommendedAction: 'erneut_anmelden',
            safeDetails: {
              reason_code: 'invalid_session',
            },
          },
          requestId: 'req-auth-401',
        })
      )
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
      .mockResolvedValueOnce(
        createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'expired',
            classification: 'session_store_or_session_hydration',
            status: 'recovery_laeuft',
            recommendedAction: 'erneut_anmelden',
            safeDetails: {
              reason_code: 'session_expired',
            },
          },
          requestId: 'req-auth-401',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'user-2',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      );

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
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(401, {
        error: {
          code: 'unauthorized',
          message: 'expired',
          classification: 'session_store_or_session_hydration',
          status: 'recovery_laeuft',
          recommendedAction: 'erneut_anmelden',
          safeDetails: {
            reason_code: 'session_expired',
          },
        },
        requestId: 'req-auth-401',
      })
    );

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
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(401, {
        error: {
          code: 'unauthorized',
          message: 'expired',
          classification: 'session_store_or_session_hydration',
          status: 'recovery_laeuft',
          recommendedAction: 'erneut_anmelden',
          safeDetails: {
            reason_code: 'session_expired',
          },
        },
        requestId: 'req-auth-401',
      })
    );
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

    expect(assignMock).toHaveBeenCalledWith(
      '/?auth=session-expired&returnTo=%2Fadmin%2Fusers%3Fpage%3D2'
    );

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('marks a known session as expired when auth me still returns 401 after successful recovery', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'expired',
            classification: 'session_store_or_session_hydration',
            status: 'recovery_laeuft',
            recommendedAction: 'erneut_anmelden',
            safeDetails: {
              reason_code: 'session_expired',
            },
          },
          requestId: 'req-auth-401',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'expired-again',
            classification: 'session_store_or_session_hydration',
            status: 'recovery_laeuft',
            recommendedAction: 'erneut_anmelden',
            safeDetails: {
              reason_code: 'session_expired',
            },
          },
          requestId: 'req-auth-401-retry',
        })
      );
    const assignMock = vi.fn();
    const originalLocation = window.location;

    window.localStorage.setItem('sva_auth_had_session', '1');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: originalLocation.origin,
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
        data: { type: 'sva-auth:silent-sso', status: 'success' },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-recovery-failed').textContent).toBe('yes');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(assignMock).toHaveBeenCalledWith('/?auth=session-expired&returnTo=%2Fadmin%2Fusers%3Fpage%3D2');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('ignores cross-origin silent-sso messages and accepts same-origin success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'expired',
            classification: 'session_store_or_session_hydration',
            status: 'recovery_laeuft',
            recommendedAction: 'erneut_anmelden',
            safeDetails: {
              reason_code: 'session_expired',
            },
          },
          requestId: 'req-auth-401',
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'user-3',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      );

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
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'user-1',
            roles: ['admin'],
            instanceId: 'instance-1',
          },
        })
      );

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
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'user-1',
            roles: ['system_admin'],
            instanceId: 'instance-1',
          },
        })
      );

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
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'user-1',
            roles: ['editor'],
            instanceId: 'instance-1',
          },
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, { ok: true }));

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

  it('supports explicit local dev login and uses the dedicated endpoint for logout in dev auth mode', async () => {
    vi.stubEnv('VITE_SVA_DEV_AUTH', 'true');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(401, {
          error: {
            code: 'unauthorized',
            message: 'missing session',
            classification: 'session_store_or_session_hydration',
            status: 'recovery_laeuft',
            recommendedAction: 'erneut_anmelden',
            safeDetails: {
              reason_code: 'missing_session_cookie',
            },
          },
          requestId: 'req-auth-401',
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          user: {
            id: 'dev:local-admin',
            roles: ['system_admin'],
            instanceId: 'de-musterhausen',
          },
        })
      )
      .mockResolvedValueOnce(createJsonResponse(200, { ok: true }));

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    expect(screen.getByTestId('dev-auth-available').textContent).toBe('yes');

    fireEvent.click(screen.getByRole('button', { name: 'dev-login' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/auth/dev-login?returnTo=%2F',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/auth/dev-logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('stores a diagnostic trail with a shared authFlowId for failed recovery redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(401, {
        error: {
          code: 'unauthorized',
          message: 'expired',
          classification: 'session_store_or_session_hydration',
          status: 'recovery_laeuft',
          recommendedAction: 'erneut_anmelden',
          safeDetails: {
            reason_code: 'session_expired',
          },
        },
        requestId: 'req-session-expired',
      })
    );
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
      expect(assignMock).toHaveBeenCalled();
    });

    const trail = readAuthDiagnosticTrail();
    expect(
      trail.some(
        (entry) =>
          entry.event === 'auth_me_401_received' && entry.requestId === 'req-session-expired'
      )
    ).toBe(true);
    expect(trail.some((entry) => entry.event === 'auth_redirect_session_expired')).toBe(true);
    expect(trail[0]?.authFlowId).toBeTruthy();
    expect(new Set(trail.map((entry) => entry.authFlowId)).size).toBe(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
