import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { readonly children: ReactNode; readonly to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../hooks/use-content-access', () => ({
  useContentAccess: () => ({ permissionActions: [] }),
}));

import { HomePage } from './-home-page';
import { StudioBrandingProvider } from '../providers/studio-branding-provider';

describe('HomePage', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      error: null,
      sessionRecoveryFailed: false,
      isDevAuthAvailable: false,
      loginWithDevAuth: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the server-selected Kassel DIALOG texts before login', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false });
    render(
      <StudioBrandingProvider branding="kassel-dialog">
        <HomePage />
      </StudioBrandingProvider>
    );
    expect(screen.getByRole('heading', { name: 'Kassel DIALOG' })).toBeTruthy();
    expect(screen.getByText('Die Steueroberfläche für den virtuellen Dolmetscher.')).toBeTruthy();
    expect(
      screen.getByText('Melden Sie sich an, um Ihre Einstellungen und Benutzer zu verwalten.')
    ).toBeTruthy();
    expect(
      screen.queryByText('Die gemeinsame Oberfläche für Inhalte, Module und Organisationen.')
    ).toBeNull();
  });

  it('uses the server-selected app name after login', () => {
    render(
      <StudioBrandingProvider branding="kassel-dialog">
        <HomePage />
      </StudioBrandingProvider>
    );

    expect(screen.getByRole('heading', { name: 'Kassel DIALOG' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'SVA Studio' })).toBeNull();
  });

  it('announces session loading as a status', () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      error: null,
      sessionRecoveryFailed: false,
      isDevAuthAvailable: false,
      loginWithDevAuth: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByRole('status').textContent).toContain('Sitzung wird geladen');
  });

  it('shows action cards without loading individual PR entries', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<HomePage />);
    expect(screen.getByText('Studio Workspace')).toBeTruthy();
    expect(screen.queryByText('Letzte Änderungen')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
