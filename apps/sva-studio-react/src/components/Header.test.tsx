/**
 * Unit-Tests für Header-Auth-Aktionen und Loading-Zustand.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';

const useAuthMock = vi.fn();
const useLocaleMock = vi.fn();
const useThemeMock = vi.fn();

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../providers/theme-provider', () => ({
  useTheme: () => useThemeMock(),
}));

vi.mock('../providers/locale-provider', () => ({
  useLocale: () => useLocaleMock(),
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
    <a {...props} href={to}>
      {children}
    </a>
  ),
  useRouterState: (options?: { select?: (state: { location: { pathname: string } }) => unknown }) => {
    const state = { location: { pathname: window.location.pathname } };
    return options?.select ? options.select(state) : state;
  },
}));

vi.mock('./OrganizationContextSwitcher', () => ({
  OrganizationContextSwitcher: () => <div data-testid="organization-context-switcher">Organization Context</div>,
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
    vi.unstubAllEnvs();
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
      expect(screen.queryByRole('menuitem', { name: 'Logout' })).not.toBeNull();
    });

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Mein Konto' }).getAttribute('href')).toBe('/account');
    expect(screen.queryByRole('link', { name: 'Benutzer' })).toBeNull();
    expect(screen.getByTestId('organization-context-switcher')).toBeTruthy();
    expect(
      screen
        .getAllByRole('textbox')
        .some((element) => element.className.includes('bg-[rgb(var(--waste-panel-surface))]'))
    ).toBe(true);
    expect(screen.getByRole('menu').className).toContain('rounded-lg');

    const logoutForm = document.querySelector('form[action="/auth/logout"]');
    const logoutIntent = logoutForm?.querySelector('input[name="logoutIntent"]');
    expect(logoutForm?.getAttribute('method')).toBe('post');
    expect(logoutIntent?.getAttribute('value')).toBe('user');
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

  it('zeigt auch für system_admin keine Navigationslinks im Header', async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-admin',
        name: 'Admin User',
        roles: ['system_admin'],
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
});
