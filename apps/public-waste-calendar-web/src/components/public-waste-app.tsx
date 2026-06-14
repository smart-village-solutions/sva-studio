import React from 'react';

import type {
  PublicWasteCalendarEntry,
  PublicWasteReminderSignupView,
  PublicWasteResolvedSelection,
  PublicWasteSelectableEntry,
} from '../lib/public-waste-contract.js';
import { requestPublicWasteReminderSignup } from '../lib/public-waste-api.js';
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
  readonly reminderSignup?: PublicWasteReminderSignupView;
  readonly onChangeLocation: () => void;
};

type PublicWasteAppProps = IncompletePublicWasteAppProps | CompletePublicWasteAppProps;

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
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const [selectedItems, setSelectedItems] = React.useState<Record<string, string>>({});
  const [reminderError, setReminderError] = React.useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = React.useState<null | { readonly headline: string; readonly message: string }>(
    null
  );
  const [reminderSubmitting, setReminderSubmitting] = React.useState(false);
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
  const reminderFractions = props.reminderSignup?.fractions ?? [];

  const toggleReminderFraction = (fractionId: string, checked: boolean) => {
    setSelectedItems((current) => {
      if (checked) {
        const fraction = reminderFractions.find((entry) => entry.id === fractionId);
        return {
          ...current,
          [fractionId]: fraction?.slots[0]?.id ?? '',
        };
      }

      const next = { ...current };
      delete next[fractionId];
      return next;
    });
  };

  const submitReminderSignup = async () => {
    const items = Object.entries(selectedItems)
      .filter(([, slotId]) => slotId.length > 0)
      .map(([fractionId, slotId]) => ({ fractionId, slotId }));
    if (!props.reminderSignup || items.length === 0 || !consentAccepted || email.trim().length === 0) {
      setReminderError('Bitte wählen Sie mindestens eine Abfallart, eine E-Mail-Adresse und die Datenschutz-Einwilligung aus.');
      return;
    }

    setReminderSubmitting(true);
    setReminderError(null);

    try {
      const response = await requestPublicWasteReminderSignup({
        selection: props.selection,
        email: email.trim(),
        items,
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

  return (
    <section className="selection-panel">
      <PublicWasteSelectionHeader
        cityLine={cityLine}
        streetLine={streetLine}
        houseNumberLine={houseNumberLine}
        icalUrl={props.icalUrl}
        pdfYear={pdfYear}
        pdfRunning={pdfRunning}
        selectedFractionCount={selectedFractions.length}
        yearOptions={yearOptions}
        onChangeLocation={props.onChangeLocation}
        onSelectPdfYear={setPdfYear}
        onDownloadPdf={() => {
          void downloadPdf();
        }}
      />
      {props.reminderSignup?.enabled ? (
        <section className="reminder-panel" aria-label="E-Mail-Erinnerung">
          <div className="reminder-panel-header">
            <div>
              <h3 className="section-title">E-Mail-Erinnerung</h3>
              <p className="selection-step-copy">Lassen Sie sich für diesen Standort per E-Mail an anstehende Entsorgungstermine erinnern.</p>
            </div>
            <button type="button" className="selection-trigger reminder-trigger" onClick={() => setReminderOpen((current) => !current)}>
              {reminderOpen ? 'Formular schließen' : 'E-Mail-Erinnerung einrichten'}
            </button>
          </div>
          {reminderOpen ? (
            reminderSuccess ? (
              <div className="reminder-feedback reminder-feedback-success">
                <strong>{reminderSuccess.headline}</strong>
                <p className="body-copy">{reminderSuccess.message}</p>
              </div>
            ) : (
              <div className="reminder-form-shell">
                <div className="reminder-fraction-list">
                  {reminderFractions.map((fraction) => (
                    <div key={fraction.id} className="reminder-fraction-card">
                      <label className="reminder-fraction-checkbox">
                        <input
                          type="checkbox"
                          checked={Object.prototype.hasOwnProperty.call(selectedItems, fraction.id)}
                          onChange={(event) => toggleReminderFraction(fraction.id, event.target.checked)}
                        />
                        <span>{fraction.label}</span>
                      </label>
                      {Object.prototype.hasOwnProperty.call(selectedItems, fraction.id) ? (
                        <label className="reminder-field">
                          <span>Zeitfenster für {fraction.label}</span>
                          <select
                            aria-label={`Zeitfenster für ${fraction.label}`}
                            value={selectedItems[fraction.id] ?? ''}
                            onChange={(event) =>
                              setSelectedItems((current) => ({
                                ...current,
                                [fraction.id]: event.target.value,
                              }))
                            }
                          >
                            {fraction.slots.map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                {slot.defaultLeadDays} Tage vorher, spätestens {slot.maxLeadDays} Tage
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>
                <label className="reminder-field">
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
                  <span>{props.reminderSignup.consentLabel}</span>
                  <a href={props.reminderSignup.privacyPolicyUrl} target="_blank" rel="noreferrer">
                    Datenschutzerklärung
                  </a>
                </label>
                {reminderError ? <p className="reminder-error">{reminderError}</p> : null}
                <button
                  type="button"
                  className="selection-trigger reminder-submit"
                  disabled={reminderSubmitting}
                  onClick={() => {
                    void submitReminderSignup();
                  }}
                >
                  {reminderSubmitting ? 'Wird angefordert…' : 'Erinnerung anfordern'}
                </button>
              </div>
            )
          ) : null}
        </section>
      ) : null}
      {pdfError ? <p className="body-copy">{pdfError}</p> : null}
      <PublicWasteCalendarPanels
        model={filteredModel}
        onToggleFraction={toggleFraction}
        onActivateEntry={setSelectedEntry}
      />
      <PublicWasteEventDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </section>
  );
}
