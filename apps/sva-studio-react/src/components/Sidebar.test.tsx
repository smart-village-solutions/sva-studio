/**
 * Unit-Tests für Sidebar-Rendering, Loading-Zustand und A11y-Baseline.
 */
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

/**
 * Mockt den TanStack-Link für DOM-basierte Komponententests.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('Sidebar', () => {
  it('rendert im Loading-Zustand keine interaktiven Links', () => {
    render(<Sidebar isLoading />);

    expect(screen.getByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Bereichsnavigation' })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('rendert im Non-Loading-Zustand alle erwarteten Links mit Labels', () => {
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Übersicht' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Demos' })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('link', { name: 'Plugin-Beispiel' })).toHaveAttribute('href', '/plugins/example');
    expect(screen.getByRole('link', { name: 'Admin-API-Test' })).toHaveAttribute(
      'href',
      '/admin/api/phase1-test'
    );
  });

  it('stellt die erwarteten A11y-Labels und Landmarks bereit', () => {
    render(<Sidebar />);

    expect(screen.getByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Bereichsnavigation' })).toBeTruthy();
    expect(screen.getByText('Navigation')).toBeTruthy();
  });
});
