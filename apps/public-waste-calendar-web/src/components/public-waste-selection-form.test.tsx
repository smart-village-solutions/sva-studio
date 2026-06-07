import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PublicWasteSelectionForm } from './public-waste-selection-form.js';

describe('PublicWasteSelectionForm', () => {
  it('renders the city step as typeahead and shows suggestions only after typing', () => {
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

    expect(screen.getByRole('textbox', { name: 'Ort suchen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ahrensdorf' })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Ort suchen' }), {
      target: { value: 'bu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buchholz' }));

    expect(screen.queryByRole('button', { name: 'Ahrensdorf' })).toBeNull();
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

    fireEvent.change(screen.getByRole('textbox', { name: 'Straße suchen' }), {
      target: { value: 'hafen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Am alten Hafen' }));

    expect(onSelectOption).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('button', { name: 'Berliner Straße' })).toBeNull();
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

    expect(screen.getByRole('textbox', { name: 'Hausnummer suchen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '12' })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Hausnummer suchen' }), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: '12' }));

    expect(onSelectOption).toHaveBeenCalledWith('1');
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
