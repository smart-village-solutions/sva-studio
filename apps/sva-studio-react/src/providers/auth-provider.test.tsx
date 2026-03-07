import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './auth-provider';

const AuthProbe = () => {
  const auth = useAuth();

  return (
    <div>
      <p data-testid="status">{auth.isLoading ? 'loading' : 'ready'}</p>
      <p data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</p>
      <p data-testid="user-name">{auth.user?.name ?? 'none'}</p>
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
  afterEach(() => {
    cleanup();
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
            name: 'Ada',
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
    expect(screen.getByTestId('user-name').textContent).toBe('Ada');
    expect(screen.getByTestId('user-roles').textContent).toBe('editor');
  });

  it('falls back to unauthenticated user when /auth/me is not ok', async () => {
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
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('user-name').textContent).toBe('none');
  });

  it('supports explicit refetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            name: 'Ada',
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
            name: 'Ada Updated',
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
      expect(screen.getByTestId('user-name').textContent).toBe('Ada');
    });

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }));

    await waitFor(() => {
      expect(screen.getByTestId('user-name').textContent).toBe('Ada Updated');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/auth/me', { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/auth/me', { credentials: 'include' });
  });

  it('invalidates permissions via silent auth refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 'user-1',
            name: 'Ada',
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
            name: 'Ada',
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
            name: 'Ada',
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

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });
});
