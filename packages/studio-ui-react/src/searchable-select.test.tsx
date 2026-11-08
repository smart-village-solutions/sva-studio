import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchableSelect } from './searchable-select';
import { Dialog, DialogContent, DialogTitle } from './dialog';

afterEach(cleanup);

describe('SearchableSelect', () => {
  it('can use an external visible label while retaining its accessible name', () => {
    render(
      <div>
        <label htmlFor="organization-select">Organisation</label>
        <SearchableSelect
          id="organization-select"
          label="Organisation"
          showLabel={false}
          value=""
          placeholder="Bitte wählen"
          searchPlaceholder="Suchen"
          emptyText="Keine Treffer"
          options={[{ value: 'org-1', label: 'Musterstadt' }]}
          onValueChange={vi.fn()}
        />
      </div>
    );

    expect(screen.getAllByText('Organisation', { selector: 'label' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Organisation' }).id).toBe('organization-select');
  });

  it('filters options inside the open dropdown and selects a value', () => {
    const onValueChange = vi.fn();

    render(
      <SearchableSelect
        id="organization-select"
        label="Organisation"
        value=""
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[
          { value: 'org-1', label: 'Musterstadt' },
          { value: 'org-2', label: 'Stadtwerke' },
        ]}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));
    fireEvent.change(screen.getByPlaceholderText('Suchen'), { target: { value: 'stadtw' } });
    fireEvent.click(screen.getByRole('option', { name: 'Stadtwerke' }));

    expect(onValueChange).toHaveBeenCalledWith('org-2');
  });

  it('returns focus to the trigger after selecting an option with the mouse', () => {
    render(
      <SearchableSelect
        id="organization-select"
        label="Organisation"
        value=""
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[
          { value: 'org-1', label: 'Musterstadt' },
          { value: 'org-2', label: 'Stadtwerke' },
        ]}
        onValueChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Organisation' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Stadtwerke' }));

    expect(document.activeElement).toBe(trigger);
  });

  it('renders the listbox options under presentation list items', () => {
    render(
      <SearchableSelect
        id="organization-select"
        label="Organisation"
        value=""
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[
          { value: 'org-1', label: 'Musterstadt' },
          { value: 'org-2', label: 'Stadtwerke' },
        ]}
        onValueChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));

    const option = screen.getByRole('option', { name: 'Musterstadt' });
    expect(option.parentElement?.getAttribute('role')).toBe('presentation');
  });

  it('supports arrow navigation and enter selection from the search input', () => {
    const onValueChange = vi.fn();

    render(
      <SearchableSelect
        id="organization-select"
        label="Organisation"
        value=""
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[
          { value: 'org-1', label: 'Musterstadt' },
          { value: 'org-2', label: 'Stadtwerke' },
          { value: 'org-3', label: 'Kreisarchiv' },
        ]}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));

    const searchInput = screen.getByPlaceholderText('Suchen');
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledWith('org-2');
  });

  it('wraps past disabled boundary options while keeping an enabled option active', () => {
    const onValueChange = vi.fn();

    render(
      <SearchableSelect
        id="realm-select"
        label="Realm"
        value="realm-2"
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[
          { value: 'realm-1', label: 'Realm 1' },
          { value: 'realm-2', label: 'Realm 2' },
          { value: 'master', label: 'Master', disabled: true },
        ]}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Realm' }));
    const searchInput = screen.getByPlaceholderText('Suchen');
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledWith('realm-1');
  });

  it('activates the first enabled option when the selected option is disabled', () => {
    const onValueChange = vi.fn();

    render(
      <SearchableSelect
        id="realm-select"
        label="Realm"
        value="master"
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[
          { value: 'master', label: 'Master', disabled: true },
          { value: 'realm-1', label: 'Realm 1' },
        ]}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Realm' }));
    const searchInput = screen.getByRole('combobox', { name: 'Suchen' });
    const listbox = screen.getByRole('listbox', { name: 'Realm' });
    expect(searchInput.getAttribute('aria-autocomplete')).toBe('list');
    expect(searchInput.getAttribute('aria-controls')).toBe(listbox.id);
    expect(searchInput.getAttribute('aria-expanded')).toBe('true');
    expect(searchInput.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Realm 1' }).id
    );
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledWith('realm-1');
  });

  it('closes on escape and returns focus to the trigger', () => {
    render(
      <SearchableSelect
        id="organization-select"
        label="Organisation"
        value=""
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[
          { value: 'org-1', label: 'Musterstadt' },
          { value: 'org-2', label: 'Stadtwerke' },
        ]}
        onValueChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Organisation' });
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText('Suchen');
    fireEvent.keyDown(searchInput, { key: 'Escape' });

    expect(screen.queryByPlaceholderText('Suchen')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps showing a controlled remote selection after the search result resets', () => {
    const onSearchValueChange = vi.fn();

    const { rerender } = render(
      <SearchableSelect
        id="organization-select"
        label="Organisation"
        value="org-200"
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[{ value: 'org-200', label: 'Zweihundertstadt' }]}
        selectedOption={{ value: 'org-200', label: 'Zweihundertstadt' }}
        searchValue="zwei"
        onSearchValueChange={onSearchValueChange}
        onValueChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));
    fireEvent.click(screen.getByRole('option', { name: 'Zweihundertstadt' }));

    expect(onSearchValueChange).toHaveBeenCalledWith('');

    rerender(
      <SearchableSelect
        id="organization-select"
        label="Organisation"
        value="org-200"
        placeholder="Bitte wählen"
        searchPlaceholder="Suchen"
        emptyText="Keine Treffer"
        options={[]}
        selectedOption={{ value: 'org-200', label: 'Zweihundertstadt' }}
        searchValue=""
        onSearchValueChange={onSearchValueChange}
        onValueChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Organisation' }).textContent).toContain(
      'Zweihundertstadt'
    );
  });

  it('prevents parent form submission when enter is pressed without matching options', () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <SearchableSelect
          id="organization-select"
          label="Organisation"
          value=""
          placeholder="Bitte wählen"
          searchPlaceholder="Suchen"
          emptyText="Keine Treffer"
          options={[{ value: 'org-1', label: 'Musterstadt' }]}
          onValueChange={vi.fn()}
        />
      </form>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));
    fireEvent.change(screen.getByPlaceholderText('Suchen'), { target: { value: 'zzzz' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Suchen'), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes the popover when focus leaves the widget via keyboard navigation', () => {
    render(
      <div>
        <SearchableSelect
          id="organization-select"
          label="Organisation"
          value=""
          placeholder="Bitte wählen"
          searchPlaceholder="Suchen"
          emptyText="Keine Treffer"
          options={[{ value: 'org-1', label: 'Musterstadt' }]}
          onValueChange={vi.fn()}
        />
        <button type="button">Weiter</button>
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));
    act(() => screen.getByRole('button', { name: 'Weiter' }).focus());

    expect(screen.queryByPlaceholderText('Suchen')).toBeNull();
  });
});

it('keeps an explicit clear action available when the search has no matches', () => {
  const onValueChange = vi.fn();
  render(
    <SearchableSelect
      id="optional"
      label="Abholort"
      value="a"
      placeholder="Wählen"
      searchPlaceholder="Suchen"
      emptyText="Keine Treffer"
      clearLabel="Auswahl aufheben"
      options={[{ value: 'a', label: 'Markt' }]}
      onValueChange={onValueChange}
    />
  );
  const trigger = screen.getByRole('button', { name: 'Abholort' });
  fireEvent.click(trigger);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'unbekannt' } });
  expect(screen.getByText('Keine Treffer')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Auswahl aufheben' }));
  expect(onValueChange).toHaveBeenCalledWith('');
  expect(document.activeElement).toBe(trigger);
});

it('closes an open search when its owner disables the control', () => {
  const onValueChange = vi.fn();
  const props = {
    id: 'disabling',
    label: 'Organisation',
    value: 'a',
    placeholder: 'Wählen',
    searchPlaceholder: 'Suchen',
    emptyText: 'Leer',
    options: [{ value: 'a', label: 'Stadt' }],
    onValueChange,
  };
  const { rerender } = render(<SearchableSelect {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Organisation' }));
  expect(screen.getByRole('combobox')).toBeTruthy();
  rerender(<SearchableSelect {...props} disabled />);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect((screen.getByRole('button', { name: 'Organisation' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  expect(onValueChange).not.toHaveBeenCalled();
});

it('closes only the search on Escape inside a parent dialog and restores its trigger', () => {
  render(
    <Dialog open>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Zuordnung</DialogTitle>
        <SearchableSelect
          id="dialog-location"
          label="Abholort"
          value=""
          placeholder="Wählen"
          searchPlaceholder="Suchen"
          emptyText="Leer"
          options={[{ value: 'a', label: 'Markt' }]}
          onValueChange={vi.fn()}
        />
      </DialogContent>
    </Dialog>
  );
  const trigger = screen.getByRole('button', { name: 'Abholort' });
  fireEvent.click(trigger);
  const search = screen.getByRole('combobox', { name: 'Suchen' });
  fireEvent.keyDown(search, { key: 'Escape' });
  expect(screen.queryByRole('combobox', { name: 'Suchen' })).toBeNull();
  expect(screen.getByRole('dialog', { name: 'Zuordnung' })).toBeTruthy();
  expect(document.activeElement).toBe(trigger);
  cleanup();
});

it('leaves a search without a clear action on Tab instead of looping inside the popover', () => {
  render(
    <SearchableSelect
      id="tab-location"
      label="Abholort"
      value=""
      placeholder="Wählen"
      searchPlaceholder="Suchen"
      emptyText="Leer"
      options={[{ value: 'a', label: 'Markt' }]}
      onValueChange={vi.fn()}
    />
  );
  const trigger = screen.getByRole('button', { name: 'Abholort' });
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Suchen' }), { key: 'Tab' });
  expect(screen.queryByRole('combobox', { name: 'Suchen' })).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
