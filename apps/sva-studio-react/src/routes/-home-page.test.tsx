import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { readonly children: ReactNode; readonly to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

import { HomePage } from './-home-page';

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
                mergedAt: '2026-07-06T10:00:00.000Z',
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
      expect(screen.getByText('Die letzten Änderungen konnten gerade nicht geladen werden.')).toBeTruthy();
    });
  });
});
