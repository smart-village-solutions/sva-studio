import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NewsCategoryMultiselect } from '../src/news.category-multiselect.js';

describe('NewsCategoryMultiselect', () => {
  afterEach(() => {
    cleanup();
  });

  it('adds deduplicated categories, filters suggestions and removes selected entries', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <NewsCategoryMultiselect
        availableCategories={[
          { id: 'cat-1', name: 'Allgemein' },
          { id: 'cat-2', name: 'Rathaus' },
          { id: 'cat-3', name: 'Kultur' },
        ]}
        helpText="Waehlen Sie Kategorien aus."
        inputPlaceholder="Kategorie suchen oder auswaehlen"
        loading={false}
        loadingText="Kategorien werden geladen."
        onChange={onChange}
        removeLabel={(name) => `Kategorie ${name} entfernen`}
        addLabel="Kategorie hinzufügen"
        searchLabel="Kategorien suchen"
        value={['Allgemein']}
      />
    );

    fireEvent.change(screen.getByLabelText('Kategorien suchen'), { target: { value: 'rat' } });

    const optionValues = Array.from(container.querySelectorAll('datalist option')).map((option) => option.getAttribute('value'));
    expect(optionValues).toEqual(['Rathaus']);

    fireEvent.click(screen.getByRole('button', { name: 'Kategorie hinzufügen' }));
    expect(onChange).toHaveBeenCalledWith(['Allgemein', 'rat']);

    rerender(
      <NewsCategoryMultiselect
        availableCategories={[
          { id: 'cat-1', name: 'Allgemein' },
          { id: 'cat-2', name: 'Rathaus' },
          { id: 'cat-3', name: 'Kultur' },
        ]}
        helpText="Waehlen Sie Kategorien aus."
        inputPlaceholder="Kategorie suchen oder auswaehlen"
        loading={false}
        loadingText="Kategorien werden geladen."
        onChange={onChange}
        removeLabel={(name) => `Kategorie ${name} entfernen`}
        addLabel="Kategorie hinzufügen"
        searchLabel="Kategorien suchen"
        value={['Allgemein', 'Rathaus']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kategorie Rathaus entfernen' }));
    expect(onChange).toHaveBeenCalledWith(['Allgemein']);
  });

  it('renders loading and error states', () => {
    const onChange = vi.fn();

    render(
      <NewsCategoryMultiselect
        availableCategories={[]}
        errorMessage="Die Kategorien konnten nicht geladen werden."
        helpText="Waehlen Sie Kategorien aus."
        inputPlaceholder="Kategorie suchen oder auswaehlen"
        loading
        loadingText="Kategorien werden geladen."
        onChange={onChange}
        removeLabel={(name) => `Kategorie ${name} entfernen`}
        addLabel="Kategorie hinzufügen"
        searchLabel="Kategorien suchen"
        value={[]}
      />
    );

    expect(screen.getByText('Kategorien werden geladen.')).toBeTruthy();
    expect(screen.getByText('Die Kategorien konnten nicht geladen werden.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Kategorie hinzufügen' }).at(-1)?.hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByLabelText('Kategorien suchen').at(-1)?.hasAttribute('disabled')).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports adding trimmed categories via enter', () => {
    const onChange = vi.fn();

    render(
      <NewsCategoryMultiselect
        availableCategories={[{ id: 'cat-3', name: 'Kultur' }]}
        helpText="Waehlen Sie Kategorien aus."
        inputPlaceholder="Kategorie suchen oder auswaehlen"
        loading={false}
        loadingText="Kategorien werden geladen."
        onChange={onChange}
        removeLabel={(name) => `Kategorie ${name} entfernen`}
        addLabel="Kategorie hinzufügen"
        searchLabel="Kategorien suchen"
        value={[]}
      />
    );

    const input = screen.getByLabelText('Kategorien suchen');
    fireEvent.change(input, { target: { value: '  Kultur  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['Kultur']);
  });
});
