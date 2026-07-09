import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button tooltip behavior', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a hover tooltip for icon buttons using the aria-label', () => {
    render(
      <Button type="button" size="icon" aria-label="Suche">
        <span aria-hidden="true">S</span>
      </Button>
    );

    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Suche' }));

    expect(screen.getByRole('tooltip').textContent).toContain('Suche');
  });

  it('shows a hover tooltip for icon links rendered via asChild using the child title', () => {
    render(
      <Button asChild size="icon" type="button" variant="outline">
        <a href="/foo" aria-label="Bearbeiten" title="Datensatz bearbeiten">
          <span aria-hidden="true">B</span>
        </a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Bearbeiten' });

    fireEvent.mouseEnter(link);

    expect(screen.getByRole('tooltip').textContent).toContain('Datensatz bearbeiten');
  });

  it('shows a hover tooltip for icon-only table action buttons that use size sm', () => {
    render(
      <Button type="button" size="sm" variant="ghost" aria-label="Bearbeiten" className="h-8 w-8 px-0">
        <svg aria-hidden="true" className="h-4 w-4" />
      </Button>
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Bearbeiten' }));

    expect(screen.getByRole('tooltip').textContent).toContain('Bearbeiten');
  });
});
