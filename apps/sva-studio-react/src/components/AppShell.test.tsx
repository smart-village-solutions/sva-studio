/**
 * Unit-Tests für Struktur und Loading-Verhalten der AppShell.
 */
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AppShell from './AppShell';

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

/**
 * Führt nach jedem Test ein DOM-Cleanup aus.
 */
afterEach(() => {
  cleanup();
});

/**
 * Testet das Rendering der AppShell in regulären und Loading-Zuständen.
 */
describe('AppShell', () => {
  it('rendert Sidebar und Main-Landmark', () => {
    render(
      <AppShell>
        <div>Inhalt</div>
      </AppShell>
    );

    expect(screen.getByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByText('Inhalt')).toBeTruthy();
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
});
