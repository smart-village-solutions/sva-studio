import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      calendarModel={createPublicWasteCalendarModelFixture({
        fractionOptions: [
          { id: 'bio', label: 'Bioabfall', color: '#00AA00' },
          { id: 'paper', label: 'Papier', color: '#0000FF' },
        ],
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
      })}
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

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders address left, fractions right, and a horizontal action block', () => {
    renderCompletePublicWasteApp();

    expectPublicWasteSelectionHeader();
    expect(screen.getByRole('button', { name: 'Adresse ändern' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Abfallfraktionen' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bioabfall' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Papier' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Kalenderexport' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'PDF-Download' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'E-Mail-Abo' })).toBeTruthy();
  });

  it('uses a single open action panel at a time', () => {
    renderCompletePublicWasteApp();

    fireEvent.click(screen.getByRole('tab', { name: 'Kalenderexport' }));
    expect(screen.getByText('Kalender exportieren')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'PDF-Download' }));
    expect(screen.queryByText('Kalender exportieren')).toBeNull();
    expect(screen.getByRole('button', { name: 'PDF herunterladen' })).toBeTruthy();
  });

  it('supports keyboard navigation across the action tabs and links the active panel accessibly', () => {
    renderCompletePublicWasteApp();

    const calendarTab = screen.getByRole('tab', { name: 'Kalenderexport' });
    fireEvent.keyDown(calendarTab, { key: 'ArrowRight' });

    const pdfTab = screen.getByRole('tab', { name: 'PDF-Download' });
    expect(pdfTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(pdfTab);

    const panel = screen
      .getAllByRole('tabpanel')
      .find((element) => element.getAttribute('id') === pdfTab.getAttribute('aria-controls'));
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('aria-labelledby')).toBe(pdfTab.getAttribute('id'));
  });

  it('updates the visible calendar entries from the right-side fraction list', () => {
    renderCompletePublicWasteApp();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bioabfall' }));

    const pickupLists = screen.getAllByRole('list');
    expect(pickupLists.at(-1)?.textContent).not.toContain('Bioabfall');
    expect(pickupLists.at(-1)?.textContent).toContain('Papier');
  });

  it('builds a reminder-enabled calendar export from the active fractions', () => {
    renderCompletePublicWasteApp({
      calendarReminderOptions: {
        fractions: [
          {
            id: 'bio',
            label: 'Bioabfall',
            slots: [{ id: 'bio:calendar:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
          {
            id: 'paper',
            label: 'Papier',
            slots: [{ id: 'paper:calendar:first', maxLeadDays: 4, defaultLeadDays: 2 }],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Kalenderexport' }));

    const exportLink = screen.getByRole('link', { name: 'Kalender exportieren' });
    expect(exportLink.getAttribute('href')).toContain('fractionId=bio');
    expect(exportLink.getAttribute('href')).toContain('fractionId=paper');
    expect(exportLink.getAttribute('href')).toContain('reminderItem=bio%7Cbio%3Acalendar%3Afirst');
    expect(exportLink.getAttribute('href')).toContain('reminderItem=paper%7Cpaper%3Acalendar%3Afirst');
    expect(screen.queryByRole('checkbox', { name: 'Mit Erinnerungen exportieren' })).toBeNull();
  });

  it('downloads a pdf for the active fractions and selected year from the action panel', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:public-waste-pdf');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(
      new Response(new Blob(['pdf'], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="abfallkalender-2026-rathenow.pdf"',
        },
      })
    );

    renderCompletePublicWasteApp();

    fireEvent.click(screen.getByRole('tab', { name: 'PDF-Download' }));
    fireEvent.change(screen.getByLabelText('PDF-Jahr'), {
      target: { value: '2026' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PDF herunterladen' }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('fractionId=bio');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('fractionId=paper');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('year=2026');
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:public-waste-pdf');

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('submits the e-mail signup from the active fractions with automatic default reminder slots', async () => {
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
          {
            id: 'paper',
            label: 'Papier',
            color: '#0000FF',
            slots: [{ id: 'paper:first', maxLeadDays: 4, defaultLeadDays: 2 }],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('tab', { name: 'E-Mail-Abo' }));
    const emailPanel = screen.getAllByRole('tabpanel')[0] as HTMLElement;
    fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(
      within(emailPanel).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );

    fireEvent.click(within(emailPanel).getByRole('button', { name: 'E-Mail-Abo anfordern' }));

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
            items: [
              { fractionId: 'bio', slotId: 'bio:first' },
              { fractionId: 'paper', slotId: 'paper:first' },
            ],
            consentAccepted: true,
          }),
        })
      );
    });

    expect(screen.getByText('Bestätigungslink versendet')).toBeTruthy();
    expect(screen.getByText('Bitte prüfen Sie Ihr E-Mail-Postfach.')).toBeTruthy();
    expect(within(emailPanel).queryByLabelText('Zeitfenster für Bioabfall')).toBeNull();
  });

  it('clears a previous e-mail signup success when the active fractions change', async () => {
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
            slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
          {
            id: 'paper',
            label: 'Papier',
            color: '#0000FF',
            slots: [{ id: 'paper:first', maxLeadDays: 4, defaultLeadDays: 2 }],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('tab', { name: 'E-Mail-Abo' }));
    const emailPanel = screen
      .getAllByRole('tabpanel')
      .find((element) => element.getAttribute('id') === 'public-waste-action-panel-email') as HTMLElement;
    fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(
      within(emailPanel).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );
    fireEvent.click(within(emailPanel).getByRole('button', { name: 'E-Mail-Abo anfordern' }));

    await screen.findByText('Bestätigungslink versendet');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Papier' }));

    expect(screen.queryByText('Bestätigungslink versendet')).toBeNull();
    const refreshedEmailPanel = screen
      .getAllByRole('tabpanel')
      .find((element) => element.getAttribute('id') === 'public-waste-action-panel-email');
    expect(refreshedEmailPanel).toBeTruthy();
    expect(within(refreshedEmailPanel as HTMLElement).getByLabelText('E-Mail-Adresse')).toBeTruthy();
  });

  it('uses noopener noreferrer for the privacy policy link', () => {
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
            slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
          {
            id: 'paper',
            label: 'Papier',
            color: '#0000FF',
            slots: [{ id: 'paper:first', maxLeadDays: 4, defaultLeadDays: 2 }],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('tab', { name: 'E-Mail-Abo' }));
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' }).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('opens a pickup detail dialog and keeps the global actions outside the dialog', () => {
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
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Biotour Nord')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Kalenderexport' })).toBeTruthy();
  });
});
