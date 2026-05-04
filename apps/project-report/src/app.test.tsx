import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';

describe('project report app', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'http://localhost:3000/');
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
});
