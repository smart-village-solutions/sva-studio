import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StudioTableSurface } from './StudioTableSurface';

afterEach(() => {
  cleanup();
});

describe('StudioTableSurface', () => {
  it('renders a waste-inspired edge-to-edge table surface for card-backed tables', () => {
    render(
      <StudioTableSurface>
        <table aria-label="Beispieltabelle">
          <tbody>
            <tr>
              <td>Zeile</td>
            </tr>
          </tbody>
        </table>
      </StudioTableSurface>
    );

    const table = screen.getByRole('table', { name: 'Beispieltabelle' });
    const scrollContainer = table.parentElement;
    const surface = scrollContainer?.parentElement;

    expect(scrollContainer?.className).toContain('overflow-x-auto');
    expect(surface?.className).toContain('overflow-hidden');
    expect(surface?.className).toContain('rounded-none');
    expect(surface?.className).toContain('border-y');
    expect(surface?.className).toContain('bg-card');
    expect(surface?.className).toContain('shadow-shell');
  });

  it('supports background-backed table surfaces for detail views', () => {
    render(
      <StudioTableSurface tone="background">
        <table aria-label="Detailtabelle">
          <tbody>
            <tr>
              <td>Zeile</td>
            </tr>
          </tbody>
        </table>
      </StudioTableSurface>
    );

    const table = screen.getByRole('table', { name: 'Detailtabelle' });
    const surface = table.parentElement?.parentElement;

    expect(surface?.className).toContain('bg-background');
  });
});
