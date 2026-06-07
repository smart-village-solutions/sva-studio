import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('revokes the generated object url after the download was triggered', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:public-waste-pdf');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    fetchMock.mockResolvedValue(
      new Response(new Blob(['pdf'], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="abfallkalender-2026-rathenow.pdf"',
        },
      })
    );

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

    const anchorClick = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'append').mockImplementation(() => undefined);
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor = originalCreateElement(tagName) as HTMLAnchorElement;
        vi.spyOn(anchor, 'click').mockImplementation(anchorClick);
        vi.spyOn(anchor, 'remove').mockImplementation(() => undefined);
        return anchor;
      }

      return originalCreateElement(tagName);
    });
    const timeoutCallCountBeforeClick = setTimeoutSpy.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Druckversion herunterladen' }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    });
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    const newTimeoutCalls = setTimeoutSpy.mock.calls.slice(timeoutCallCountBeforeClick);
    expect(newTimeoutCalls.some((call) => call[1] === 0)).toBe(true);

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:public-waste-pdf');

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    setTimeoutSpy.mockRestore();
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Ort suchen' }), { target: { value: 'Mus' } });
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
              tourName: 'Biotour Nord',
              tourDescription: 'Wöchentliche Leerung im Innenstadtbereich.',
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

    const dialog = screen.getByRole('dialog');
    expect(screen.getAllByText('Wöchentliche Leerung im Innenstadtbereich.')).toHaveLength(2);
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Biotour Nord')).toBeTruthy();
    expect(within(dialog).getByText('Wöchentliche Leerung im Innenstadtbereich.')).toBeTruthy();
    expect(within(dialog).getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' })).toBeTruthy();
  });
});
