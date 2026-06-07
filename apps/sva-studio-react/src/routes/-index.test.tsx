import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { HomePage } from './-home-page';

const useAuthMock = vi.fn();
const readLatestAuthDiagnosticSnapshotMock = vi.fn(() => ({}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../lib/auth-diagnostics', () => ({
  readLatestAuthDiagnosticSnapshot: () => readLatestAuthDiagnosticSnapshotMock(),
}));

describe('HomePage', () => {
  afterEach(() => {
    cleanup();
    globalThis.history.replaceState({}, '', '/');
    readLatestAuthDiagnosticSnapshotMock.mockReset();
    readLatestAuthDiagnosticSnapshotMock.mockReturnValue({});
    useAuthMock.mockReset();
  });

  it('shows authenticated session summary without raw demo messaging', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        roles: ['editor', 'system_admin'],
        instanceId: 'de-musterhausen',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    render(<HomePage />);

    expect(screen.queryByText('Demo Session')).toBeNull();
    expect(screen.queryByText('IAM-Authorize (Modulpfad)')).toBeNull();
    expect(
      screen
        .getAllByRole('link', { name: 'Inhalte öffnen' })
        .some((link) => link.getAttribute('href') === '/admin/content')
    ).toBe(true);
    expect(screen.getByRole('heading', { name: 'SVA Studio' }).closest('section')?.className).toContain(
      'rgba(0,90,158,0.18)'
    );
  });

  it('shows signed-out copy without exposing role diagnostics', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    render(<HomePage />);

    expect(screen.queryByText('Sitzungsstatus')).toBeNull();
    expect(screen.queryByText('Keine aktive Sitzung.')).toBeNull();
    expect(screen.queryByText('Anmeldung erforderlich')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Zum Login' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Open Source Software made with love in Bad Belzig' }).getAttribute('href')
    ).toBe('https://github.com/smart-village-solutions/sva-studio');
    expect(
      screen.getByRole('link', { name: 'Open Source Software made with love in Bad Belzig' }).getAttribute('rel')
    ).toBe('noopener noreferrer');
    expect(screen.getByLabelText('love')).toBeTruthy();
    expect(screen.queryByText('Direkte Einstiege')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inhalte öffnen' })).toBeNull();
    expect(screen.getByText('Willkommen').parentElement?.className).toContain(
      'shadow-[0_24px_70px_rgba(0,90,158,0.1)]'
    );
  });

  it('shows loading state while auth is resolving', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: false,
      isRecoveringSession: false,
    });

    render(<HomePage />);

    expect(screen.getByText('Sitzung wird geladen ...')).toBeTruthy();
  });

  it('shows direct entry points instead of debug cards', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        roles: ['editor'],
        instanceId: 'de-musterhausen',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    render(<HomePage />);

    expect(screen.getByText('Direkte Einstiege')).toBeTruthy();
    expect(
      screen
        .getAllByRole('link', { name: 'Inhalte öffnen' })
        .some((link) => link.getAttribute('href') === '/admin/content')
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: 'Konto öffnen' })
        .some((link) => link.getAttribute('href') === '/account')
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'Schnittstellen öffnen' }).getAttribute('href')).toBe(
      '/interfaces'
    );
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
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    globalThis.history.replaceState({}, '', '/?error=auth.insufficientRole');

    render(<HomePage />);

    expect(
      screen.getByText(
        'Keine Berechtigung für diese Seite. Bitte wenden Sie sich an die Administration.'
      )
    ).toBeTruthy();
  });

  it('shows auth query error message for failed login', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    globalThis.history.replaceState({}, '', '/?auth=error');

    render(<HomePage />);

    expect(screen.getByText('Login fehlgeschlagen. Bitte erneut versuchen.')).toBeTruthy();
  });

  it('shows auth query error message for expired login state', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    globalThis.history.replaceState({}, '', '/?auth=state-expired');

    render(<HomePage />);

    expect(
      screen.getByText('Login abgebrochen oder abgelaufen. Bitte erneut anmelden.')
    ).toBeTruthy();
  });

  it('ignores prototype-like auth query values without crashing', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    globalThis.history.replaceState({}, '', '/?auth=toString');

    render(<HomePage />);

    expect(screen.queryByText('Login fehlgeschlagen. Bitte erneut versuchen.')).toBeNull();
    expect(screen.queryByText('Login abgebrochen oder abgelaufen. Bitte erneut anmelden.')).toBeNull();
  });

  it('starts a full-document login redirect from the home route when auth=login is present', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
      sessionRecoveryFailed: false,
    });

    globalThis.history.replaceState({}, '', '/?auth=login&returnTo=%2Fadmin%2Fusers%3Fpage%3D2');
    const replaceMock = vi.fn();
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(replaceMock);

    render(<HomePage />);

    expect(replaceMock).toHaveBeenCalledWith('/auth/login?returnTo=%2Fadmin%2Fusers%3Fpage%3D2');
    replaceSpy.mockRestore();
  });

  it('shows generic auth load error from auth provider state', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: new Error('session-failed'),
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
    });

    render(<HomePage />);

    expect(screen.getByText('Fehler beim Laden der Session. Bitte erneut anmelden.')).toBeTruthy();
  });

  it('shows session-expired notice with login link to the original page', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
      sessionRecoveryFailed: false,
    });

    globalThis.history.replaceState(
      {},
      '',
      '/?auth=session-expired&returnTo=%2Fadmin%2Fusers%3Fpage%3D2'
    );

    render(<HomePage />);

    expect(
      screen.getByText('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Erneut anmelden' }).getAttribute('href')).toBe(
      '/auth/login?returnTo=%2Fadmin%2Fusers%3Fpage%3D2'
    );
    expect(window.location.search).toBe('');
  });

  it('renders auth diagnostic identifiers when available', () => {
    readLatestAuthDiagnosticSnapshotMock.mockReturnValue({
      authFlowId: 'auth-flow-1',
      requestId: 'req-123',
    });
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: new Error('session failed'),
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
      sessionRecoveryFailed: false,
    });

    render(<HomePage />);

    expect(screen.getByText('Request-ID: req-123')).toBeTruthy();
    expect(screen.getByText('Auth-Flow: auth-flow-1')).toBeTruthy();
  });

  it('shows session-expired notice from auth provider state', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
      sessionRecoveryFailed: true,
    });

    render(<HomePage />);

    expect(
      screen.getByText('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Erneut anmelden' }).getAttribute('href')).toBe(
      '/auth/login?returnTo=%2F'
    );
  });

  it('shows an explicit local dev login action when dev auth is available', () => {
    const loginWithDevAuth = vi.fn();

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      loginWithDevAuth,
      logout: vi.fn(),
      invalidatePermissions: vi.fn(),
      hasResolvedSession: true,
      isRecoveringSession: false,
      sessionRecoveryFailed: false,
      isDevAuthAvailable: true,
    });

    render(<HomePage />);

    const loginButton = screen.getByRole('button', { name: 'Als Dev-User anmelden' });
    fireEvent.click(loginButton);

    expect(loginWithDevAuth).toHaveBeenCalledTimes(1);
  });
});
