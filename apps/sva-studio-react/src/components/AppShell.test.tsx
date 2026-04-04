/**
 * Unit-Tests für Struktur und Loading-Verhalten der AppShell.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppShell from './AppShell';

const useAuthMock = vi.fn();

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  useRouterState: (options?: { select?: (state: { location: { pathname: string } }) => unknown }) => {
    const state = { location: { pathname: '/' } };
    return options?.select ? options.select(state) : state;
  },
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; activeOptions?: unknown }) => {
    const { activeOptions: _activeOptions, ...anchorProps } = props;
    return (
    <a href={to} {...anchorProps}>
      {children}
    </a>
    );
  },
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../providers/theme-provider', () => ({
  useTheme: () => ({
    mode: 'light',
    themeName: 'sva-default',
    themeLabel: 'SVA Studio',
    setMode: vi.fn(),
    toggleMode: vi.fn(),
  }),
}));

vi.mock('../providers/locale-provider', () => ({
  useLocale: () => ({
    locale: 'de',
    setLocale: vi.fn(),
  }),
}));

vi.mock('./OrganizationContextSwitcher', () => ({
  OrganizationContextSwitcher: () => <div data-testid="organization-context-switcher">Organization Context</div>,
}));

vi.mock('./LegalTextAcceptanceDialog', () => ({
  LegalTextAcceptanceDialog: () => <div data-testid="legal-text-acceptance-dialog" />,
}));

vi.mock('./RuntimeHealthIndicator', () => ({
  RuntimeHealthIndicator: () => <div data-testid="runtime-health-indicator" />,
}));

/**
 * Führt nach jedem Test ein DOM-Cleanup aus.
 */
afterEach(() => {
  cleanup();
  useAuthMock.mockReset();
});

beforeEach(() => {
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
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  });
});

/**
 * Testet das Rendering der AppShell in regulären und Loading-Zuständen.
 */
describe('AppShell', () => {
  it('rendert Sidebar und Main-Landmark', () => {
    render(
      <AppShell currentPathname="/admin/users/123">
        <div>Inhalt</div>
      </AppShell>
    );

    expect(screen.getByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    const breadcrumbNavigation = screen.getByRole('navigation', { name: 'Brotkrumen-Navigation' });
    expect(breadcrumbNavigation).toBeTruthy();
    expect(within(breadcrumbNavigation).getByRole('link', { name: 'Übersicht' }).getAttribute('href')).toBe('/');
    expect(within(breadcrumbNavigation).getByRole('link', { name: 'Benutzerverwaltung' }).getAttribute('href')).toBe('/admin/users');
    expect(within(breadcrumbNavigation).getByText('Nutzer bearbeiten')).toBeTruthy();
    expect(screen.getByText('Inhalt')).toBeTruthy();
    expect(screen.getByTestId('runtime-health-indicator')).toBeTruthy();
  });

  it('zeigt Skeleton-Content im Ladezustand', () => {
    render(
      <AppShell isLoading>
        <div>Inhalt</div>
      </AppShell>
    );

    expect(screen.getByLabelText('Inhalt lädt')).toBeTruthy();
    expect(screen.queryByText('Inhalt')).toBeNull();
  });

  it('versteckt die Sidebar fuer nicht eingeloggte Nutzer', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    render(
      <AppShell>
        <div>Inhalt</div>
      </AppShell>
    );

    expect(screen.queryByLabelText('Seitenleiste')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Navigation öffnen' })).toBeNull();
    expect(screen.getByRole('main')).toBeTruthy();
  });
});
