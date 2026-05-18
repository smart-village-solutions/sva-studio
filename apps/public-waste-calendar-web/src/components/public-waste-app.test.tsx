import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PublicWasteApp } from './public-waste-app.js';

describe('PublicWasteApp', () => {
  it('renders the restored-location notice and global export actions', () => {
    render(
      <PublicWasteApp
        selectionState="complete"
        restoredLocationNotice="Gespeicherte Adresse geladen. Sie können die Auswahl ändern."
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
      />
    );

    expect(screen.getByText('Gespeicherte Adresse geladen. Sie können die Auswahl ändern.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'PDF 2026' }).getAttribute('href')).toBe(
      'https://example.invalid/2026.pdf'
    );
    expect(screen.getByRole('link', { name: 'iCal abonnieren' }).getAttribute('href')).toBe(
      'https://example.invalid/calendar.ics'
    );
  });

  it('filters the visible entries by fraction without clearing the selection summary', () => {
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
              note: null,
            },
            {
              id: 'pickup-2',
              date: '2026-05-20',
              fractionId: 'paper',
              fractionLabel: 'Papier',
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
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bioabfall' }));

    expect(screen.getByText('Musterstadt, Hauptstraße 12')).toBeTruthy();
    const pickupList = screen.getByRole('list');
    expect(pickupList.textContent).toContain('Bioabfall');
    expect(pickupList.textContent).not.toContain('Papier');
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
        onSelectOption={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'Standort wählen' })).toBeTruthy();
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
              note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
            },
          ],
          monthBuckets: [],
          yearBuckets: [],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
        }}
        pdfLinks={['https://example.invalid/2025.pdf', 'https://example.invalid/2026.pdf', 'https://example.invalid/2027.pdf']}
        icalUrl="https://example.invalid/calendar.ics"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'iCal abonnieren' })).toBeTruthy();
  });
});
