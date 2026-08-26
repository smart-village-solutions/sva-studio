type StudioDestructiveNavigationFeedback = Readonly<{
  kind: 'destructive-complete';
  resourceType: string;
  resourceId: string;
}>;

type StudioActionFeedbackHistoryState = Readonly<Record<string, unknown>> & {
  readonly studioActionFeedback?: StudioDestructiveNavigationFeedback;
};

export const addStudioDestructiveNavigationFeedback = <TState extends object>(
  state: TState,
  resourceType: string,
  resourceId: string
) => ({
  ...state,
  studioActionFeedback: {
    kind: 'destructive-complete',
    resourceType,
    resourceId,
  } satisfies StudioDestructiveNavigationFeedback,
});

export const readStudioDestructiveNavigationFeedback = (
  state: unknown
): StudioDestructiveNavigationFeedback | null => {
  if (!state || typeof state !== 'object') return null;
  const feedback = (state as StudioActionFeedbackHistoryState).studioActionFeedback;
  return feedback?.kind === 'destructive-complete' &&
    typeof feedback.resourceType === 'string' &&
    typeof feedback.resourceId === 'string'
    ? feedback
    : null;
};

export const removeStudioActionNavigationFeedback = <TState extends object>(state: TState) => ({
  ...state,
  studioActionFeedback: undefined,
});
