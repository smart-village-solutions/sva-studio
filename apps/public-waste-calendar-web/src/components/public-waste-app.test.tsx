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

type CompletePublicWasteAppTestProps = Extract<
  ComponentProps<typeof PublicWasteApp>,
  { selectionState: 'complete' }
>;

const renderCompletePublicWasteApp = (overrides: Partial<CompletePublicWasteAppTestProps> = {}) => {
  return render(
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

const reminderSignupFixture: NonNullable<CompletePublicWasteAppTestProps['reminderSignup']> = {
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
};

const openEmailPanel = (): HTMLElement => {
  fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Erinnerung' }));
  const panel = document.getElementById('public-waste-action-panel-email');
  if (!panel) {
    throw new Error('Expected the e-mail action panel to exist');
  }
  return panel;
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

  it('delegates the incomplete selection flow including keyboard selection and path editing', () => {
    const onEditSelectionStep = vi.fn();
    const onSelectOption = vi.fn();

    render(
      <PublicWasteApp
        selectionState="incomplete"
        nextStepLabel="Ort"
        selectionOptions={[
          { id: 'city-2', label: 'Ziesar' },
          { id: 'city-1', label: 'Musterstadt' },
        ]}
        selectionPath={[{ step: 'Region', label: 'West' }]}
        onEditSelectionStep={onEditSelectionStep}
        onSelectOption={onSelectOption}
      />
    );

    const search = screen.getByRole('combobox', { name: 'Ort suchen' });
    expect(document.activeElement).toBe(search);
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSelectOption).toHaveBeenCalledWith('city-1');

    fireEvent.click(screen.getByRole('button', { name: 'Region ändern' }));
    expect(onEditSelectionStep).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('group', { name: 'Abfallfraktionen' })).toBeNull();
  });

  it('renders a flat location context and explicit disclosure actions', () => {
    renderCompletePublicWasteApp();

    expectPublicWasteSelectionHeader();
    const changeAddressAction = screen.getByRole('button', { name: 'Adresse ändern' });
    expect(changeAddressAction.parentElement?.classList.contains('selection-summary-row')).toBe(
      true
    );
    expect(changeAddressAction.classList.contains('selection-summary-action')).toBe(true);
    expect(screen.getByRole('group', { name: 'Abfallfraktionen' })).toBeTruthy();
    const bioFraction = screen.getByRole('checkbox', { name: 'Bioabfall' });
    expect(bioFraction.parentElement?.getAttribute('style')).toBeNull();
    expect(bioFraction.getAttribute('style')).toContain('accent-color');
    expect(bioFraction.parentElement?.querySelector('.selection-fraction-swatch')).toBeNull();
    const fractionInfoAction = screen.getByRole('button', {
      name: 'Informationen zu Abfallfraktionen',
    });
    expect(fractionInfoAction.getAttribute('popovertarget')).toBe('public-waste-fraction-info');
    const fractionInfoPopover = document.getElementById('public-waste-fraction-info');
    expect(fractionInfoPopover?.getAttribute('popover')).toBe('auto');
    expect(fractionInfoPopover?.textContent).toContain(
      'Diese Auswahl steuert Liste, Kalenderexport, PDF/Druckversion und E-Mail-Erinnerung gemeinsam.'
    );
    expect(screen.getByRole('checkbox', { name: 'Papier' })).toBeTruthy();
    const calendarAction = screen.getByRole('button', { name: 'Kalender exportieren' });
    expect(calendarAction.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'PDF / Druckversion' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'E-Mail-Erinnerung' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Kalender exportieren' })).toBeNull();
  });

  it('uses a single open action panel at a time', () => {
    renderCompletePublicWasteApp();

    fireEvent.click(screen.getByRole('button', { name: 'Kalender exportieren' }));
    expect(screen.getByRole('link', { name: 'Kalender exportieren' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'PDF / Druckversion' }));
    expect(screen.queryByRole('link', { name: 'Kalender exportieren' })).toBeNull();
    expect(screen.getByRole('button', { name: 'PDF herunterladen' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'PDF / Druckversion' }));
    expect(screen.queryByRole('button', { name: 'PDF herunterladen' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'PDF / Druckversion' }).getAttribute('aria-expanded')
    ).toBe('false');
  });

  it('links an expanded action to its accessible region', () => {
    renderCompletePublicWasteApp();

    const pdfAction = screen.getByRole('button', { name: 'PDF / Druckversion' });
    fireEvent.click(pdfAction);

    expect(pdfAction.getAttribute('aria-expanded')).toBe('true');
    const panel = screen
      .getAllByRole('region')
      .find((element) => element.getAttribute('id') === pdfAction.getAttribute('aria-controls'));
    expect(panel).toBeTruthy();
    if (!panel) {
      throw new Error('Expected the PDF action panel to exist');
    }
    expect(panel.getAttribute('aria-labelledby')).toBe(pdfAction.getAttribute('id'));
  });

  it('updates the visible calendar entries from the right-side fraction list', () => {
    renderCompletePublicWasteApp();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bioabfall' }));

    const pickupLists = screen.getAllByRole('list');
    expect(pickupLists.at(-1)?.textContent).not.toContain('Bioabfall');
    expect(pickupLists.at(-1)?.textContent).toContain('Papier');
  });

  it('resets action and reminder form state when the resolved location changes', () => {
    const { rerender } = renderCompletePublicWasteApp({ reminderSignup: reminderSignupFixture });
    const emailPanel = openEmailPanel();
    fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(
      within(emailPanel).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );

    rerender(
      <PublicWasteApp
        selection={publicWasteSelectionFixture}
        selectionState="complete"
        selectionSummary="Neustadt, Nebenstraße 4"
        calendarModel={createPublicWasteCalendarModelFixture({ locationKey: 'new-location' })}
        icalUrl="https://example.invalid/calendar.ics"
        reminderSignup={reminderSignupFixture}
        onChangeLocation={() => undefined}
      />
    );

    expect(document.getElementById('public-waste-action-panel-email')).toBeNull();
    const resetPanel = openEmailPanel();
    expect((within(resetPanel).getByLabelText('E-Mail-Adresse') as HTMLInputElement).value).toBe(
      ''
    );
    expect(
      (
        within(resetPanel).getByRole('checkbox', {
          name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
        }) as HTMLInputElement
      ).checked
    ).toBe(false);
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

    fireEvent.click(screen.getByRole('button', { name: 'Kalender exportieren' }));

    const exportLink = screen.getByRole('link', { name: 'Kalender exportieren' });
    expect(exportLink.getAttribute('href')).toContain('fractionId=bio');
    expect(exportLink.getAttribute('href')).toContain('fractionId=paper');
    expect(exportLink.getAttribute('href')).toContain('reminderItem=bio%7Cbio%3Acalendar%3Afirst');
    expect(exportLink.getAttribute('href')).toContain(
      'reminderItem=paper%7Cpaper%3Acalendar%3Afirst'
    );
    expect(screen.queryByRole('checkbox', { name: 'Mit Erinnerungen exportieren' })).toBeNull();
  });

  it('exports without reminders when active fractions only have partial calendar support', () => {
    renderCompletePublicWasteApp({
      calendarReminderOptions: {
        fractions: [
          {
            id: 'bio',
            label: 'Bioabfall',
            slots: [{ id: 'bio:calendar:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Kalender exportieren' }));

    const exportLink = screen.getByRole('link', { name: 'Kalender exportieren' });
    expect(exportLink.getAttribute('href')).not.toContain('reminderItem=');
    expect(
      screen.getByText(/nicht für alle Fraktionen Kalender-Erinnerungen verfügbar/u)
    ).toBeTruthy();
  });

  it('downloads a pdf for the active fractions and selected year from the action panel', async () => {
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:public-waste-pdf');
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

    fireEvent.click(screen.getByRole('button', { name: 'PDF / Druckversion' }));
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

  it('shows the running state and reports a failed pdf request in the same panel', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectRequest = reject;
        })
    );
    renderCompletePublicWasteApp();
    fireEvent.click(screen.getByRole('button', { name: 'PDF / Druckversion' }));

    fireEvent.click(screen.getByRole('button', { name: 'PDF herunterladen' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PDF wird erstellt…' })).toBeTruthy();
    });
    expect(
      screen.getByRole('button', { name: 'PDF wird erstellt…' }).hasAttribute('disabled')
    ).toBe(true);

    await act(async () => {
      rejectRequest?.(new Error('PDF-Dienst nicht erreichbar'));
    });

    expect(screen.getByRole('alert').textContent).toContain('PDF-Dienst nicht erreichbar');
    expect(screen.getByRole('button', { name: 'PDF herunterladen' }).hasAttribute('disabled')).toBe(
      false
    );
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

    fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Erinnerung' }));
    const emailPanel = screen
      .getAllByRole('region')
      .find(
        (element) => element.getAttribute('id') === 'public-waste-action-panel-email'
      ) as HTMLElement;
    fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(
      within(emailPanel).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );

    fireEvent.click(
      within(emailPanel).getByRole('button', { name: 'E-Mail-Erinnerung anfordern' })
    );

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

    expect(await screen.findByText('Bestätigungslink versendet')).toBeTruthy();
    expect(await screen.findByText('Bitte prüfen Sie Ihr E-Mail-Postfach.')).toBeTruthy();
    expect(within(emailPanel).getByRole('status').textContent).toContain(
      'Bestätigungslink versendet'
    );
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

    fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Erinnerung' }));
    const emailPanel = screen
      .getAllByRole('region')
      .find(
        (element) => element.getAttribute('id') === 'public-waste-action-panel-email'
      ) as HTMLElement;
    fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(
      within(emailPanel).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );
    fireEvent.click(
      within(emailPanel).getByRole('button', { name: 'E-Mail-Erinnerung anfordern' })
    );

    await screen.findByText('Bestätigungslink versendet');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Papier' }));

    expect(screen.queryByText('Bestätigungslink versendet')).toBeNull();
    const refreshedEmailPanel = screen
      .getAllByRole('region')
      .find((element) => element.getAttribute('id') === 'public-waste-action-panel-email');
    expect(refreshedEmailPanel).toBeTruthy();
    expect(
      within(refreshedEmailPanel as HTMLElement).getByLabelText('E-Mail-Adresse')
    ).toBeTruthy();
    expect(
      (
        within(refreshedEmailPanel as HTMLElement).getByLabelText(
          'E-Mail-Adresse'
        ) as HTMLInputElement
      ).value
    ).toBe('person@example.invalid');
    expect(
      (
        within(refreshedEmailPanel as HTMLElement).getByRole('checkbox', {
          name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'E-Mail-Erinnerung' }).getAttribute('aria-expanded')
    ).toBe('true');
  });

  it.each([
    { label: 'missing e-mail', email: '', consent: true, removeFractions: false },
    {
      label: 'missing consent',
      email: 'person@example.invalid',
      consent: false,
      removeFractions: false,
    },
    {
      label: 'missing fractions',
      email: 'person@example.invalid',
      consent: true,
      removeFractions: true,
    },
  ])('keeps reminder submission disabled for $label', ({ email, consent, removeFractions }) => {
    renderCompletePublicWasteApp({ reminderSignup: reminderSignupFixture });
    if (removeFractions) {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Bioabfall' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Papier' }));
    }
    const emailPanel = openEmailPanel();
    if (email && !removeFractions) {
      fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
        target: { value: email },
      });
    }
    if (consent && !removeFractions) {
      fireEvent.click(
        within(emailPanel).getByRole('checkbox', {
          name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
        })
      );
    }

    expect(
      within(emailPanel)
        .getByRole('button', { name: 'E-Mail-Erinnerung anfordern' })
        .hasAttribute('disabled')
    ).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the reminder service fail-closed when no signup configuration exists', () => {
    renderCompletePublicWasteApp();
    const emailPanel = openEmailPanel();

    expect(within(emailPanel).getByText(/Passen Sie die Fraktionsauswahl an/u)).toBeTruthy();
    expect(
      within(emailPanel)
        .getByRole('button', { name: 'E-Mail-Erinnerung anfordern' })
        .hasAttribute('disabled')
    ).toBe(true);
    expect(within(emailPanel).queryByLabelText('E-Mail-Adresse')).toBeNull();
  });

  it('shows reminder request errors as an assertive live-region message', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Anfrage abgelehnt' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      })
    );
    renderCompletePublicWasteApp({ reminderSignup: reminderSignupFixture });
    const emailPanel = openEmailPanel();
    fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(
      within(emailPanel).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );
    fireEvent.click(
      within(emailPanel).getByRole('button', { name: 'E-Mail-Erinnerung anfordern' })
    );

    const error = await within(emailPanel).findByRole('alert');
    expect(error.textContent).toContain('Anfrage abgelehnt');
    expect(error.getAttribute('id')).toBe('public-waste-reminder-error');
    expect(
      within(emailPanel).getByLabelText('E-Mail-Adresse').getAttribute('aria-describedby')
    ).toBe('public-waste-reminder-error');
  });

  it('prevents a duplicate reminder request while the first submission is pending', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        })
    );
    renderCompletePublicWasteApp({ reminderSignup: reminderSignupFixture });
    const emailPanel = openEmailPanel();
    fireEvent.change(within(emailPanel).getByLabelText('E-Mail-Adresse'), {
      target: { value: 'person@example.invalid' },
    });
    fireEvent.click(
      within(emailPanel).getByRole('checkbox', {
        name: 'Ich stimme der Verarbeitung meiner Daten zu. Datenschutzerklärung',
      })
    );
    const submit = within(emailPanel).getByRole('button', {
      name: 'E-Mail-Erinnerung anfordern',
    });

    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(within(emailPanel).getByRole('button', { name: 'Wird angefordert…' })).toBeTruthy();

    await act(async () => {
      resolveRequest?.(
        new Response(
          JSON.stringify({
            status: 'pending',
            headline: 'Bestätigungslink versendet',
            message: 'Bitte prüfen Sie Ihr E-Mail-Postfach.',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    expect(within(emailPanel).getByRole('status').getAttribute('aria-live')).toBe('polite');
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

    fireEvent.click(screen.getByRole('button', { name: 'E-Mail-Erinnerung' }));
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' }).getAttribute('rel')).toBe(
      'noopener noreferrer'
    );
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
    expect(screen.getByRole('button', { name: 'Kalender exportieren' })).toBeTruthy();
  });
});
