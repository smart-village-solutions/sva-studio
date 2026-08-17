import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventsCategoryMultiselect } from '../src/events.category-multiselect.js';

describe('EventsCategoryMultiselect', () => {
  afterEach(() => cleanup());

  it('only selects categories supplied by the Mainserver catalog', () => {
    const onChange = vi.fn();
    render(
      <EventsCategoryMultiselect
        availableCategories={[{ id: 'cat-1', name: 'Kultur' }]}
        emptyText="Keine passenden Kategorien gefunden."
        helpText="Wählen Sie Kategorien aus."
        inputPlaceholder="Kategorie suchen oder auswählen"
        loading={false}
        loadingText="Kategorien werden geladen."
        onChange={onChange}
        removeLabel={(name) => `Kategorie ${name} entfernen`}
        searchLabel="Kategorien suchen"
        unavailableText="nicht mehr verfügbar"
        value={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kategorie suchen oder auswählen' }));
    const searchInput = screen.getByLabelText('Kategorien suchen');
    fireEvent.change(searchInput, { target: { value: 'Frei erfunden' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(searchInput, { target: { value: 'Kultur' } });
    fireEvent.click(screen.getByLabelText('Kultur'));
    expect(onChange).toHaveBeenCalledWith(['Kultur']);
  });
});
