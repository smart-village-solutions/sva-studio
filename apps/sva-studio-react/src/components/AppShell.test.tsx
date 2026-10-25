/**
 * Unit-Tests für Struktur und Loading-Verhalten der AppShell.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppShell from './AppShell';
import { setActiveLocale } from '../i18n';

const useAuthMock = vi.fn();
const retryEffectiveAccessMock = vi.fn();
const effectiveAccessMock = {
  snapshot: {
    status: 'ready',
    scope: { kind: 'tenant', instanceId: 'tenant-a' },
  },
  permissionActions: [] as string[],
  retry: retryEffectiveAccessMock,
};

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  useRouterState: (options?: {
    select?: (state: { location: { pathname: string } }) => unknown;
  }) => {
    const state = { location: { pathname: '/' } };
    return options?.select ? options.select(state) : state;
  },
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; activeOptions?: unknown }) => {
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

vi.mock('../providers/effective-access-provider', () => ({
  useEffectiveAccess: () => effectiveAccessMock,
}));

vi.mock('../hooks/use-organization-context', () => ({
  useOrganizationContext: () => ({
    context: null,
    organizations: [],
    isLoading: false,
    error: null,
    setActiveOrganization: vi.fn(),
    refresh: vi.fn(),
  }),
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
  OrganizationContextSwitcher: () => (
    <div data-testid="organization-context-switcher">Organization Context</div>
  ),
}));

vi.mock('./LegalTextAcceptanceDialog', () => ({
  LegalTextAcceptanceDialog: () => <div data-testid="legal-text-acceptance-dialog" />,
}));

vi.mock('./ContextualHelpBoundary', () => ({
  ContextualHelpBoundary: ({
    children,
    enabled = true,
    pageId,
  }: {
    children: React.ReactNode;
    enabled?: boolean;
    pageId: string;
  }) => (
    <div data-testid={enabled ? 'contextual-help' : undefined}>
      {pageId}
      {children}
    </div>
  ),
}));

vi.mock('./RuntimeHealthIndicator', () => ({
  RuntimeHealthIndicator: () => <div data-testid="runtime-health-indicator" />,
}));

vi.mock('./Sidebar', () => ({
  default: ({ isLoading = false }: { isLoading?: boolean }) => (
    <aside aria-label="Seitenleiste">
      <span>{isLoading ? 'Sidebar Loading' : 'Sidebar Ready'}</span>
    </aside>
  ),
}));

/**
 * Führt nach jedem Test ein DOM-Cleanup aus.
 */
afterEach(() => {
  cleanup();
  setActiveLocale('de');
  useAuthMock.mockReset();
  retryEffectiveAccessMock.mockReset();
});

beforeEach(() => {
  effectiveAccessMock.snapshot = { status: 'ready', scope: { kind: 'tenant', instanceId: 'tenant-a' } };
  effectiveAccessMock.permissionActions = [];
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
    refreshSession: vi.fn(),
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
  it('rendert Sidebar und Main-Landmark', async () => {
    render(<AppShell currentPathname="/admin/users/123">Inhalt</AppShell>);

    expect(await screen.findByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('main').className).toContain('bg-background');
    expect(screen.getByRole('main').className).toContain('px-4');
    const breadcrumbNavigation = screen.getByRole('navigation', { name: 'Brotkrumen-Navigation' });
    expect(breadcrumbNavigation).toBeTruthy();
    expect(
      within(breadcrumbNavigation).getByRole('link', { name: 'Übersicht' }).getAttribute('href')
    ).toBe('/');
    expect(
      within(breadcrumbNavigation)
        .getByRole('link', { name: 'Benutzerverwaltung' })
        .getAttribute('href')
    ).toBe('/admin/users');
    expect(within(breadcrumbNavigation).getByText('Nutzer bearbeiten')).toBeTruthy();
    expect(screen.getByText('Inhalt')).toBeTruthy();
    expect(screen.getByText('Inhalt').closest('div')?.className).toContain('space-y-4');
    expect(screen.queryByTestId('runtime-health-indicator')).toBeNull();
  });

  const setRolelessSession = () => {
    const auth = {
      ...useAuthMock(),
      user: {
        id: 'user-1',
        instanceId: 'tenant-a',
        roles: [] as string[],
        permissionActions: [] as string[],
        permissionStatus: 'ok',
      },
      hasResolvedSession: true,
      isRecoveringSession: false,
    };
    useAuthMock.mockReturnValue(auth);
    return auth;
  };

  it('explains successful registration and pending role assignment on any Studio page', () => {
    setRolelessSession();
    const view = render(<AppShell currentPathname="/content">Inhalt</AppShell>);

    const notice = screen.getByRole('status', { name: 'Anmeldung erfolgreich' });
    expect(notice.getAttribute('aria-live')).toBe('polite');
    expect(notice.textContent).toContain('Ihre erste Anmeldung');
    expect(notice.textContent).toContain('zuständige Administration');

    view.rerender(<AppShell currentPathname="/account">Profil</AppShell>);
    expect(screen.getByRole('status', { name: 'Anmeldung erfolgreich' })).toBeTruthy();
  });

  it.each(['anonymous', 'loading', 'unresolved', 'recovering', 'error', 'degraded', 'unknownPermissions'])(
    'does not confuse %s sessions with pending role assignment',
    (state) => {
      const auth = setRolelessSession();
      useAuthMock.mockReturnValue({
        ...auth,
        ...(state === 'anonymous' ? { user: null, isAuthenticated: false } : {}),
        ...(state === 'loading' ? { isLoading: true } : {}),
        ...(state === 'unresolved' ? { hasResolvedSession: false } : {}),
        ...(state === 'recovering' ? { isRecoveringSession: true } : {}),
        ...(state === 'error' ? { error: new Error('session failed') } : {}),
        ...(state === 'degraded' ? { user: { ...auth.user, permissionStatus: 'degraded' } } : {}),
        ...(state === 'unknownPermissions' ? { user: { ...auth.user, permissionActions: undefined } } : {}),
      });
      render(<AppShell>Inhalt</AppShell>);
      expect(screen.queryByRole('status', { name: 'Anmeldung erfolgreich' })).toBeNull();
    }
  );

  it.each(['loading', 'unresolved', 'error', 'foreignTenant', 'platform', 'permissions'])(
    'does not show the notice for a %s effective-access snapshot',
    (state) => {
      setRolelessSession();
      if (state === 'foreignTenant') effectiveAccessMock.snapshot.scope.instanceId = 'tenant-b';
      else if (state === 'platform') effectiveAccessMock.snapshot.scope.kind = 'platform';
      else if (state === 'permissions') effectiveAccessMock.permissionActions = ['news.read'];
      else effectiveAccessMock.snapshot.status = state;
      render(<AppShell>Inhalt</AppShell>);
      expect(screen.queryByRole('status', { name: 'Anmeldung erfolgreich' })).toBeNull();
    }
  );

  it('removes the notice once roles are assigned, including roles without effective actions', () => {
    const auth = setRolelessSession();
    const view = render(<AppShell>Inhalt</AppShell>);
    expect(screen.getByRole('status', { name: 'Anmeldung erfolgreich' })).toBeTruthy();

    useAuthMock.mockReturnValue({ ...auth, user: { ...auth.user, roles: ['editor'] } });
    view.rerender(<AppShell>Inhalt</AppShell>);
    expect(screen.queryByRole('status', { name: 'Anmeldung erfolgreich' })).toBeNull();
  });

  it('renders the pending-assignment notice in English', () => {
    setRolelessSession();
    setActiveLocale('en');
    render(<AppShell>Content</AppShell>);
    expect(screen.getByRole('status', { name: 'Sign-in successful' }).textContent).toContain('Your administrator');
  });

  it('versteckt die Breadcrumbs auf der Startseite', async () => {
    render(
      <AppShell currentPathname="/">
        <div>Startseite</div>
      </AppShell>
    );

    expect(screen.queryByRole('navigation', { name: 'Brotkrumen-Navigation' })).toBeNull();
    expect(screen.getByText('Startseite')).toBeTruthy();
    expect(screen.queryByTestId('runtime-health-indicator')).toBeNull();
  });

  it('haelt die Shell im Ladezustand gemountet und lokalisiert Pending auf den Contentbereich', async () => {
    render(
      <AppShell isLoading>
        <div>Inhalt</div>
      </AppShell>
    );

    const main = screen.getByRole('main');

    expect(await screen.findByText('Sidebar Ready')).toBeTruthy();
    expect(screen.queryByTestId('organization-context-switcher')).toBeNull();
    expect(screen.queryByText('Sidebar Loading')).toBeNull();
    expect(within(main).getByLabelText('Inhalt lädt')).toBeTruthy();
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(within(main).queryByText('Inhalt')).toBeNull();
  });

  it('versteckt die Sidebar fuer nicht eingeloggte Nutzer', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
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

  it('zeigt die kontextuelle Hilfe nicht fuer anonyme Nutzer', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <AppShell currentPathname="/" documentationPageId="home.overview">
        <div>Startseite</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('contextual-help')).toBeNull();
    });
  });

  it('haelt den Seiteninhalt beim Wiederherstellen der Sitzung gemountet', async () => {
    const mounted = vi.fn();
    const RouteContent = () => {
      React.useEffect(() => {
        mounted();
      }, []);
      return <div>Formular</div>;
    };

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    });

    const view = render(
      <AppShell currentPathname="/admin/users/123" documentationPageId="admin.users.edit">
        <RouteContent />
      </AppShell>
    );

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
      refreshSession: vi.fn(),
    });
    view.rerender(
      <AppShell currentPathname="/admin/users/123" documentationPageId="admin.users.edit">
        <RouteContent />
      </AppShell>
    );

    expect(mounted).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('contextual-help')).toBeTruthy();
  });

  it('laedt den Rechtstext-Dialog nicht fuer anonyme Nutzer nach der Hydrierung', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <AppShell currentPathname="/admin/users/123">
        <div>Inhalt</div>
      </AppShell>
    );

    await screen.findByRole('navigation', { name: 'Brotkrumen-Navigation' });
    await waitFor(() => {
      expect(screen.queryByTestId('legal-text-acceptance-dialog')).toBeNull();
    });
  });

  it('laedt den Rechtstext-Dialog fuer authentifizierte Nutzer nach der Hydrierung', async () => {
    render(
      <AppShell currentPathname="/admin/users/123">
        <div>Inhalt</div>
      </AppShell>
    );

    await screen.findByRole('navigation', { name: 'Brotkrumen-Navigation' });
    expect(await screen.findByTestId('legal-text-acceptance-dialog')).toBeTruthy();
  });
});
