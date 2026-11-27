import {
  addStudioCreatedSaveFeedback,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import type { StatusMessage } from './news.detail-page.helpers.js';

const NEWS_RESOURCE_TYPE = 'news';

export const addNewsCreatedSaveFeedback = <TState extends object>(
  state: TState,
  contentId: string
) => addStudioCreatedSaveFeedback(state, NEWS_RESOURCE_TYPE, contentId);

export const removeNewsSaveFeedback = removeStudioSaveFeedback;

export const hasNewsCreatedSaveFeedback = (state: unknown, contentId: string | undefined) =>
  hasStudioCreatedSaveFeedback(state, NEWS_RESOURCE_TYPE, contentId);

export const useCreatedNewsNavigation = () => {
  const navigate = useNavigate();
  return useCallback(
    (contentId: string) =>
      navigate({
        to: '/admin/news/$id',
        params: { id: contentId },
        state: (previous) => addNewsCreatedSaveFeedback(previous, contentId),
      }),
    [navigate]
  );
};

export const newsSaveSuccessStatus = (
  pt: (key: string) => string,
  publicationMode: 'draft' | 'immediate' | 'scheduled',
  current: StatusMessage | null = null
): StatusMessage => current ?? {
  source: 'success',
  text: pt({ draft: 'actions.savedDraft', immediate: 'actions.savedPublished', scheduled: 'actions.savedScheduled' }[publicationMode]),
};
