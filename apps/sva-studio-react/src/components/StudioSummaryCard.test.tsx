import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StudioSummaryCard } from './StudioSummaryCard';

afterEach(() => {
  cleanup();
});

describe('StudioSummaryCard', () => {
  it('renders a consistent summary card hierarchy', () => {
    render(
      <StudioSummaryCard
        eyebrow="Kennzahl"
        value="42"
        description="Zusammenfassung"
      >
        <span>Zusatz</span>
      </StudioSummaryCard>
    );

    expect(screen.getByText('Kennzahl').className).toContain('tracking-[0.24em]');
    expect(screen.getByText('42').className).toContain('text-3xl');
    expect(screen.getByText('Zusammenfassung').className).toContain('text-sm');
    expect(screen.getByText('Zusatz')).toBeTruthy();
  });
});
