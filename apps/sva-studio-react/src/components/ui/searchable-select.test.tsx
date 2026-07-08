import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchableSelect } from './searchable-select';

describe('SearchableSelect', () => {
  afterEach(() => {
    cleanup();
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
});
