const NEWS_SAVE_FEEDBACK_KEY = 'newsSaveFeedback';

type NewsCreatedSaveFeedback = Readonly<{
  kind: 'created';
  contentId: string;
}>;

type NewsSaveFeedbackHistoryState = Readonly<Record<string, unknown>> &
  Readonly<{
    newsSaveFeedback?: NewsCreatedSaveFeedback;
  }>;

export const addNewsCreatedSaveFeedback = <TState extends object>(
  state: TState,
  contentId: string
) => ({
  ...state,
  [NEWS_SAVE_FEEDBACK_KEY]: { kind: 'created', contentId } satisfies NewsCreatedSaveFeedback,
});

export const removeNewsSaveFeedback = <TState extends object>(state: TState) => ({
  ...state,
  [NEWS_SAVE_FEEDBACK_KEY]: undefined,
});

export const hasNewsCreatedSaveFeedback = (state: unknown, contentId: string | undefined) => {
  if (!contentId || typeof state !== 'object' || state === null) {
    return false;
  }

  const feedback = (state as NewsSaveFeedbackHistoryState).newsSaveFeedback;
  return feedback?.kind === 'created' && feedback.contentId === contentId;
};
