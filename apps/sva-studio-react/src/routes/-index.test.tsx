import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePage } from './-home-page';

const useAuthMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

describe('HomePage IAM integration', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
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

    window.history.replaceState({}, '', '/?error=auth.insufficientRole');

    render(<HomePage />);

    expect(
      screen.getByText('Keine Berechtigung für diese Seite. Bitte wenden Sie sich an die Administration.')
    ).toBeTruthy();
  });
});
