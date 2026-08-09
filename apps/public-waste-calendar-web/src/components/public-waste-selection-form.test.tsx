import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PublicWasteSelectionForm } from './public-waste-selection-form.js';

describe('PublicWasteSelectionForm', () => {
  it('shows all city options initially and filters them after typing', () => {
    const onSelectOption = vi.fn();

    render(
      <PublicWasteSelectionForm
        nextStepLabel="Ort"
        options={[
          { id: '1', label: 'Ahrensdorf' },
          { id: '2', label: 'Buchholz' },
          { id: '3', label: 'Bad Wilsnack' },
        ]}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={onSelectOption}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Ort suchen' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Ahrensdorf' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Buchholz' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Bad Wilsnack' })).toBeTruthy();
    expect(screen.getByText('3 Einträge')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('3 Einträge');

    fireEvent.change(screen.getByRole('combobox', { name: 'Ort suchen' }), {
      target: { value: 'bu' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Buchholz' }));

    expect(screen.queryByRole('option', { name: 'Ahrensdorf' })).toBeNull();
    expect(onSelectOption).toHaveBeenCalledWith('2');
  });

  it('renders a searchable textbox for long selections and filters by partial match', () => {
    const onSelectOption = vi.fn();

    render(
      <PublicWasteSelectionForm
        nextStepLabel="Straße"
        options={[
          { id: '1', label: 'Ackerstraße' },
          { id: '2', label: 'Am alten Hafen' },
          { id: '3', label: 'Bahnhofstraße' },
          { id: '4', label: 'Berliner Straße' },
          { id: '5', label: 'Dorfstraße' },
          { id: '6', label: 'Feldweg' },
          { id: '7', label: 'Gartenstraße' },
        ]}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={onSelectOption}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Straße suchen' }), {
      target: { value: 'hafen' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Am alten Hafen' }));

    expect(onSelectOption).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('option', { name: 'Berliner Straße' })).toBeNull();
  });

  it('uses the same typeahead behavior for short follow-up selections', () => {
    const onSelectOption = vi.fn();

    render(
      <PublicWasteSelectionForm
        nextStepLabel="Hausnummer"
        options={[
          { id: '1', label: '12' },
          { id: '2', label: '14a' },
        ]}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={onSelectOption}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Hausnummer suchen' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '12' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '14a' })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Hausnummer suchen' }), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('option', { name: '12' }));

    expect(onSelectOption).toHaveBeenCalledWith('1');
  });

  it('does not truncate the initial option list', () => {
    render(
      <PublicWasteSelectionForm
        nextStepLabel="Straße"
        options={Array.from({ length: 12 }, (_, index) => ({
          id: String(index + 1),
          label: `Straße ${String(index + 1).padStart(2, '0')}`,
        }))}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={() => undefined}
      />
    );

    expect(screen.getAllByRole('option', { name: /^Straße \d{2}$/u })).toHaveLength(12);
    expect(screen.getByRole('option', { name: 'Straße 12' })).toBeTruthy();
    expect(screen.getByText('12 Einträge')).toBeTruthy();
  });

  it('supports listbox navigation without adding every option to the tab order', () => {
    const onSelectOption = vi.fn();

    render(
      <PublicWasteSelectionForm
        nextStepLabel="Ort"
        options={[
          { id: '1', label: 'Ahrensdorf' },
          { id: '2', label: 'Buchholz' },
        ]}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={onSelectOption}
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Ort suchen' });
    const options = screen.getAllByRole('option');
    expect(combobox.getAttribute('aria-controls')).toBe(
      screen.getByRole('listbox', { name: 'Ort-Auswahl' }).id
    );
    expect(options.every((option) => option.tabIndex === -1)).toBe(true);

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(onSelectOption).toHaveBeenCalledWith('2');
  });

  it('clears an unsuccessful search with Escape', () => {
    render(
      <PublicWasteSelectionForm
        nextStepLabel="Ort"
        options={[
          { id: '1', label: 'Ahrensdorf' },
          { id: '2', label: 'Buchholz' },
        ]}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={() => undefined}
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Ort suchen' });
    fireEvent.change(combobox, { target: { value: 'unbekannt' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);

    fireEvent.keyDown(combobox, { key: 'Escape' });

    expect((combobox as HTMLInputElement).value).toBe('');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('activates an option when the pointer enters it', () => {
    render(
      <PublicWasteSelectionForm
        nextStepLabel="Ort"
        options={[
          { id: '1', label: 'Ahrensdorf' },
          { id: '2', label: 'Buchholz' },
        ]}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={() => undefined}
      />
    );

    const option = screen.getByRole('option', { name: 'Buchholz' });
    fireEvent.mouseEnter(option);

    expect(option.getAttribute('aria-selected')).toBe('true');
  });

  it('shows a scroll hint while additional options remain below the viewport', () => {
    render(
      <PublicWasteSelectionForm
        nextStepLabel="Straße"
        options={Array.from({ length: 12 }, (_, index) => ({
          id: String(index + 1),
          label: `Straße ${String(index + 1).padStart(2, '0')}`,
        }))}
        selectionPath={[]}
        onEditStep={() => undefined}
        onSelectOption={() => undefined}
      />
    );

    const results = screen.getByLabelText('Straße-Auswahl');
    Object.defineProperties(results, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 600 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });

    fireEvent.scroll(results);
    expect(screen.getByText('Weitere Einträge')).toBeTruthy();

    results.scrollTop = 300;
    fireEvent.scroll(results);
    expect(screen.queryByText('Weitere Einträge')).toBeNull();
  });

  it('shows the resolved path and allows jumping back to an earlier step', () => {
    const onEditStep = vi.fn();

    render(
      <PublicWasteSelectionForm
        nextStepLabel="Hausnummer"
        options={[{ id: '1', label: '12' }]}
        selectionPath={[
          { step: 'Ort', label: 'Rathenow' },
          { step: 'Straße', label: 'Am alten Hafen' },
        ]}
        onEditStep={onEditStep}
        onSelectOption={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ort ändern' }));

    expect(screen.getByText('Rathenow')).toBeTruthy();
    expect(screen.getByText('Am alten Hafen')).toBeTruthy();
    expect(onEditStep).toHaveBeenCalledWith(0);
  });
});
