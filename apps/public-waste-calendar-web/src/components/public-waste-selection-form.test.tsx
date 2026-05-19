import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PublicWasteSelectionForm } from './public-waste-selection-form.js';

describe('PublicWasteSelectionForm', () => {
  it('renders a simple option list for short selections', () => {
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

    expect(screen.getByRole('button', { name: 'Ahrensdorf' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Ort suchen' })).toBeNull();
  });

  it('renders a searchable combobox for long selections and filters by partial match', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Am alten Hafen' }));

    expect(onSelectOption).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('button', { name: 'Berliner Straße' })).toBeNull();
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
