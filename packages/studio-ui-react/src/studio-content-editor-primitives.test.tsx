import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StudioDetailCard, StudioPagination } from './studio-content-editor-primitives.js';

describe('studio content editor primitives', () => {
  it('renders a semantic detail card with optional actions', () => {
    render(
      <StudioDetailCard
        title="Bilder"
        description="Medien der Kachel"
        actions={<button type="button">Hinzufügen</button>}
      >
        <p>Inhalt</p>
      </StudioDetailCard>
    );
    expect(screen.getByRole('heading', { name: 'Bilder' })).toBeTruthy();
    expect(screen.getByText('Medien der Kachel')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hinzufügen' })).toBeTruthy();
  });

  it('navigates within valid pagination bounds', () => {
    const onPageChange = vi.fn();
    render(
      <StudioPagination
        page={2}
        hasNextPage
        ariaLabel="Seitennavigation"
        pageLabel="Seite 2"
        previousLabel="Zurück"
        nextLabel="Weiter"
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(onPageChange.mock.calls).toEqual([[1], [3]]);
  });
});
