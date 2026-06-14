import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicWasteApp } from './public-waste-app.js';
import {
  createPublicWasteCalendarEntryFixture,
  createPublicWasteCalendarModelFixture,
  expectPublicWasteSelectionHeader,
  publicWasteSelectionFixture,
  publicWasteSelectionSummaryFixture,
} from './public-waste-test-fixtures.js';

type CompletePublicWasteAppTestProps = Extract<ComponentProps<typeof PublicWasteApp>, { selectionState: 'complete' }>;

const renderCompletePublicWasteApp = (overrides: Partial<CompletePublicWasteAppTestProps> = {}) => {
  render(
    <PublicWasteApp
      selection={publicWasteSelectionFixture}
      selectionState="complete"
      selectionSummary={publicWasteSelectionSummaryFixture}
      calendarModel={createPublicWasteCalendarModelFixture()}
      icalUrl="https://example.invalid/calendar.ics"
      onChangeLocation={() => undefined}
      {...overrides}
    />
  );
};

describe('PublicWasteApp', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  it('renders header actions for calendar import and the on-demand pdf export', () => {
    renderCompletePublicWasteApp();

    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' }).getAttribute('href')).toBe(
      'https://example.invalid/calendar.ics'
    );
    expect(screen.getByRole('button', { name: 'Druckversion herunterladen' })).toBeTruthy();
    expect(screen.getByLabelText('PDF-Jahr')).toBeTruthy();
    expectPublicWasteSelectionHeader();
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

    renderCompletePublicWasteApp();

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
    renderCompletePublicWasteApp({
      calendarModel: createPublicWasteCalendarModelFixture({
        listEntries: [
          createPublicWasteCalendarEntryFixture(),
          createPublicWasteCalendarEntryFixture({
            id: 'pickup-2',
            date: '2026-05-20',
            fractionId: 'paper',
            fractionLabel: 'Papier',
            fractionColor: '#0000FF',
          }),
        ],
        fractionOptions: [
          { id: 'bio', label: 'Bioabfall' },
          { id: 'paper', label: 'Papier' },
        ],
      }),
    });

    expect((screen.getByRole('checkbox', { name: 'Bioabfall' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Papier' }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bioabfall' }));

    expectPublicWasteSelectionHeader();
    expect(screen.getByRole('heading', { name: 'Mai 2026' })).toBeTruthy();
    const pickupLists = screen.getAllByRole('list');
    expect(pickupLists.at(-1)?.textContent).not.toContain('Bioabfall');
    expect(pickupLists.at(-1)?.textContent).toContain('Papier');
  });

  it('allows deselecting all fractions so that no pickup entries remain visible', () => {
    renderCompletePublicWasteApp({
      calendarModel: createPublicWasteCalendarModelFixture({
        listEntries: [
          createPublicWasteCalendarEntryFixture(),
          createPublicWasteCalendarEntryFixture({
            id: 'pickup-2',
            date: '2026-05-20',
            fractionId: 'paper',
            fractionLabel: 'Papier',
            fractionColor: '#0000FF',
          }),
        ],
        fractionOptions: [
          { id: 'bio', label: 'Bioabfall' },
          { id: 'paper', label: 'Papier' },
        ],
      }),
    });

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
    renderCompletePublicWasteApp({
      calendarModel: createPublicWasteCalendarModelFixture({
        listEntries: [
          createPublicWasteCalendarEntryFixture({
            tourName: 'Biotour Nord',
            tourDescription: 'Wöchentliche Leerung im Innenstadtbereich.',
            note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
          }),
        ],
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Termin Bioabfall am 2026-05-19' }));

    const dialog = screen.getByRole('dialog');
    expect(screen.getAllByText('Wöchentliche Leerung im Innenstadtbereich.')).toHaveLength(2);
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Biotour Nord')).toBeTruthy();
    expect(within(dialog).getByText('Wöchentliche Leerung im Innenstadtbereich.')).toBeTruthy();
    expect(within(dialog).getByText('Bitte Tonne ab 6 Uhr bereitstellen.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'In Kalender übernehmen' })).toBeTruthy();
  });

  it('offers a reminder setup action and submits the selected fractions, slots, email, and consent', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'pending',
          headline: 'Bestätigungslink versendet',
          message: 'Bitte prüfen Sie Ihr E-Mail-Postfach.',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    );

    renderCompletePublicWasteApp({
      reminderSignup: {
        enabled: true,
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        fractions: [
          {
            id: 'bio',
            label: 'Bioabfall',
            color: '#008800',
            slots: [
              { id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 },
              { id: 'bio:second', maxLeadDays: 5, defaultLeadDays: 3 },
            ],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Erinnerung einrichten' }));
    const reminderRegion = screen.getByRole('region', { name: 'E-Mail-Erinnerung' });
    fireEvent.click(within(reminderRegion).getByRole('checkbox', { name: 'Bioabfall' }));
    fireEvent.change(within(reminderRegion).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.change(within(reminderRegion).getByLabelText('Zeitfenster für Bioabfall'), {
      target: { value: 'bio:second' },
    });
    fireEvent.click(
      within(reminderRegion).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );
    fireEvent.click(within(reminderRegion).getByRole('button', { name: 'Erinnerung anfordern' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/public-waste/reminder-signups',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            selection: publicWasteSelectionFixture,
            email: 'person@example.invalid',
            items: [{ fractionId: 'bio', slotId: 'bio:second' }],
            consentAccepted: true,
          }),
        })
      );
    });

    expect(screen.getByText('Bestätigungslink versendet')).toBeTruthy();
    expect(screen.getByText('Bitte prüfen Sie Ihr E-Mail-Postfach.')).toBeTruthy();
  });
});
