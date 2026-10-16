import { IconCalendarPlus, IconFileTypePdf, IconMail } from '@tabler/icons-react';

import type { PublicWasteCalendarResponse } from '../lib/public-waste-api.js';
import type { PublicWasteResolvedSelection } from '../lib/public-waste-contract.js';
import type { PublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';
import {
  createPublicWasteTranslator,
  type PublicWasteTranslationKey,
} from '../lib/public-waste-translations.js';
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
const reminderText = (key: PublicWasteTranslationKey): string =>
  createPublicWasteTranslator(
    typeof document === 'undefined' ? 'de' : document.documentElement.lang || 'de'
  )(key);

const ActionToolbar = ({
  activePanel,
  togglePanel,
  emailAvailable,
}: Pick<State, 'activePanel' | 'togglePanel'> & { emailAvailable: boolean }) => (
  <div className="action-hub-toolbar" role="group" aria-label="Export- und Erinnerungsaktionen">
    {(
      [
        ['calendar', IconCalendarPlus, 'Kalender exportieren'],
        ['pdf', IconFileTypePdf, 'PDF / Druckversion'],
        ['email', IconMail, reminderText('reminder.action')],
      ] as const
    )
      .filter(([panel]) => panel !== 'email' || emailAvailable)
      .map(([panel, Icon, label]) => (
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
    <p className="action-panel-copy">{reminderText('reminder.description')}</p>
    <ul className="action-panel-copy">
      {state.emailContext.supportedFractions.map((fraction) => {
        const days = fraction.slots[0]?.defaultLeadDays ?? 0;
        const timing =
          days === 0
            ? reminderText('reminder.sameDay')
            : days === 1
              ? reminderText('reminder.oneDayBefore')
              : reminderText('reminder.daysBefore').replace('{days}', String(days));
        return (
          <li key={fraction.id}>
            {fraction.label}: {timing}
          </li>
        );
      })}
    </ul>
    <p className="action-panel-copy">{reminderText('reminder.sendTime')}</p>
    <label className="action-field">
      <span>{reminderText('reminder.email')}</span>
      <input
        aria-label={reminderText('reminder.email')}
        aria-describedby={state.error ? REMINDER_ERROR_ID : undefined}
        aria-invalid={state.error ? 'true' : undefined}
        type="email"
        autoComplete="email"
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
      <span>{props.reminderSignup?.consentLabel ?? reminderText('reminder.consentFallback')}</span>
      {props.reminderSignup?.privacyPolicyUrl ? (
        <a href={props.reminderSignup.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
          {reminderText('reminder.privacy')}
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
      <p className="action-warning">{reminderText('reminder.unsupported')}</p>
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
      {state.submitting ? reminderText('reminder.submitting') : reminderText('reminder.submit')}
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
  const emailAvailable = props.reminderSignup?.enabled === true;
  const activePanel = state.activePanel === 'email' && !emailAvailable ? null : state.activePanel;
  const description =
    props.selectedFractions.length === 0
      ? 'Wählen Sie rechts mindestens eine Fraktion aus, um diese Aktion zu nutzen.'
      : `Aktiv ausgewählt: ${props.selectedFractions.length} Fraktion${props.selectedFractions.length === 1 ? '' : 'en'}.`;
  return (
    <section className="action-hub" aria-label="Kalenderaktionen">
      <ActionToolbar
        activePanel={activePanel}
        togglePanel={state.togglePanel}
        emailAvailable={emailAvailable}
      />
      {activePanel ? (
        <div
          id={panelId(activePanel)}
          className="action-panel"
          role="region"
          aria-labelledby={triggerId(activePanel)}
        >
          <p className="action-panel-intro">{description}</p>
          <ActiveAction props={props} state={state} />
        </div>
      ) : null}
    </section>
  );
}
