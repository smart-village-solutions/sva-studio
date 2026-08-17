import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchableMultiSelect } from './searchable-multi-select.js';

const defaultProps = {
  emptyText: 'Keine passenden Kategorien gefunden.',
  helpText: 'Wählen Sie eine oder mehrere Kategorien aus.',
  id: 'categories',
  loading: false,
  loadingText: 'Kategorien werden geladen.',
  options: [
    { label: 'Kultur', value: 'Kultur' },
    { label: 'Mobilität', value: 'Mobilität' },
  ],
  placeholder: 'Kategorie suchen oder auswählen',
  removeLabel: (label: string) => `Kategorie ${label} entfernen`,
  searchLabel: 'Kategorien suchen',
  unavailableText: 'nicht mehr verfügbar',
  value: [] as readonly string[],
};

describe('SearchableMultiSelect', () => {
  afterEach(() => cleanup());

  it('selects only an available option and never creates a value from search text', () => {
    const onValueChange = vi.fn();
    render(<SearchableMultiSelect {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Kategorie suchen oder auswählen' }));
    const searchInput = screen.getByLabelText('Kategorien suchen');
    fireEvent.change(searchInput, { target: { value: 'Neue Kategorie' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByText('Keine passenden Kategorien gefunden.')).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: 'Kult' } });
    fireEvent.click(screen.getByLabelText('Kultur'));

    expect(onValueChange).toHaveBeenCalledWith(['Kultur']);
  });

  it('keeps the panel open for multiple selections and closes it with Escape', () => {
    const onValueChange = vi.fn();
    render(<SearchableMultiSelect {...defaultProps} onValueChange={onValueChange} />);

    const trigger = screen.getByRole('button', { name: 'Kategorie suchen oder auswählen' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(trigger);
    expect(
      screen.getByRole('dialog', { name: 'Kategorie suchen oder auswählen' })
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Kultur'));

    expect(screen.getByLabelText('Mobilität')).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText('Kategorien suchen'), { key: 'Escape' });
    expect(screen.queryByLabelText('Kategorien suchen')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('preserves an unavailable selected value and allows removing it', () => {
    const onValueChange = vi.fn();
    render(
      <SearchableMultiSelect
        {...defaultProps}
        onValueChange={onValueChange}
        value={['Historische Kategorie']}
      />
    );

    expect(screen.getAllByText('Historische Kategorie')).toHaveLength(2);
    expect(screen.getByText('(nicht mehr verfügbar)')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Kategorie Historische Kategorie entfernen' })
    );

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it('disables selection while loading or after a load error', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SearchableMultiSelect {...defaultProps} loading onValueChange={onValueChange} />
    );

    expect(
      screen
        .getByRole('button', { name: 'Kategorie suchen oder auswählen' })
        .hasAttribute('disabled')
    ).toBe(true);
    expect(screen.getByText('Kategorien werden geladen.')).toBeTruthy();

    rerender(
      <SearchableMultiSelect
        {...defaultProps}
        errorMessage="Kategorien konnten nicht geladen werden."
        onValueChange={onValueChange}
      />
    );

    expect(
      screen
        .getByRole('button', { name: 'Kategorie suchen oder auswählen' })
        .hasAttribute('disabled')
    ).toBe(true);
    expect(screen.getByText('Kategorien konnten nicht geladen werden.')).toBeTruthy();
  });
});
