import { IconCalendarPlus, IconFileTypePdf, IconMail } from '@tabler/icons-react';
import React from 'react';

import {
  buildPublicWasteIcalUrl,
  requestPublicWasteReminderSignup,
  type PublicWasteCalendarResponse,
} from '../lib/public-waste-api.js';
import type {
  PublicWasteCalendarEntry,
  PublicWasteReminderFractionOption,
  PublicWasteReminderSelectionItem,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
} from '../lib/public-waste-contract.js';
import {
  filterPublicWasteCalendarFractions,
  type PublicWasteCalendarViewModel,
} from '../lib/public-waste-view-model.js';
import { PublicWasteCalendarPanels } from './public-waste-calendar-panels.js';
import { PublicWasteEventDialog } from './public-waste-event-dialog.js';
import { PublicWasteSelectionHeader } from './public-waste-selection-header.js';
import { PublicWasteSelectionForm, type PublicWasteSelectionPathItem } from './public-waste-selection-form.js';
import { usePublicWastePdfDownload } from './use-public-waste-pdf-download.js';

type IncompletePublicWasteAppProps = {
  readonly selectionState: 'incomplete';
  readonly nextStepLabel: string;
  readonly selectionOptions: readonly PublicWasteSelectableEntry[];
  readonly selectionPath: readonly PublicWasteSelectionPathItem[];
  readonly onEditSelectionStep: (stepIndex: number) => void;
  readonly onSelectOption: (optionId: string) => void;
};

type CompletePublicWasteAppProps = {
  readonly selection: PublicWasteResolvedSelection;
  readonly selectionState: 'complete';
  readonly selectionSummary: string;
  readonly calendarModel: PublicWasteCalendarViewModel;
  readonly icalUrl: string;
  readonly calendarReminderOptions?: PublicWasteCalendarResponse['calendarReminderOptions'];
  readonly reminderSignup?: PublicWasteCalendarResponse['reminderSignup'];
  readonly onChangeLocation: () => void;
};

type PublicWasteAppProps = IncompletePublicWasteAppProps | CompletePublicWasteAppProps;

type ActionPanel = 'calendar' | 'pdf' | 'email';
type ReminderSelectionState = Record<string, string>;
const EMPTY_REMINDER_FRACTIONS: readonly PublicWasteReminderFractionOption[] = [];

const splitSelectionSummary = (
  selectionSummary: string
): readonly [cityLine: string, streetLine: string, houseNumberLine?: string] => {
  const [cityPart = '', remainderPart = ''] = selectionSummary.split(',').map((part) => part.trim());
  const remainder = remainderPart.trim();

  if (remainder.length === 0) {
    return [cityPart, ''];
  }

  if (remainder.endsWith('Alle Hausnummern')) {
    const streetLine = remainder.slice(0, Math.max(0, remainder.length - 'Alle Hausnummern'.length)).trim();
    return [cityPart, streetLine, 'Alle Hausnummern'];
  }

  const houseNumberMatch = remainder.match(/^(.*)\s+([0-9]+[A-Za-z]?([/-][0-9]+[A-Za-z]?)?)$/u);
  if (!houseNumberMatch) {
    return [cityPart, remainder];
  }

  const streetLine = houseNumberMatch[1]?.trim() ?? remainder;
  const houseNumberLine = houseNumberMatch[2]?.trim();
  return [cityPart, streetLine, houseNumberLine];
};

const buildReminderSlotSelection = (
  activeFractionIds: readonly string[],
  fractions: readonly PublicWasteReminderFractionOption[],
  previous: ReminderSelectionState
): ReminderSelectionState => {
  const activeFractionSet = new Set(activeFractionIds);
  const next: ReminderSelectionState = {};

  for (const fraction of fractions) {
    if (!activeFractionSet.has(fraction.id) || fraction.slots.length === 0) {
      continue;
    }

    const previousSlotId = previous[fraction.id];
    next[fraction.id] = fraction.slots.some((slot) => slot.id === previousSlotId) ? previousSlotId : fraction.slots[0]!.id;
  }

  return next;
};

const areReminderSelectionsEqual = (left: ReminderSelectionState, right: ReminderSelectionState): boolean => {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([fractionId, slotId]) => right[fractionId] === slotId);
};

const resolveReminderContext = (
  activeFractionIds: readonly string[],
  fractionOptions: readonly { readonly id: string; readonly label: string }[],
  reminderFractions: readonly PublicWasteReminderFractionOption[]
) => {
  const reminderFractionMap = new Map(reminderFractions.map((fraction) => [fraction.id, fraction]));
  const fractionLabelMap = new Map(fractionOptions.map((fraction) => [fraction.id, fraction.label]));
  const supportedFractions = activeFractionIds
    .map((fractionId) => reminderFractionMap.get(fractionId))
    .filter((fraction): fraction is PublicWasteReminderFractionOption => fraction !== undefined);
  const unsupportedLabels = activeFractionIds
    .filter((fractionId) => !reminderFractionMap.has(fractionId))
    .map((fractionId) => fractionLabelMap.get(fractionId) ?? fractionId);

  return {
    supportedFractions,
    unsupportedLabels,
    isFullySupported: activeFractionIds.length > 0 && unsupportedLabels.length === 0 && supportedFractions.length > 0,
  };
};

const buildReminderItems = (
  fractions: readonly PublicWasteReminderFractionOption[],
  selectedSlots: ReminderSelectionState
): readonly PublicWasteReminderSelectionItem[] =>
  fractions
    .map((fraction) => {
      const slotId = selectedSlots[fraction.id];
      return slotId
        ? {
            fractionId: fraction.id,
            slotId,
          }
        : null;
    })
    .filter((item): item is PublicWasteReminderSelectionItem => item !== null);

const hasCompleteReminderItems = (
  context: Readonly<{
    isFullySupported: boolean;
    supportedFractions: readonly PublicWasteReminderFractionOption[];
  }>,
  items: readonly PublicWasteReminderSelectionItem[]
): boolean => context.isFullySupported && items.length === context.supportedFractions.length;

export function PublicWasteApp(props: Readonly<PublicWasteAppProps>) {
  if (props.selectionState === 'incomplete') {
    return (
      <PublicWasteSelectionForm
        nextStepLabel={props.nextStepLabel}
        options={props.selectionOptions}
        selectionPath={props.selectionPath}
        onEditStep={props.onEditSelectionStep}
        onSelectOption={props.onSelectOption}
      />
    );
  }

  return <CompletePublicWasteApp {...props} />;
}

function CompletePublicWasteApp(props: Readonly<CompletePublicWasteAppProps>) {
  const [selectedEntry, setSelectedEntry] = React.useState<PublicWasteCalendarEntry | null>(null);
  const [activeActionPanel, setActiveActionPanel] = React.useState<ActionPanel | null>(null);
  const [email, setEmail] = React.useState('');
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const [reminderError, setReminderError] = React.useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = React.useState<null | { readonly headline: string; readonly message: string }>(
    null
  );
  const [reminderSubmitting, setReminderSubmitting] = React.useState(false);
  const [calendarReminderSlots, setCalendarReminderSlots] = React.useState<ReminderSelectionState>({});
  const [emailReminderSlots, setEmailReminderSlots] = React.useState<ReminderSelectionState>({});
  const {
    selectedFractions,
    pdfYear,
    pdfRunning,
    pdfError,
    yearOptions,
    setPdfYear,
    toggleFraction,
    downloadPdf,
  } = usePublicWastePdfDownload({
    selection: props.selection,
    calendarModel: props.calendarModel,
  });
  const deferredFractions = React.useDeferredValue(selectedFractions);
  const filteredModel = filterPublicWasteCalendarFractions(props.calendarModel, deferredFractions);
  const [cityLine, streetLine, houseNumberLine] = splitSelectionSummary(props.selectionSummary);
  const emailReminderFractions = props.reminderSignup?.fractions ?? EMPTY_REMINDER_FRACTIONS;
  const calendarReminderFractions = props.calendarReminderOptions?.fractions ?? EMPTY_REMINDER_FRACTIONS;
  const emailReminderContext = React.useMemo(
    () => resolveReminderContext(selectedFractions, props.calendarModel.fractionOptions, emailReminderFractions),
    [emailReminderFractions, props.calendarModel.fractionOptions, selectedFractions]
  );
  const calendarReminderContext = React.useMemo(
    () => resolveReminderContext(selectedFractions, props.calendarModel.fractionOptions, calendarReminderFractions),
    [calendarReminderFractions, props.calendarModel.fractionOptions, selectedFractions]
  );

  React.useEffect(() => {
    setCalendarReminderSlots((current) =>
      {
        const next = buildReminderSlotSelection(selectedFractions, calendarReminderContext.supportedFractions, current);
        return areReminderSelectionsEqual(current, next) ? current : next;
      }
    );
  }, [calendarReminderContext.supportedFractions, selectedFractions]);

  React.useEffect(() => {
    setEmailReminderSlots((current) =>
      {
        const next = buildReminderSlotSelection(selectedFractions, emailReminderContext.supportedFractions, current);
        return areReminderSelectionsEqual(current, next) ? current : next;
      }
    );
  }, [emailReminderContext.supportedFractions, selectedFractions]);

  React.useEffect(() => {
    setActiveActionPanel(null);
    setReminderError(null);
    setReminderSuccess(null);
    setConsentAccepted(false);
    setEmail('');
  }, [props.calendarModel.locationKey]);

  const toggleActionPanel = (panel: ActionPanel) => {
    setActiveActionPanel((current) => (current === panel ? null : panel));
    setReminderError(null);
  };

  const calendarReminderItems = React.useMemo(
    () => buildReminderItems(calendarReminderContext.supportedFractions, calendarReminderSlots),
    [calendarReminderContext.supportedFractions, calendarReminderSlots]
  );
  const emailReminderItems = React.useMemo(
    () => buildReminderItems(emailReminderContext.supportedFractions, emailReminderSlots),
    [emailReminderContext.supportedFractions, emailReminderSlots]
  );
  const canUseCalendarReminderExport = hasCompleteReminderItems(calendarReminderContext, calendarReminderItems);
  const canSubmitEmailReminderSelection = hasCompleteReminderItems(emailReminderContext, emailReminderItems);
  const calendarExportUrl = buildPublicWasteIcalUrl({
    selection: props.selection,
    calendarName: props.selectionSummary,
    fractionIds: selectedFractions,
    reminderItems: canUseCalendarReminderExport ? calendarReminderItems : [],
  });
  const canSubmitEmailReminder =
    canSubmitEmailReminderSelection &&
    consentAccepted &&
    email.trim().length > 0 &&
    !reminderSubmitting;

  const submitReminderSignup = async () => {
    if (!props.reminderSignup?.enabled) {
      setReminderError('Der E-Mail-Erinnerungsdienst ist derzeit nicht verfügbar.');
      return;
    }
    if (!canSubmitEmailReminderSelection || !consentAccepted || email.trim().length === 0) {
      setReminderError('Bitte wählen Sie gültige Fraktionen, eine E-Mail-Adresse und die Datenschutz-Einwilligung aus.');
      return;
    }

    setReminderSubmitting(true);
    setReminderError(null);

    try {
      const response = await requestPublicWasteReminderSignup({
        selection: props.selection,
        email: email.trim(),
        items: emailReminderItems,
        consentAccepted: true,
      });
      setReminderSuccess({
        headline: response.headline,
        message: response.message,
      });
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Die Erinnerung konnte nicht angefordert werden.');
    } finally {
      setReminderSubmitting(false);
    }
  };

  const actionPanelDescription =
    selectedFractions.length === 0
      ? 'Wählen Sie rechts mindestens eine Fraktion aus, um diese Aktion zu nutzen.'
      : `Aktiv ausgewählt: ${selectedFractions.length} Fraktion${selectedFractions.length === 1 ? '' : 'en'}.`;

  return (
    <section className="selection-panel">
      <PublicWasteSelectionHeader
        cityLine={cityLine}
        streetLine={streetLine}
        houseNumberLine={houseNumberLine}
        fractionOptions={props.calendarModel.fractionOptions}
        activeFractionIds={selectedFractions}
        onChangeLocation={props.onChangeLocation}
        onToggleFraction={toggleFraction}
      />

      <section className="action-hub" aria-label="Kalenderaktionen">
        <div className="action-hub-toolbar" role="tablist" aria-label="Export- und Abo-Aktionen">
          <button
            type="button"
            role="tab"
            aria-selected={activeActionPanel === 'calendar'}
            className={`action-hub-trigger${activeActionPanel === 'calendar' ? ' is-active' : ''}`}
            onClick={() => toggleActionPanel('calendar')}
          >
            <IconCalendarPlus size={20} stroke={1.8} aria-hidden="true" />
            <span>Kalenderexport</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeActionPanel === 'pdf'}
            className={`action-hub-trigger${activeActionPanel === 'pdf' ? ' is-active' : ''}`}
            onClick={() => toggleActionPanel('pdf')}
          >
            <IconFileTypePdf size={20} stroke={1.8} aria-hidden="true" />
            <span>PDF-Download</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeActionPanel === 'email'}
            className={`action-hub-trigger${activeActionPanel === 'email' ? ' is-active' : ''}`}
            onClick={() => toggleActionPanel('email')}
          >
            <IconMail size={20} stroke={1.8} aria-hidden="true" />
            <span>E-Mail-Abo</span>
          </button>
        </div>

        {activeActionPanel ? (
          <div className="action-panel" role="tabpanel">
            <p className="action-panel-intro">{actionPanelDescription}</p>

            {activeActionPanel === 'calendar' ? (
              <div className="action-panel-body">
                {canUseCalendarReminderExport ? (
                  <p className="action-panel-copy">
                    Der Export übernimmt automatisch die Standard-Erinnerungen der aktiven Fraktionen.
                  </p>
                ) : (
                  <p className="action-panel-copy">
                    Der Export enthält die aktiven Abholtermine ohne zusätzliche Erinnerungen.
                  </p>
                )}
                {!calendarReminderContext.isFullySupported && calendarReminderContext.supportedFractions.length > 0 ? (
                  <p className="action-warning">
                    Für die aktuelle Fraktionsauswahl sind nicht für alle Fraktionen Kalender-Erinnerungen verfügbar. Der Export wird deshalb ohne Erinnerungen erstellt.
                  </p>
                ) : null}
                <a
                  href={selectedFractions.length > 0 ? calendarExportUrl : undefined}
                  className={`action-cta-link${selectedFractions.length === 0 ? ' is-disabled' : ''}`}
                  aria-disabled={selectedFractions.length === 0}
                  onClick={(event) => {
                    if (selectedFractions.length === 0) {
                      event.preventDefault();
                    }
                  }}
                >
                  Kalender exportieren
                </a>
              </div>
            ) : null}

            {activeActionPanel === 'pdf' ? (
              <div className="action-panel-body">
                <label className="action-field">
                  <span>Jahr</span>
                  <select aria-label="PDF-Jahr" value={pdfYear} onChange={(event) => setPdfYear(Number.parseInt(event.target.value, 10))}>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                {pdfError ? <p className="action-warning">{pdfError}</p> : null}
                <button
                  type="button"
                  className="action-cta-button"
                  disabled={selectedFractions.length === 0 || pdfRunning}
                  onClick={() => {
                    void downloadPdf();
                  }}
                >
                  {pdfRunning ? 'PDF wird erstellt…' : 'PDF herunterladen'}
                </button>
              </div>
            ) : null}

            {activeActionPanel === 'email' ? (
              <div className="action-panel-body">
                {reminderSuccess ? (
                  <div className="reminder-feedback reminder-feedback-success">
                    <strong>{reminderSuccess.headline}</strong>
                    <p className="body-copy">{reminderSuccess.message}</p>
                  </div>
                ) : (
                  <>
                    {emailReminderContext.isFullySupported ? (
                      <>
                        <p className="action-panel-copy">
                          Das Abo verwendet automatisch die Standard-Erinnerungen der aktiven Fraktionen.
                        </p>
                        <label className="action-field">
                          <span>E-Mail-Adresse</span>
                          <input
                            aria-label="E-Mail-Adresse"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                          />
                        </label>
                        <label className="reminder-consent">
                          <input
                            type="checkbox"
                            checked={consentAccepted}
                            onChange={(event) => setConsentAccepted(event.target.checked)}
                          />
                          <span>{props.reminderSignup?.consentLabel ?? 'Ich stimme der Verarbeitung meiner Daten zu.'}</span>
                          {props.reminderSignup?.privacyPolicyUrl ? (
                            <a href={props.reminderSignup.privacyPolicyUrl} target="_blank" rel="noreferrer">
                              Datenschutzerklärung
                            </a>
                          ) : null}
                        </label>
                      </>
                    ) : (
                      <p className="action-warning">
                        Für die aktuelle Fraktionsauswahl sind nicht für alle Fraktionen E-Mail-Erinnerungen verfügbar. Passen Sie die Fraktionsliste rechts an, um das Abo zu aktivieren.
                      </p>
                    )}
                    {reminderError ? <p className="action-warning">{reminderError}</p> : null}
                    <button
                      type="button"
                      className="action-cta-button"
                      disabled={!canSubmitEmailReminder}
                      onClick={() => {
                        void submitReminderSignup();
                      }}
                    >
                      {reminderSubmitting ? 'Wird angefordert…' : 'E-Mail-Abo anfordern'}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <PublicWasteCalendarPanels
        model={filteredModel}
        onActivateEntry={setSelectedEntry}
      />
      <PublicWasteEventDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </section>
  );
}
