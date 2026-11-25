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

const longOptions = [
  ...defaultProps.options,
  ...['Sport', 'Bildung', 'Umwelt', 'Tourismus'].map((label) => ({ label, value: label })),
];

describe('SearchableMultiSelect', () => {
  afterEach(() => cleanup());

  it('selects only an available option and never creates a value from search text', () => {
    const onValueChange = vi.fn();
    render(
      <SearchableMultiSelect
        {...defaultProps}
        options={longOptions}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kategorie suchen oder auswählen' }));
    const searchInput = screen.getByLabelText('Kategorien suchen');
    fireEvent.change(searchInput, { target: { value: 'Neue Kategorie' } });
    expect(fireEvent.keyDown(searchInput, { key: 'Enter' })).toBe(false);

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
    expect(screen.getByRole('dialog', { name: 'Kategorie suchen oder auswählen' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Kultur'));

    expect(screen.getByLabelText('Mobilität')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Kategorien suchen' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Mobilität' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(['name', 'row', 'checkbox'] as const)(
    'selects a category by its %s without closing the panel',
    (target) => {
      const onValueChange = vi.fn();
      render(<SearchableMultiSelect {...defaultProps} onValueChange={onValueChange} />);
      const trigger = screen.getByRole('button', { name: defaultProps.placeholder });
      fireEvent.click(trigger);
      const focusedElement = document.activeElement as HTMLElement;
      const name = screen.getByText('Kultur');
      const clickTarget =
        target === 'checkbox'
          ? screen.getByRole('checkbox', { name: 'Kultur' })
          : target === 'name'
            ? name
            : name.closest('label');
      if (!clickTarget) throw new Error('Category row is missing');

      // Emulate the browser's default focus loss when mousedown is not cancelled.
      if (fireEvent.mouseDown(clickTarget)) {
        if (clickTarget instanceof HTMLInputElement) clickTarget.focus();
        else focusedElement.blur();
      }
      fireEvent.mouseUp(clickTarget);
      fireEvent.click(clickTarget);

      expect(onValueChange).toHaveBeenCalledExactlyOnceWith(['Kultur']);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByLabelText('Mobilität')).toBeTruthy();
    }
  );

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
