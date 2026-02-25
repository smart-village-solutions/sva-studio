/**
 * Unit-Tests für Header-Auth-Aktionen und Loading-Zustand.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    reloadDocument: _reloadDocument,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
    reloadDocument?: boolean;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
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
    vi.unstubAllGlobals();
  });

  it('zeigt nur Login für unauthenticated user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } satisfies Partial<Response>)
    );

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Login' })).not.toBeNull();
    });

    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
  });

  it('zeigt nur Logout für authenticated user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { name: 'Test User', roles: ['admin'] } }),
      } satisfies Partial<Response>)
    );

    render(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeNull();
    });

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
  });

  it('zeigt Skeleton im Loading-Modus und ruft kein /auth/me auf', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<Header isLoading />);

    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
