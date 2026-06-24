import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventsCategoryMultiselect } from '../src/events.category-multiselect.js';

describe('EventsCategoryMultiselect', () => {
  afterEach(() => {
    cleanup();
  });

  it('adds trimmed categories on blur through the stable input id', () => {
    const onChange = vi.fn();

    render(
      <EventsCategoryMultiselect
        availableCategories={[{ id: 'cat-1', name: 'Kultur' }]}
        helpText="Waehlen Sie Kategorien aus."
        inputId="event-category"
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
    expect(input.getAttribute('id')).toBe('event-category');

    fireEvent.change(input, { target: { value: '  Kultur  ' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(['Kultur']);
  });

  it('renders loading and error states', () => {
    const onChange = vi.fn();

    render(
      <EventsCategoryMultiselect
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
});
