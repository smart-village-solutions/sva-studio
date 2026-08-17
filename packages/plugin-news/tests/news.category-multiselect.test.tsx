import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NewsCategoryMultiselect } from '../src/news.category-multiselect.js';

describe('NewsCategoryMultiselect', () => {
  afterEach(() => cleanup());

  it('only selects categories supplied by the Mainserver catalog', () => {
    const onChange = vi.fn();
    render(
      <NewsCategoryMultiselect
        availableCategories={[{ id: 'cat-1', name: 'Rathaus' }]}
        emptyText="Keine passenden Kategorien gefunden."
        helpText="Wählen Sie Kategorien aus."
        inputId="news-category-test"
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

    const trigger = screen.getByRole('button', { name: 'Kategorie suchen oder auswählen' });
    expect(trigger.id).toBe('news-category-test');
    fireEvent.click(trigger);
    const searchInput = screen.getByLabelText('Kategorien suchen');
    fireEvent.change(searchInput, { target: { value: 'Frei erfunden' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(searchInput, { target: { value: 'Rathaus' } });
    fireEvent.click(screen.getByLabelText('Rathaus'));
    expect(onChange).toHaveBeenCalledWith(['Rathaus']);
  });
});
