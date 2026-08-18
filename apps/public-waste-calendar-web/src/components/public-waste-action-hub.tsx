import { IconCalendarPlus, IconFileTypePdf, IconMail } from '@tabler/icons-react';

import type { PublicWasteCalendarResponse } from '../lib/public-waste-api.js';
import type { PublicWasteResolvedSelection } from '../lib/public-waste-contract.js';
import type { PublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';
import { usePublicWasteActionState } from './public-waste-reminder-selection.js';

type ActionPanel = 'calendar' | 'pdf' | 'email';
type Props = Readonly<{
  selection: PublicWasteResolvedSelection;
  selectionSummary: string;
  locationKey: string;
  fractionOptions: PublicWasteCalendarViewModel['fractionOptions'];
  selectedFractions: readonly string[];
  calendarReminderOptions?: PublicWasteCalendarResponse['calendarReminderOptions'];
  reminderSignup?: PublicWasteCalendarResponse['reminderSignup'];
  pdfRunning: boolean;
  pdfError: string | null;
  downloadPdf: () => Promise<void>;
}>;
type State = ReturnType<typeof usePublicWasteActionState>;

const REMINDER_ERROR_ID = 'public-waste-reminder-error';
const triggerId = (panel: ActionPanel): string => `public-waste-action-trigger-${panel}`;
const panelId = (panel: ActionPanel): string => `public-waste-action-panel-${panel}`;

const ActionToolbar = ({
  activePanel,
  togglePanel,
}: Pick<State, 'activePanel' | 'togglePanel'>) => (
  <div className="action-hub-toolbar" role="group" aria-label="Export- und Erinnerungsaktionen">
    {(
      [
        ['calendar', IconCalendarPlus, 'Kalender exportieren'],
        ['pdf', IconFileTypePdf, 'PDF / Druckversion'],
        ['email', IconMail, 'E-Mail-Erinnerung'],
      ] as const
    ).map(([panel, Icon, label]) => (
      <button
        key={panel}
        type="button"
        id={triggerId(panel)}
        aria-controls={panelId(panel)}
        aria-expanded={activePanel === panel}
        className={`action-hub-trigger${activePanel === panel ? ' is-active' : ''}`}
        onClick={() => togglePanel(panel)}
      >
        <Icon size={20} stroke={1.8} aria-hidden="true" />
        <span>{label}</span>
      </button>
    ))}
  </div>
);

const CalendarAction = ({
  selectedFractions,
  state,
}: {
  selectedFractions: readonly string[];
  state: State;
}) => (
  <div className="action-panel-body">
    <p className="action-panel-copy">
      {state.calendarSelectionComplete
        ? 'Der Export übernimmt automatisch die Standard-Erinnerungen der aktiven Fraktionen.'
        : 'Der Export enthält die aktiven Abholtermine ohne zusätzliche Erinnerungen.'}
    </p>
    {!state.calendarContext.isFullySupported &&
    state.calendarContext.supportedFractions.length > 0 ? (
      <p className="action-warning">
        Für die aktuelle Fraktionsauswahl sind nicht für alle Fraktionen Kalender-Erinnerungen
        verfügbar. Der Export wird deshalb ohne Erinnerungen erstellt.
      </p>
    ) : null}
    <a
      href={selectedFractions.length > 0 ? state.calendarExportUrl : undefined}
      className={`action-cta-link${selectedFractions.length === 0 ? ' is-disabled' : ''}`}
      aria-disabled={selectedFractions.length === 0}
      onClick={(event) => {
        if (selectedFractions.length === 0) event.preventDefault();
      }}
    >
      Kalender exportieren
    </a>
  </div>
);

const PdfAction = ({ props }: { props: Props }) => (
  <div className="action-panel-body">
    {props.pdfError ? (
      <p className="action-warning" role="alert">
        {props.pdfError}
      </p>
    ) : null}
    <button
      type="button"
      className="action-cta-button"
      disabled={props.selectedFractions.length === 0 || props.pdfRunning}
      onClick={() => void props.downloadPdf()}
    >
      {props.pdfRunning ? 'PDF wird erstellt…' : 'PDF herunterladen'}
    </button>
  </div>
);

const ReminderFields = ({ props, state }: { props: Props; state: State }) => (
  <>
    <p className="action-panel-copy">
      Das Abo verwendet automatisch die Standard-Erinnerungen der aktiven Fraktionen.
    </p>
    <label className="action-field">
      <span>E-Mail-Adresse</span>
      <input
        aria-label="E-Mail-Adresse"
        aria-describedby={state.error ? REMINDER_ERROR_ID : undefined}
        aria-invalid={state.error ? 'true' : undefined}
        type="email"
        value={state.email}
        onChange={(event) => state.setEmail(event.target.value)}
      />
    </label>
    <label className="reminder-consent">
      <input
        type="checkbox"
        aria-describedby={state.error ? REMINDER_ERROR_ID : undefined}
        aria-invalid={state.error ? 'true' : undefined}
        checked={state.consentAccepted}
        onChange={(event) => state.setConsentAccepted(event.target.checked)}
      />
      <span>
        {props.reminderSignup?.consentLabel ?? 'Ich stimme der Verarbeitung meiner Daten zu.'}
      </span>
      {props.reminderSignup?.privacyPolicyUrl ? (
        <a href={props.reminderSignup.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
          Datenschutzerklärung
        </a>
      ) : null}
    </label>
  </>
);

const ReminderForm = ({ props, state }: { props: Props; state: State }) => (
  <>
    {state.emailContext.isFullySupported ? (
      <ReminderFields props={props} state={state} />
    ) : (
      <p className="action-warning">
        Für die aktuelle Fraktionsauswahl sind nicht für alle Fraktionen E-Mail-Erinnerungen
        verfügbar. Passen Sie die Fraktionsauswahl an, um das Abo zu aktivieren.
      </p>
    )}
    {state.error ? (
      <p id={REMINDER_ERROR_ID} className="action-warning" role="alert">
        {state.error}
      </p>
    ) : null}
    <button
      type="button"
      className="action-cta-button"
      disabled={!state.canSubmit}
      onClick={() => void state.submit()}
    >
      {state.submitting ? 'Wird angefordert…' : 'E-Mail-Erinnerung anfordern'}
    </button>
  </>
);

const EmailAction = ({ props, state }: { props: Props; state: State }) => (
  <div className="action-panel-body">
    {state.success ? (
      <div className="reminder-feedback reminder-feedback-success" role="status" aria-live="polite">
        <strong>{state.success.headline}</strong>
        <p className="body-copy">{state.success.message}</p>
      </div>
    ) : (
      <ReminderForm props={props} state={state} />
    )}
  </div>
);

const ActiveAction = ({ props, state }: { props: Props; state: State }) => {
  if (state.activePanel === 'calendar') {
    return <CalendarAction selectedFractions={props.selectedFractions} state={state} />;
  }
  if (state.activePanel === 'pdf') return <PdfAction props={props} />;
  return <EmailAction props={props} state={state} />;
};

export function PublicWasteActionHub(props: Props) {
  const state = usePublicWasteActionState(props);
  const description =
    props.selectedFractions.length === 0
      ? 'Wählen Sie rechts mindestens eine Fraktion aus, um diese Aktion zu nutzen.'
      : `Aktiv ausgewählt: ${props.selectedFractions.length} Fraktion${props.selectedFractions.length === 1 ? '' : 'en'}.`;
  return (
    <section className="action-hub" aria-label="Kalenderaktionen">
      <ActionToolbar activePanel={state.activePanel} togglePanel={state.togglePanel} />
      {state.activePanel ? (
        <div
          id={panelId(state.activePanel)}
          className="action-panel"
          role="region"
          aria-labelledby={triggerId(state.activePanel)}
        >
          <p className="action-panel-intro">{description}</p>
          <ActiveAction props={props} state={state} />
        </div>
      ) : null}
    </section>
  );
}
