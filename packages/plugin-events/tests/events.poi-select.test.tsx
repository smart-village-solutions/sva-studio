import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventsPoiSelect } from '../src/events.poi-select.js';

describe('EventsPoiSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('exposes the stable input id and selects a POI from the suggestion list', () => {
    const onChange = vi.fn();

    render(
      <EventsPoiSelect
        availablePois={[
          { id: 'poi-1', name: 'Rathaus' },
          { id: 'poi-2', name: 'Stadthalle' },
        ]}
        clearLabel="Auswahl loeschen"
        emptyText="Keine Orte gefunden"
        inputId="event-poi"
        inputPlaceholder="Ort suchen"
        loading={false}
        loadingText="Orte werden geladen."
        onChange={onChange}
        searchLabel="Ort suchen"
        value=""
      />
    );

    const input = screen.getByLabelText('Ort suchen');
    expect(input.getAttribute('id')).toBe('event-poi');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Rath' } });
    fireEvent.click(screen.getByRole('button', { name: /Rathaus\s*poi-1/ }));

    expect(onChange).toHaveBeenCalledWith('poi-1');
  });

  it('clears an existing selection and shows the error message', () => {
    const onChange = vi.fn();

    render(
      <EventsPoiSelect
        availablePois={[{ id: 'poi-1', name: 'Rathaus' }]}
        clearLabel="Auswahl loeschen"
        emptyText="Keine Orte gefunden"
        errorMessage="Die Orte konnten nicht geladen werden."
        inputPlaceholder="Ort suchen"
        loading={false}
        loadingText="Orte werden geladen."
        onChange={onChange}
        searchLabel="Ort suchen"
        value="poi-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Auswahl loeschen' }));

    expect(screen.getByText('Die Orte konnten nicht geladen werden.')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith('');
  });
});
