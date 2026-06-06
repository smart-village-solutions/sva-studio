import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicWasteApp } from './public-waste-app.js';

describe('PublicWasteApp', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('renders header actions for calendar import and the on-demand pdf export', () => {
    render(
      <PublicWasteApp
        selection={{
          regionId: 'r-1',
          cityId: 'c-1',
          streetId: 's-1',
          houseNumberId: 'h-1',
        }}
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
        icalUrl="https://example.invalid/calendar.ics"
        onChangeLocation={() => undefined}
      />
    );

    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' }).getAttribute('href')).toBe(
      'https://example.invalid/calendar.ics'
    );
    expect(screen.getByRole('button', { name: 'Druckversion herunterladen' })).toBeTruthy();
    expect(screen.getByLabelText('PDF-Jahr')).toBeTruthy();
    expect(screen.getByText('Musterstadt')).toBeTruthy();
    expect(screen.getByText('Hauptstraße')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adresse ändern' })).toBeTruthy();
  });

  it('starts with all fractions selected and filters the visible entries without clearing the selection summary', () => {
    render(
      <PublicWasteApp
        selection={{
          regionId: 'r-1',
          cityId: 'c-1',
          streetId: 's-1',
          houseNumberId: 'h-1',
        }}
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
        selection={{
          regionId: 'r-1',
          cityId: 'c-1',
          streetId: 's-1',
          houseNumberId: 'h-1',
        }}
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
    expect(screen.getByRole('button', { name: 'Musterstadt' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'iCal abonnieren' })).toBeNull();
  });

  it('opens a pickup detail dialog when an entry is activated and keeps global actions outside the dialog', () => {
    render(
      <PublicWasteApp
        selection={{
          regionId: 'r-1',
          cityId: 'c-1',
          streetId: 's-1',
          houseNumberId: 'h-1',
        }}
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
              note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
            },
          ],
          monthBuckets: [],
          yearBuckets: [],
          fractionOptions: [{ id: 'bio', label: 'Bioabfall' }],
        }}
        icalUrl="https://example.invalid/calendar.ics"
        onChangeLocation={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' })).toBeTruthy();
  });
});
