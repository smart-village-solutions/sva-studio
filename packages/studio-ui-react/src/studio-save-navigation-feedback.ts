const STUDIO_SAVE_FEEDBACK_KEY = 'studioSaveFeedback';

type StudioCreatedSaveFeedback = Readonly<{
  kind: 'created';
  resourceId: string;
  resourceType: string;
}>;

type StudioSaveFeedbackHistoryState = Readonly<Record<string, unknown>> &
  Readonly<{
    studioSaveFeedback?: StudioCreatedSaveFeedback;
  }>;

export const addStudioCreatedSaveFeedback = <TState extends object>(
  state: TState,
  resourceType: string,
  resourceId: string
) => ({
  ...state,
  [STUDIO_SAVE_FEEDBACK_KEY]: {
    kind: 'created',
    resourceId,
    resourceType,
  } satisfies StudioCreatedSaveFeedback,
});

export const removeStudioSaveFeedback = <TState extends object>(state: TState) => ({
  ...state,
  [STUDIO_SAVE_FEEDBACK_KEY]: undefined,
});

export const hasStudioCreatedSaveFeedback = (
  state: unknown,
  resourceType: string,
  resourceId: string | undefined
) => {
  if (!resourceId || typeof state !== 'object' || state === null) {
    return false;
  }

  const feedback = (state as StudioSaveFeedbackHistoryState).studioSaveFeedback;
  return (
    feedback?.kind === 'created' &&
    feedback.resourceType === resourceType &&
    feedback.resourceId === resourceId
  );
};
