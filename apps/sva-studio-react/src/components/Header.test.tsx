/**
 * Unit-Tests für Header-Auth-Aktionen und Loading-Zustand.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthDiagnosticTrail, readAuthDiagnosticTrail, recordAuthDiagnosticEvent } from '../lib/auth-diagnostics';
import Header from './Header';

const useAuthMock = vi.fn();
const useLocaleMock = vi.fn();
const useThemeMock = vi.fn();
const useOrganizationContextMock = vi.fn();
const organizationContextSwitcherMock = vi.fn(
  (_props?: { variant?: 'inline' | 'menu'; readOnly?: boolean }) => (
    <div data-testid="organization-context-switcher">Organization Context</div>
  )
);
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

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../providers/theme-provider', () => ({
  useTheme: () => useThemeMock(),
}));

vi.mock('../providers/locale-provider', () => ({
  useLocale: () => useLocaleMock(),
}));

vi.mock('../hooks/use-organization-context', () => ({
  useOrganizationContext: () => useOrganizationContextMock(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} data-router-link="true" href={to}>
      {children}
    </a>
  ),
  useRouterState: (options?: { select?: (state: { location: { pathname: string } }) => unknown }) => {
    const state = { location: { pathname: window.location.pathname } };
    return options?.select ? options.select(state) : state;
  },
}));

vi.mock('./OrganizationContextSwitcher', () => ({
  OrganizationContextSwitcher: (props: { variant?: 'inline' | 'menu' }) => organizationContextSwitcherMock(props),
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
    useLocaleMock.mockReset();
    useOrganizationContextMock.mockReset();
    organizationContextSwitcherMock.mockReset();
    organizationContextSwitcherMock.mockImplementation(() => (
      <div data-testid="organization-context-switcher">Organization Context</div>
    ));
    localStorageState.clear();
    sessionStorageState.clear();
    clearAuthDiagnosticTrail();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    localStorageState.clear();
    sessionStorageState.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock,
    });
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: false,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });
  });

  it('zeigt Dev-Auth-Badge und lokalen Dev-Login im expliziten Dev-Modus', async () => {
    vi.stubEnv('VITE_SVA_DEV_AUTH', 'true');
    window.history.replaceState({}, '', '/plugins/waste-management');

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
      isDevAuthAvailable: true,
      refetch: vi.fn(),
      loginWithDevAuth: vi.fn(),
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Login' })).not.toBeNull();
    });

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
  });

  it('zeigt für unauthenticated user Theme-Toggle und Login', async () => {
    window.history.replaceState({}, '', '/account?tab=profile');
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Login' })).not.toBeNull();
    });

    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Konto' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Login' }).getAttribute('href')).toBe(
      '/auth/login?returnTo=%2Faccount%3Ftab%3Dprofile'
    );
    expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }).className).toContain('rounded-full');
    expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }).className).toContain('text-muted-foreground');
    expect(screen.queryByTestId('organization-context-switcher')).toBeNull();
  });

  it('zeigt für authenticated user Konto-Link und Logout', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    expect(screen.queryByTestId('organization-context-switcher')).toBeNull();

    const accountTrigger = await screen.findByRole('button', { name: /Test User/ });
    accountTrigger.click();

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Logout' })).not.toBeNull();
    });

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Mein Konto' }).getAttribute('href')).toBe('/account');
    expect(screen.getByRole('menuitem', { name: 'Mein Konto' }).getAttribute('data-router-link')).toBe('true');
    expect(screen.getByRole('menuitem', { name: 'Datenschutz' }).getAttribute('href')).toBe('/account/privacy');
    expect(screen.getByRole('menuitem', { name: 'Kontoregeln' }).getAttribute('href')).toBe('/account/rules');
    expect(screen.getByRole('menuitem', { name: 'Passwort ändern' }).getAttribute('href')).toBe(
      '/auth/account-action?action=update-password&returnTo=%2Faccount'
    );
    expect(screen.getByRole('menuitem', { name: 'Passwort ändern' }).getAttribute('data-router-link')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'E-Mail ändern' })).toBeNull();
    expect(screen.getAllByRole('separator')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: 'Benutzer' })).toBeNull();
    expect(
      screen
        .getAllByRole('textbox')
        .some((element) => element.className.includes('bg-[rgb(var(--waste-panel-surface))]'))
    ).toBe(true);
    expect(screen.queryByText('Bereich')).toBeNull();
    expect(screen.queryByText('Organisationskontext')).toBeNull();
    expect(screen.queryByText('Sicherheit')).toBeNull();
    expect(screen.getAllByText('Test User')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Kontomenü' }).className).toContain('rounded-lg');
    expect(screen.getByTestId('organization-context-switcher')).toBeTruthy();
    expect(
      screen.getByTestId('organization-context-switcher').compareDocumentPosition(screen.getByRole('menuitem', { name: 'Mein Konto' }))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(organizationContextSwitcherMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'menu',
        readOnly: false,
      })
    );

    const logoutForm = document.querySelector('form[action="/auth/logout"]');
    const logoutIntent = logoutForm?.querySelector('input[name="logoutIntent"]');
    expect(logoutForm?.getAttribute('method')).toBe('post');
    expect(logoutIntent?.getAttribute('value')).toBe('user');
  });

  it('zeigt Organisationsmitgliedschaften auch für system_admin im Kontomenü als read-only Bereich', async () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['system_admin'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    const accountTrigger = await screen.findByRole('button', { name: /Test User/ });
    accountTrigger.click();

    await waitFor(() => {
      expect(screen.getByTestId('organization-context-switcher')).toBeTruthy();
    });

    expect(organizationContextSwitcherMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'menu',
        readOnly: true,
      })
    );
  });

  it('räumt lokale Session-Marker vor dem Formular-Logout auf', async () => {
    window.localStorage.setItem('sva_auth_had_session', '1');
    recordAuthDiagnosticEvent({
      authFlowId: 'auth-flow-logout',
      attempt: 1,
      event: 'auth_me_401_received',
      requestId: 'req-logout',
    });

    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    const accountTrigger = await screen.findByRole('button', { name: /Test User/ });
    accountTrigger.click();

    await waitFor(() => {
      expect(document.querySelector('form[action="/auth/logout"]')).not.toBeNull();
    });
    const logoutForm = document.querySelector('form[action="/auth/logout"]');
    expect(readAuthDiagnosticTrail()).toHaveLength(1);

    fireEvent.submit(logoutForm as HTMLFormElement);

    expect(window.localStorage.getItem('sva_auth_had_session')).toBeNull();
    expect(readAuthDiagnosticTrail()).toHaveLength(0);
  });

  it('zeigt beim Theme-Toggle den Zielmodus passend zum Icon an', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    useThemeMock.mockReturnValue({
      mode: 'light',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });

    const { rerender } = render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' })).toBeTruthy();
    });

    useThemeMock.mockReturnValue({
      mode: 'dark',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });

    rerender(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hellen Modus aktivieren' })).toBeTruthy();
    });
  });

  it('setzt cursor-pointer auf alle sichtbaren Header-Aktionen', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header onOpenMobileNavigation={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Navigation öffnen' })).toBeTruthy();
    });

    const interactiveElements = [
      screen.getByRole('button', { name: 'Navigation öffnen' }),
      screen.getByRole('button', { name: 'Sprache wechseln' }),
      screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }),
      screen.getByRole('button', { name: 'Systemmeldungen' }),
    ];

    for (const element of interactiveElements) {
      expect(element.className).toContain('cursor-pointer');
    }
  });

  it('zeigt Hover-Hinweise sofort auf den Header-Icons', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    const { rerender } = render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Systemmeldungen' })).toBeTruthy();
    });

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Systemmeldungen' }));
    expect(screen.getByRole('tooltip', { name: 'Meldungen' })).toBeTruthy();
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Systemmeldungen' }));
    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { name: 'Meldungen' })).toBeNull();
    });

    fireEvent.focus(screen.getByRole('button', { name: 'Sprache wechseln' }));
    expect(screen.getByRole('tooltip', { name: 'Sprachen' })).toBeTruthy();
    fireEvent.blur(screen.getByRole('button', { name: 'Sprache wechseln' }));
    await waitFor(() => {
      expect(screen.queryByRole('tooltip', { name: 'Sprachen' })).toBeNull();
    });

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }));
    expect(screen.getByRole('tooltip', { name: 'Nacht-Modus' })).toBeTruthy();

    useThemeMock.mockReturnValue({
      mode: 'dark',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });

    rerender(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hellen Modus aktivieren' })).toBeTruthy();
    });

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hellen Modus aktivieren' }));
    expect(screen.getByRole('tooltip', { name: 'Tag-Modus' })).toBeTruthy();
  });

  it('zeigt auch für system_admin keine Navigationslinks im Header', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-admin',
        name: 'Admin User',
        roles: ['system_admin'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    const accountTrigger = await screen.findByRole('button', { name: /Admin User/ });
    accountTrigger.click();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeTruthy();
    });
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
      hasResolvedSession: false,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header isLoading />);

    expect(screen.getByText('Authentifizierungsstatus wird geladen.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
    expect(screen.queryByTestId('organization-context-switcher')).toBeNull();
  });

  it('platziert den Organisationswechsler nur im Kontomenue', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    expect(screen.queryByTestId('organization-context-switcher')).toBeNull();

    const accountTrigger = await screen.findByRole('button', { name: /Test User/ });
    accountTrigger.click();

    await waitFor(() => {
      expect(screen.getByTestId('organization-context-switcher')).toBeTruthy();
    });
  });

  it('rendert keinen führenden Separator vor Mein Konto, wenn nur Organisationsmitgliedschaften angezeigt werden', async () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    const accountTrigger = await screen.findByRole('button', { name: /Test User/ });
    accountTrigger.click();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Mein Konto' })).toBeTruthy();
    });

    expect(screen.getByTestId('organization-context-switcher')).toBeTruthy();
    expect(screen.getAllByRole('separator')).toHaveLength(3);
    expect(screen.getByRole('menuitem', { name: 'Mein Konto' }).previousElementSibling?.getAttribute('role')).not.toBe(
      'separator'
    );
  });

  it('delegates theme toggle to the theme provider', async () => {
    const toggleModeMock = vi.fn();

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' })).toBeTruthy();
    });

    screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }).click();

    expect(toggleModeMock).toHaveBeenCalledTimes(1);
  });

  it('zeigt den Navigation-Button nur bei verfuegbarem Handler', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    const { rerender } = render(<Header />);

    expect(screen.queryByRole('button', { name: 'Navigation öffnen' })).toBeNull();

    rerender(<Header onOpenMobileNavigation={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Navigation öffnen' })).toBeTruthy();
  });

  it('delegates language switch to the locale provider', async () => {
    const setLocaleMock = vi.fn();

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: setLocaleMock,
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sprache wechseln' })).toBeTruthy();
    });

    screen.getByRole('button', { name: 'Sprache wechseln' }).click();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /English/ })).toBeTruthy();
    });

    screen.getByRole('menuitem', { name: /English/ }).click();

    expect(setLocaleMock).toHaveBeenCalledWith('en');
  });

  it('switches back to German and closes the locale menu on outside click and Escape', async () => {
    const setLocaleMock = vi.fn();

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'en',
      setLocale: setLocaleMock,
    });

    render(<Header />);

    const trigger = await screen.findByRole('button', { name: 'Sprache wechseln' });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(2);
    });
    fireEvent.click(screen.getAllByRole('menuitem')[0]!);
    expect(setLocaleMock).toHaveBeenCalledWith('de');

    fireEvent.click(trigger);
    await screen.findByRole('menuitem', { name: /English/ });
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /English/ })).toBeNull();
    });

    fireEvent.click(trigger);
    await screen.findByRole('menuitem', { name: /English/ });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /English/ })).toBeNull();
    });
  });

  it('triggers dev login directly and uses the dev-auth logout action inside the account menu', async () => {
    const loginWithDevAuthMock = vi.fn();
    const logoutMock = vi.fn();

    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        displayName: 'Dev User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
      isDevAuthAvailable: true,
      refetch: vi.fn(),
      loginWithDevAuth: loginWithDevAuthMock,
      logout: logoutMock,
      invalidatePermissions: vi.fn(),
    });
    useThemeMock.mockReturnValue({
      mode: 'light',
      themeName: 'sva-default',
      themeLabel: 'SVA Studio',
      setMode: vi.fn(),
      toggleMode: vi.fn(),
    });
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    const { rerender } = render(<Header />);

    const accountTrigger = await screen.findByRole('button', { name: /Dev User/ });
    accountTrigger.click();
    await screen.findByRole('menuitem', { name: 'Logout' });
    screen.getByRole('menuitem', { name: 'Logout' }).click();
    expect(logoutMock).toHaveBeenCalledTimes(1);

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
      isDevAuthAvailable: true,
      refetch: vi.fn(),
      loginWithDevAuth: loginWithDevAuthMock,
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
    });

    rerender(<Header />);

    const loginButton = await screen.findByRole('button', { name: 'Login' });
    loginButton.click();
    expect(loginWithDevAuthMock).toHaveBeenCalledTimes(1);
  });

  it('closes linked account menus after selecting a navigation entry', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    const accountTrigger = await screen.findByRole('button', { name: /Test User/ });
    accountTrigger.click();
    const accountLink = await screen.findByRole('menuitem', { name: 'Mein Konto' });
    accountLink.click();

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Mein Konto' })).toBeNull();
    });
  });

  it('hides the anonymous login action on the home route and still opens the locale menu', async () => {
    window.history.replaceState({}, '', '/');
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'en',
      setLocale: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sprache wechseln' })).toBeTruthy();
    });

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();

    screen.getByRole('button', { name: 'Sprache wechseln' }).click();

    const englishMenuItem = await screen.findByRole('menuitem', { name: /English/ });
    const germanMenuItem = screen.getByRole('menuitem', { name: /Deutsch/ });
    expect(englishMenuItem.textContent).toContain('English');
    expect(germanMenuItem.textContent).toContain('Deutsch');
  });

  it('versteckt Such- und Assistenten-Platzhalter ohne experimental.read', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-plain',
        name: 'Plain User',
        roles: ['editor'],
        permissionActions: ['news.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Systemmeldungen' })).toBeTruthy();
    });

    expect(screen.queryByRole('textbox', { name: 'Suche' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Frag den Assistenten' })).toBeNull();
  });

  it('zeigt Such- und Assistenten-Platzhalter nur mit experimental.read', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-experimental',
        name: 'Experimental User',
        roles: ['editor'],
        permissionActions: ['experimental.read'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      hasResolvedSession: true,
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
    useLocaleMock.mockReturnValue({
      locale: 'de',
      setLocale: vi.fn(),
    });

    render(<Header />);

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Suche' })).toBeTruthy();
    });

    expect(screen.getByRole('textbox', { name: 'Frag den Assistenten' })).toBeTruthy();
  });
});
