import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';

describe('project report app', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'http://localhost:3000/');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders milestone overview by default and syncs tab changes to the URL', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'SVA Studio Projektdashboard' }).textContent).toBe(
      'SVA Studio Projektdashboard'
    );
    expect(screen.getByRole('tab', { name: 'Meilensteine' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Arbeitspakete' }));

    expect(window.location.search).toContain('view=work-packages');
    expect(screen.getByRole('tab', { name: 'Arbeitspakete' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders the milestone empty state when the URL filters a missing milestone', () => {
    window.history.replaceState({}, '', 'http://localhost:3000/?milestone=missing-milestone');

    render(<App />);

    expect(screen.getByText('Für die aktuellen Filter gibt es keine Einträge.')).toBeTruthy();
  });

  it('renders the work package empty state when the URL filters to no matching entries', () => {
    window.history.replaceState({}, '', 'http://localhost:3000/?view=work-packages&q=kein-treffer');

    render(<App />);

    expect(screen.getByRole('tab', { name: 'Arbeitspakete' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Für die aktuellen Filter gibt es keine Einträge.')).toBeTruthy();
  });
});
