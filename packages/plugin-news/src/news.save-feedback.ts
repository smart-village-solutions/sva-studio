import {
  addStudioCreatedSaveFeedback,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
} from '@sva/studio-ui-react';

const NEWS_RESOURCE_TYPE = 'news';

export const addNewsCreatedSaveFeedback = <TState extends object>(
  state: TState,
  contentId: string
) => addStudioCreatedSaveFeedback(state, NEWS_RESOURCE_TYPE, contentId);

export const removeNewsSaveFeedback = removeStudioSaveFeedback;

export const hasNewsCreatedSaveFeedback = (state: unknown, contentId: string | undefined) =>
  hasStudioCreatedSaveFeedback(state, NEWS_RESOURCE_TYPE, contentId);
