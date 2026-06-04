import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PublicWasteApp } from './public-waste-app.js';

describe('PublicWasteApp', () => {
  it('renders header actions for calendar import and current-year pdf download', () => {
    render(
      <PublicWasteApp
        selectionState="complete"
        selectionSummary="Musterstadt, Hauptstraße 12"
        calendarModel={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [
            {
              id: 'pickup-1',
              date: '2026-05-19',
              fractionId: 'bio',
              fractionLabel: 'Bioabfall',
              fractionColor: '#00AA00',
              note: null,
            },
          ],
          monthBuckets: [],
          yearBuckets: [],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
        }}
        pdfLinks={[
          'https://example.invalid/2025.pdf',
          'https://example.invalid/2026.pdf',
          'https://example.invalid/2027.pdf',
        ]}
        icalUrl="https://example.invalid/calendar.ics"
        onChangeLocation={() => undefined}
      />
    );

    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' }).getAttribute('href')).toBe(
      'https://example.invalid/calendar.ics'
    );
    expect(screen.getByRole('link', { name: 'Druckversion herunterladen' }).getAttribute('href')).toBe(
      'https://example.invalid/2026.pdf'
    );
    expect(screen.getByText('Musterstadt')).toBeTruthy();
    expect(screen.getByText('Hauptstraße')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adresse ändern' })).toBeTruthy();
  });

  it('starts with all fractions selected and filters the visible entries without clearing the selection summary', () => {
    render(
      <PublicWasteApp
        selectionState="complete"
        selectionSummary="Musterstadt, Hauptstraße 12"
        calendarModel={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [
            {
              id: 'pickup-1',
              date: '2026-05-19',
              fractionId: 'bio',
              fractionLabel: 'Bioabfall',
              fractionColor: '#00AA00',
              note: null,
            },
            {
              id: 'pickup-2',
              date: '2026-05-20',
              fractionId: 'paper',
              fractionLabel: 'Papier',
              fractionColor: '#0000FF',
              note: null,
            },
          ],
          monthBuckets: [],
          yearBuckets: [],
          fractionOptions: [
            { id: 'bio', label: 'Bioabfall' },
            { id: 'paper', label: 'Papier' },
          ],
        }}
        pdfLinks={[]}
        icalUrl="https://example.invalid/calendar.ics"
        onChangeLocation={() => undefined}
      />
    );

    expect((screen.getByRole('checkbox', { name: 'Bioabfall' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Papier' }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bioabfall' }));

    expect(screen.getByText('Musterstadt')).toBeTruthy();
    expect(screen.getByText('Hauptstraße')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mai 2026' })).toBeTruthy();
    const pickupLists = screen.getAllByRole('list');
    expect(pickupLists.at(-1)?.textContent).not.toContain('Bioabfall');
    expect(pickupLists.at(-1)?.textContent).toContain('Papier');
  });

  it('allows deselecting all fractions so that no pickup entries remain visible', () => {
    render(
      <PublicWasteApp
        selectionState="complete"
        selectionSummary="Musterstadt, Hauptstraße 12"
        calendarModel={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [
            {
              id: 'pickup-1',
              date: '2026-05-19',
              fractionId: 'bio',
              fractionLabel: 'Bioabfall',
              fractionColor: '#00AA00',
              note: null,
            },
            {
              id: 'pickup-2',
              date: '2026-05-20',
              fractionId: 'paper',
              fractionLabel: 'Papier',
              fractionColor: '#0000FF',
              note: null,
            },
          ],
          monthBuckets: [],
          yearBuckets: [],
          fractionOptions: [
            { id: 'bio', label: 'Bioabfall' },
            { id: 'paper', label: 'Papier' },
          ],
        }}
        pdfLinks={[]}
        icalUrl="https://example.invalid/calendar.ics"
        onChangeLocation={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bioabfall' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Papier' }));

    expect((screen.getByRole('checkbox', { name: 'Bioabfall' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('checkbox', { name: 'Papier' }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('button', { name: 'Termin Bioabfall am 2026-05-19' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Termin Papier am 2026-05-20' })).toBeNull();
  });

  it('renders the reduced selection form while the location is still incomplete', () => {
    render(
      <PublicWasteApp
        selectionState="incomplete"
        nextStepLabel="Ort"
        selectionOptions={[
          { id: 'c-1', label: 'Musterstadt' },
          { id: 'c-2', label: 'Nebenort' },
        ]}
        selectionPath={[]}
        onEditSelectionStep={() => undefined}
        onSelectOption={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Standort wählen' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Ort suchen' }), { target: { value: 'Mus' } });
    expect(screen.getByRole('button', { name: 'Musterstadt' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'iCal abonnieren' })).toBeNull();
  });

  it('opens a pickup detail dialog when an entry is activated and keeps global actions outside the dialog', () => {
    render(
      <PublicWasteApp
        selectionState="complete"
        selectionSummary="Musterstadt, Hauptstraße 12"
        calendarModel={{
          locationKey: 'r-1:c-1:s-1:h-1',
          nextPickupDate: '2026-05-19',
          listEntries: [
            {
              id: 'pickup-1',
              date: '2026-05-19',
              fractionId: 'bio',
              fractionLabel: 'Bioabfall',
              fractionColor: '#00AA00',
              tourName: 'Biotour Nord',
              tourDescription: 'Wöchentliche Leerung im Innenstadtbereich.',
              note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
            },
          ],
          monthBuckets: [],
          yearBuckets: [],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
        }}
        pdfLinks={['https://example.invalid/2025.pdf', 'https://example.invalid/2026.pdf', 'https://example.invalid/2027.pdf']}
        icalUrl="https://example.invalid/calendar.ics"
        onChangeLocation={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' }));

    const dialog = screen.getByRole('dialog');
    expect(screen.getAllByText('Wöchentliche Leerung im Innenstadtbereich.')).toHaveLength(2);
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Biotour Nord')).toBeTruthy();
    expect(within(dialog).getByText('Wöchentliche Leerung im Innenstadtbereich.')).toBeTruthy();
    expect(within(dialog).getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' })).toBeTruthy();
  });
});
