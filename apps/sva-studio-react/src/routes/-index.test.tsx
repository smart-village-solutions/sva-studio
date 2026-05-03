import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

import { HomePage } from './-home-page';

const useAuthMock = vi.fn();

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

describe('HomePage', () => {
  afterEach(() => {
    cleanup();
    globalThis.history.replaceState({}, '', '/');
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
    expect(screen.queryByText('Direkte Einstiege')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inhalte öffnen' })).toBeNull();
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
    expect(screen.getByRole('link', { name: 'Schnittstellen öffnen' }).getAttribute('href')).toBe('/interfaces');
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
      screen.getByText('Keine Berechtigung für diese Seite. Bitte wenden Sie sich an die Administration.')
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

    expect(screen.getByText('Login abgebrochen oder abgelaufen. Bitte erneut anmelden.')).toBeTruthy();
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

    const replaceMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/',
        search: '?auth=login&returnTo=%2Fadmin%2Fusers%3Fpage%3D2',
        replace: replaceMock,
      },
    });

    render(<HomePage />);

    expect(replaceMock).toHaveBeenCalledWith('/auth/login?returnTo=%2Fadmin%2Fusers%3Fpage%3D2');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
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

    globalThis.history.replaceState({}, '', '/?auth=session-expired&returnTo=%2Fadmin%2Fusers%3Fpage%3D2');

    render(<HomePage />);

    expect(screen.getByText('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Erneut anmelden' }).getAttribute('href')).toBe(
      '/auth/login?returnTo=%2Fadmin%2Fusers%3Fpage%3D2'
    );
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

    expect(screen.getByText('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Erneut anmelden' }).getAttribute('href')).toBe('/auth/login?returnTo=%2F');
  });
});
