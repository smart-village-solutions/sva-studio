import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchableMultiSelect } from './searchable-multi-select';

const options = [
  { value: 'user-1', label: 'Ada Lovelace' },
  { value: 'user-2', label: 'Grace Hopper' },
];

describe('SearchableMultiSelect', () => {
  afterEach(cleanup);

  it('exposes a multi-select listbox and keeps it open while toggling options', () => {
    const onValuesChange = vi.fn();
    render(
      <SearchableMultiSelect
        id="accounts"
        label="Accounts"
        values={['user-1']}
        placeholder="Accounts auswählen"
        selectedCountText="1 Account ausgewählt"
        searchPlaceholder="Accounts suchen"
        emptyText="Keine Accounts"
        options={options}
        selectedOptions={[options[0]]}
        removeValueLabel={(label) => `${label} entfernen`}
        onValuesChange={onValuesChange}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Accounts' });
    expect(trigger.getAttribute('aria-labelledby')).toBe('accounts-label');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    expect(screen.getByRole('option', { name: 'Ada Lovelace' }).getAttribute('aria-selected')).toBe(
      'true'
    );

    fireEvent.click(screen.getByRole('option', { name: 'Grace Hopper' }));

    expect(onValuesChange).toHaveBeenCalledWith(['user-1', 'user-2']);
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('toggles the active option with enter without submitting a parent form', () => {
    const onValuesChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <SearchableMultiSelect
          id="accounts"
          label="Accounts"
          values={[]}
          placeholder="Accounts auswählen"
          selectedCountText="0 Accounts ausgewählt"
          searchPlaceholder="Accounts suchen"
          emptyText="Keine Accounts"
          options={options}
          selectedOptions={[]}
          removeValueLabel={(label) => `${label} entfernen`}
          onValuesChange={onValuesChange}
        />
      </form>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
    fireEvent.keyDown(screen.getByPlaceholderText('Accounts suchen'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByPlaceholderText('Accounts suchen'), { key: 'Enter' });

    expect(onValuesChange).toHaveBeenCalledWith(['user-2']);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes a selected value from its chip', () => {
    const onValuesChange = vi.fn();
    render(
      <SearchableMultiSelect
        id="accounts"
        label="Accounts"
        values={['user-1', 'user-2']}
        placeholder="Accounts auswählen"
        selectedCountText="2 Accounts ausgewählt"
        searchPlaceholder="Accounts suchen"
        emptyText="Keine Accounts"
        options={options}
        selectedOptions={options}
        removeValueLabel={(label) => `${label} entfernen`}
        onValuesChange={onValuesChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ada Lovelace entfernen' }));

    expect(onValuesChange).toHaveBeenCalledWith(['user-2']);
  });
});
