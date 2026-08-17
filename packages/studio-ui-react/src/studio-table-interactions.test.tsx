import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioTableLayoutProvider } from './studio-table-layout-context.js';
import {
  StudioStatusBadge,
  StudioTableActionButton,
  StudioTableValueAction,
} from './studio-table-interactions.js';

describe('Studio table interactions', () => {
  afterEach(() => cleanup());

  it('renders an icon action with a portalled tooltip and a 44 pixel target', () => {
    render(
      <div data-testid="overflow-container" className="overflow-hidden">
        <StudioTableActionButton label="Bearbeiten" icon={<span aria-hidden="true">E</span>} />
      </div>
    );

    const button = screen.getByRole('button', { name: 'Bearbeiten' });
    fireEvent.focus(button);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Bearbeiten');
    expect(document.body.contains(tooltip)).toBe(true);
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('min-w-11');
  });

  it('shows the mobile label in compact table cards', () => {
    render(
      <StudioTableLayoutProvider layout="compact">
        <StudioTableActionButton
          label="Inhalt löschen"
          mobileLabel="Löschen"
          tone="destructive"
          icon={<span aria-hidden="true">D</span>}
        />
      </StudioTableLayoutProvider>
    );

    const button = screen.getByRole('button', { name: 'Inhalt löschen' });
    expect(button.textContent).toContain('Löschen');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('preserves link semantics for icon actions', () => {
    render(
      <StudioTableActionButton
        asChild
        label="Kalender öffnen"
        icon={<span aria-hidden="true">K</span>}
      >
        <a href="/calendar" />
      </StudioTableActionButton>
    );

    expect(screen.getByRole('link', { name: 'Kalender öffnen' }).getAttribute('href')).toBe(
      '/calendar'
    );
  });

  it('preserves content supplied by an asChild action', () => {
    render(
      <StudioTableActionButton
        asChild
        label="Kalender öffnen"
        icon={<span aria-hidden="true">Ersatz-Icon</span>}
      >
        <a href="/calendar">Eigener Linkinhalt</a>
      </StudioTableActionButton>
    );

    const link = screen.getByRole('link', { name: 'Kalender öffnen' });
    expect(link.textContent).toBe('Eigener Linkinhalt');
    expect(screen.queryByText('Ersatz-Icon')).toBeNull();
  });

  it('renders value actions as buttons or real links without a hover background', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <StudioTableValueAction emphasis="primary" numeric onClick={onClick}>
        3
      </StudioTableValueAction>
    );

    const button = screen.getByRole('button', { name: '3' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(button.className).toContain('font-semibold');
    expect(button.className).toContain('tabular-nums');
    expect(button.className).toContain('bg-transparent');

    rerender(
      <StudioTableValueAction asChild>
        <a href="/tours/1">Tour 1</a>
      </StudioTableValueAction>
    );
    expect(screen.getByRole('link', { name: 'Tour 1' }).getAttribute('href')).toBe('/tours/1');
  });

  it('distinguishes editable and read-only status badges without relying on color alone', () => {
    const { rerender } = render(<StudioStatusBadge tone="success">Aktiv</StudioStatusBadge>);
    expect(screen.getByText('Aktiv').querySelector('svg')).toBeNull();

    rerender(
      <StudioStatusBadge tone="warning" editable>
        In Prüfung
      </StudioStatusBadge>
    );
    const badge = screen.getByText('In Prüfung');
    expect(badge.getAttribute('data-editable')).toBe('true');
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
