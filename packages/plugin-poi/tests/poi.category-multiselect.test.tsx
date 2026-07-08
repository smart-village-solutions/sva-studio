import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PoiCategoryMultiselect } from '../src/poi.category-multiselect.js';

describe('PoiCategoryMultiselect', () => {
  afterEach(() => {
    cleanup();
  });

  it('selects a suggested category immediately through the stable input id', () => {
    const onChange = vi.fn();

    render(
      <PoiCategoryMultiselect
        availableCategories={[{ id: 'cat-1', name: 'Verwaltung' }]}
        helpText="Waehlen Sie Kategorien aus."
        inputId="poi-category"
        inputPlaceholder="Kategorie suchen oder auswaehlen"
        loading={false}
        loadingText="Kategorien werden geladen."
        onChange={onChange}
        removeLabel={(name) => `Kategorie ${name} entfernen`}
        searchLabel="Kategorien suchen"
        value={[]}
      />
    );

    const input = screen.getByLabelText('Kategorien suchen');
    expect(input.getAttribute('id')).toBe('poi-category');

    fireEvent.change(input, { target: { value: 'Verwaltung' } });

    expect(onChange).toHaveBeenCalledWith(['Verwaltung']);
  });

  it('renders loading and error states', () => {
    const onChange = vi.fn();

    render(
      <PoiCategoryMultiselect
        availableCategories={[]}
        errorMessage="Die Kategorien konnten nicht geladen werden."
        helpText="Waehlen Sie Kategorien aus."
        inputPlaceholder="Kategorie suchen oder auswaehlen"
        loading
        loadingText="Kategorien werden geladen."
        onChange={onChange}
        removeLabel={(name) => `Kategorie ${name} entfernen`}
        searchLabel="Kategorien suchen"
        value={[]}
      />
    );

    expect(screen.getByText('Kategorien werden geladen.')).toBeTruthy();
    expect(screen.getByText('Die Kategorien konnten nicht geladen werden.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kategorie hinzufügen' })).toBeNull();
    expect(screen.getAllByLabelText('Kategorien suchen').at(-1)?.hasAttribute('disabled')).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
