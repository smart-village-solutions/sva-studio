import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.hoisted(() => vi.fn());
const contentAccessMock = vi.hoisted(() => ({ permissionActions: [] as string[] }));
const sessionStorageState = new Map<string, string>();
const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStorageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => sessionStorageState.set(key, value)),
};

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { readonly children: ReactNode; readonly to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../hooks/use-content-access', () => ({
  useContentAccess: () => contentAccessMock,
}));

import { HomePage } from './-home-page';

describe('HomePage', () => {
  beforeEach(() => {
    sessionStorageState.clear();
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    contentAccessMock.permissionActions = [];
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock,
    });
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

  it('keeps anonymous login immediately usable and shortens repeated workbench visits', async () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      sessionRecoveryFailed: false,
      isDevAuthAvailable: false,
      loginWithDevAuth: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByRole('link', { name: 'Login' })).toBeTruthy();
    expect(
      screen.getByText('Die gemeinsame Werkstatt für Inhalte, Module und Organisationen.')
    ).toBeTruthy();
    await waitFor(() => {
      const scene = document.querySelector('[data-motion-scene="anonymous"]');
      expect(scene?.getAttribute('data-motion-requested-mode')).toBe('full');
    });

    cleanup();
    render(<HomePage />);

    await waitFor(() => {
      const scene = document.querySelector('[data-motion-scene="anonymous"]');
      expect(scene?.getAttribute('data-motion-requested-mode')).toBe('compact');
    });
  });

  it('assembles available authenticated actions as interactive workbench modules', async () => {
    contentAccessMock.permissionActions = ['news.create'];
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      error: null,
      sessionRecoveryFailed: false,
      isDevAuthAvailable: false,
      loginWithDevAuth: vi.fn(),
      user: { assignedModules: ['news'] },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ entries: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    render(<HomePage />);

    const createNewsLink = screen.getByRole('link', { name: /Nachricht erstellen/ });
    expect(createNewsLink.closest('[data-studio-workbench-module]')).toBeTruthy();
    await waitFor(() => {
      const scenes = document.querySelectorAll('[data-motion-scene="authenticated"]');
      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes[0]?.getAttribute('data-motion-requested-mode')).toBe('full');
    });
    expect(document.querySelector('[data-studio-workbench-surface]')).toBeTruthy();
  });

  it('renders the latest changelog entries on the authenticated home page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [
              {
                prNumber: 412,
                body: 'Allgemeine Verbesserungen\n\n- Stabilere Speicherung',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      )
    );

    render(<HomePage />);

    expect(await screen.findByText('Letzte Änderungen')).toBeTruthy();
    expect(screen.getByText('Allgemeine Verbesserungen')).toBeTruthy();
    expect(screen.getByText('Stabilere Speicherung')).toBeTruthy();
  });

  it('shows an empty state when no changelog entries are available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ entries: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    render(<HomePage />);

    expect(await screen.findByText('Noch keine Änderungen verfügbar.')).toBeTruthy();
  });

  it('shows a non-blocking error state when the changelog cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'studio_changelog_unavailable',
            message: 'Studio-Changelog konnte nicht geladen werden.',
          }),
          {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }
        )
      )
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(
        screen.getByText('Die letzten Änderungen konnten gerade nicht geladen werden.')
      ).toBeTruthy();
    });
  });
});
