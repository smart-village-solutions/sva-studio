import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StudioFilterSurface } from './StudioFilterSurface';

afterEach(() => {
  cleanup();
});

describe('StudioFilterSurface', () => {
  it('renders a consistent shell-aligned filter surface', () => {
    render(
      <StudioFilterSurface role="search">
        <label htmlFor="search-input">Suche</label>
        <input id="search-input" />
      </StudioFilterSurface>
    );

    const surface = screen.getByRole('search');
    expect(surface.className).toContain('border-border/70');
    expect(surface.className).toContain('bg-card/85');
    expect(surface.className).toContain('p-4');
    expect(surface.className).toContain('shadow-shell');
  });
});
