/**
 * Unit-Tests für Header-Auth-Aktionen und Loading-Zustand.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';

const useAuthMock = vi.fn();

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    reloadDocument: _reloadDocument,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
    reloadDocument?: boolean;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

/**
 * Testet die Auth-bezogene Darstellung des Headers.
 */
describe('Header auth actions', () => {
  /**
   * Bereinigt DOM und globale Mocks nach jedem Test.
   */
  afterEach(() => {
    cleanup();
    useAuthMock.mockReset();
    vi.unstubAllEnvs();
  });

  it('zeigt nur Login für unauthenticated user', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Login' })).not.toBeNull();
    });

    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Konto' })).toBeNull();
  });

  it('zeigt Logout für authenticated user und Konto-Link', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeNull();
    });

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Konto' }).getAttribute('href')).toBe('/account');
    expect(screen.queryByRole('link', { name: 'Benutzer' })).toBeNull();
  });

  it('zeigt Admin-Navigation für system_admin', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-admin',
        name: 'Admin User',
        roles: ['system_admin'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Header />);

    expect(screen.getByRole('link', { name: 'Benutzer' }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: 'Rollen' }).getAttribute('href')).toBe('/admin/roles');
  });

  it('zeigt Skeleton im Loading-Modus', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Header isLoading />);

    expect(screen.getByText('Authentifizierungsstatus wird geladen.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
  });
});
