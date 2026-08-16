import React from 'react';

import {
  buildPublicWasteIcalUrl,
  requestPublicWasteReminderSignup,
  type PublicWasteCalendarResponse,
} from '../lib/public-waste-api.js';
import type {
  PublicWasteReminderFractionOption,
  PublicWasteReminderSelectionItem,
  PublicWasteResolvedSelection,
} from '../lib/public-waste-contract.js';
import type { PublicWasteCalendarViewModel } from '../lib/public-waste-view-model.js';

type ReminderSelectionState = Readonly<Record<string, string>>;

const buildReminderSlotSelection = (
  activeFractionIds: readonly string[],
  fractions: readonly PublicWasteReminderFractionOption[],
  previous: ReminderSelectionState
): ReminderSelectionState => {
  const activeFractionSet = new Set(activeFractionIds);
  const next: Record<string, string> = {};
  for (const fraction of fractions) {
    if (!activeFractionSet.has(fraction.id) || fraction.slots.length === 0) continue;
    const previousSlotId = previous[fraction.id];
    next[fraction.id] = fraction.slots.some((slot) => slot.id === previousSlotId)
      ? previousSlotId
      : fraction.slots[0]!.id;
  }
  return next;
};

const resolveReminderContext = (
  activeFractionIds: readonly string[],
  fractionOptions: PublicWasteCalendarViewModel['fractionOptions'],
  reminderFractions: readonly PublicWasteReminderFractionOption[]
) => {
  const reminderFractionMap = new Map(reminderFractions.map((fraction) => [fraction.id, fraction]));
  const supportedFractions = activeFractionIds
    .map((fractionId) => reminderFractionMap.get(fractionId))
    .filter((fraction): fraction is PublicWasteReminderFractionOption => fraction !== undefined);
  return {
    supportedFractions,
    isFullySupported:
      activeFractionIds.length > 0 &&
      supportedFractions.length === activeFractionIds.length &&
      supportedFractions.length > 0,
  };
};

const buildReminderItems = (
  fractions: readonly PublicWasteReminderFractionOption[],
  selectedSlots: ReminderSelectionState
): readonly PublicWasteReminderSelectionItem[] =>
  fractions
    .map((fraction) => {
      const slotId = selectedSlots[fraction.id];
      return slotId ? { fractionId: fraction.id, slotId } : null;
    })
    .filter((item): item is PublicWasteReminderSelectionItem => item !== null);

const useReminderItems = (
  selectedFractions: readonly string[],
  context: ReturnType<typeof resolveReminderContext>
) => {
  const [selectedSlots, setSelectedSlots] = React.useState<ReminderSelectionState>({});
  React.useEffect(() => {
    setSelectedSlots((current) => {
      const next = buildReminderSlotSelection(
        selectedFractions,
        context.supportedFractions,
        current
      );
      const currentEntries = Object.entries(current);
      const unchanged =
        currentEntries.length === Object.keys(next).length &&
        currentEntries.every(([fractionId, slotId]) => next[fractionId] === slotId);
      return unchanged ? current : next;
    });
  }, [context.supportedFractions, selectedFractions]);
  return React.useMemo(
    () => buildReminderItems(context.supportedFractions, selectedSlots),
    [context.supportedFractions, selectedSlots]
  );
};

type ActionStateInput = Readonly<{
  selection: PublicWasteResolvedSelection;
  selectionSummary: string;
  locationKey: string;
  fractionOptions: PublicWasteCalendarViewModel['fractionOptions'];
  selectedFractions: readonly string[];
  calendarReminderOptions?: PublicWasteCalendarResponse['calendarReminderOptions'];
  reminderSignup?: PublicWasteCalendarResponse['reminderSignup'];
}>;

const EMPTY_REMINDER_FRACTIONS: readonly PublicWasteReminderFractionOption[] = [];

const useReminderFeedback = (locationKey: string, fractionKey: string) => {
  const [activePanel, setActivePanel] = React.useState<'calendar' | 'pdf' | 'email' | null>(null);
  const [email, setEmail] = React.useState('');
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<null | { headline: string; message: string }>(null);
  const previousFractionKey = React.useRef(fractionKey);

  React.useEffect(() => {
    setActivePanel(null);
    setError(null);
    setSuccess(null);
    setConsentAccepted(false);
    setEmail('');
  }, [locationKey]);
  React.useEffect(() => {
    if (previousFractionKey.current === fractionKey) return;
    previousFractionKey.current = fractionKey;
    setError(null);
    setSuccess(null);
  }, [fractionKey]);

  const togglePanel = (panel: 'calendar' | 'pdf' | 'email') => {
    setActivePanel((current) => (current === panel ? null : panel));
    setError(null);
  };
  return {
    activePanel,
    consentAccepted,
    email,
    error,
    setConsentAccepted,
    setEmail,
    setError,
    setSuccess,
    success,
    togglePanel,
  };
};

const useReminderSubmission = (
  input: ActionStateInput,
  emailItems: readonly PublicWasteReminderSelectionItem[],
  emailSelectionComplete: boolean,
  feedback: ReturnType<typeof useReminderFeedback>
) => {
  const [submitting, setSubmitting] = React.useState(false);
  const submit = async () => {
    if (!input.reminderSignup?.enabled) {
      feedback.setError('Der E-Mail-Erinnerungsdienst ist derzeit nicht verfügbar.');
      return;
    }
    if (
      !emailSelectionComplete ||
      !feedback.consentAccepted ||
      feedback.email.trim().length === 0
    ) {
      feedback.setError(
        'Bitte wählen Sie gültige Fraktionen, eine E-Mail-Adresse und die Datenschutz-Einwilligung aus.'
      );
      return;
    }
    setSubmitting(true);
    feedback.setError(null);
    try {
      const response = await requestPublicWasteReminderSignup({
        selection: input.selection,
        email: feedback.email.trim(),
        items: emailItems,
        consentAccepted: true,
      });
      feedback.setSuccess({ headline: response.headline, message: response.message });
    } catch (requestError) {
      feedback.setError(
        requestError instanceof Error
          ? requestError.message
          : 'Die Erinnerung konnte nicht angefordert werden.'
      );
    } finally {
      setSubmitting(false);
    }
  };
  return { submit, submitting };
};

export const usePublicWasteActionState = (input: ActionStateInput) => {
  const feedback = useReminderFeedback(input.locationKey, input.selectedFractions.join('|'));
  const emailContext = React.useMemo(
    () =>
      resolveReminderContext(
        input.selectedFractions,
        input.fractionOptions,
        input.reminderSignup?.fractions ?? EMPTY_REMINDER_FRACTIONS
      ),
    [input.fractionOptions, input.reminderSignup?.fractions, input.selectedFractions]
  );
  const calendarContext = React.useMemo(
    () =>
      resolveReminderContext(
        input.selectedFractions,
        input.fractionOptions,
        input.calendarReminderOptions?.fractions ?? EMPTY_REMINDER_FRACTIONS
      ),
    [input.calendarReminderOptions?.fractions, input.fractionOptions, input.selectedFractions]
  );
  const emailItems = useReminderItems(input.selectedFractions, emailContext);
  const calendarItems = useReminderItems(input.selectedFractions, calendarContext);
  const emailSelectionComplete =
    emailContext.isFullySupported && emailItems.length === emailContext.supportedFractions.length;
  const calendarSelectionComplete =
    calendarContext.isFullySupported &&
    calendarItems.length === calendarContext.supportedFractions.length;
  const submission = useReminderSubmission(input, emailItems, emailSelectionComplete, feedback);

  return {
    activePanel: feedback.activePanel,
    calendarContext,
    calendarExportUrl: buildPublicWasteIcalUrl({
      selection: input.selection,
      calendarName: input.selectionSummary,
      fractionIds: input.selectedFractions,
      reminderItems: calendarSelectionComplete ? calendarItems : [],
    }),
    calendarSelectionComplete,
    canSubmit:
      emailSelectionComplete &&
      feedback.consentAccepted &&
      feedback.email.trim().length > 0 &&
      !submission.submitting,
    consentAccepted: feedback.consentAccepted,
    email: feedback.email,
    emailContext,
    error: feedback.error,
    setConsentAccepted: feedback.setConsentAccepted,
    setEmail: feedback.setEmail,
    submit: submission.submit,
    submitting: submission.submitting,
    success: feedback.success,
    togglePanel: feedback.togglePanel,
  };
};
