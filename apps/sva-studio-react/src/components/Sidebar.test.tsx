/**
 * Unit-Tests für Sidebar-Rendering, Loading-Zustand und A11y-Baseline.
 */
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

const useAuthMock = vi.fn();

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

afterEach(() => {
  cleanup();
  useAuthMock.mockReset();
  vi.unstubAllEnvs();
});

describe('Sidebar', () => {
  it('rendert im Loading-Zustand keine interaktiven Links', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Sidebar isLoading />);

    expect(screen.getByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Bereichsnavigation' })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('rendert Basislinks für unauthenticated Nutzer', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Übersicht' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('link', { name: 'Demos' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Plugin-Beispiel' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Admin-API-Test' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Mein Konto' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Benutzerverwaltung' })).toBeNull();
  });

  it('rendert IAM-Links für berechtigte Admin-Rollen', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Admin',
        roles: ['system_admin'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Mein Konto' }).getAttribute('href')).toBe('/account');
    expect(screen.getByRole('link', { name: 'Benutzerverwaltung' }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: 'Rollenverwaltung' }).getAttribute('href')).toBe('/admin/roles');
  });

  it('stellt die erwarteten A11y-Labels und Landmarks bereit', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(<Sidebar />);

    expect(screen.getByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Bereichsnavigation' })).toBeTruthy();
    expect(screen.getByText('Navigation')).toBeTruthy();
  });
});
