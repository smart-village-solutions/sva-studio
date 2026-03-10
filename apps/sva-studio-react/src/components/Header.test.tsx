/**
 * Unit-Tests für Header-Auth-Aktionen und Loading-Zustand.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';

const useAuthMock = vi.fn();
const useThemeMock = vi.fn();

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    reloadDocument,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
    reloadDocument?: boolean;
  }) => {
    void reloadDocument;

    return (
      <a href={to} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../providers/theme-provider', () => ({
  useTheme: () => useThemeMock(),
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
    useThemeMock.mockReset();
    vi.unstubAllEnvs();
  });

  it('zeigt für unauthenticated user nur Branding und Login', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });
    useThemeMock.mockReturnValue({
      mode: 'light',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Login' })).not.toBeNull();
    });

    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
    expect(screen.queryByRole('link', { name: /SVA Studio/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Mein Konto' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Übersicht' })).toBeNull();
  });

  it('zeigt für authenticated user nur Branding und Logout', async () => {
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
    useThemeMock.mockReturnValue({
      mode: 'dark',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeNull();
    });

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('link', { name: /SVA Studio/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Mein Konto' }).getAttribute('href')).toBe('/account');
    expect(screen.queryByRole('link', { name: 'Benutzer' })).toBeNull();
  });

  it('zeigt auch für system_admin keine Navigationslinks im Header', () => {
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
    useThemeMock.mockReturnValue({
      mode: 'light',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });

    render(<Header />);

    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Benutzer' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Rollen' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Organisationen' })).toBeNull();
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
    useThemeMock.mockReturnValue({
      mode: 'light',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });

    render(<Header isLoading />);

    expect(screen.getByText('Authentifizierungsstatus wird geladen.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
  });

  it('delegates theme toggle to the theme provider', async () => {
    const toggleModeMock = vi.fn();

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });
    useThemeMock.mockReturnValue({
      mode: 'light',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: toggleModeMock,
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' })).toBeTruthy();
    });

    screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }).click();

    expect(toggleModeMock).toHaveBeenCalledTimes(1);
  });
});
