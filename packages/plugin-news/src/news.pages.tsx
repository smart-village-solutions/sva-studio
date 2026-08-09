import * as React from 'react';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';

import { NewsDetailPage } from './news.detail-page.js';
import { hasNewsCreatedSaveFeedback, removeNewsSaveFeedback } from './news.save-feedback.js';
import type { NewsPrincipalControl } from './news.types.js';

type NewsCreatePageProps = Readonly<{
  principalControl?: NewsPrincipalControl;
}>;

export const NewsCreatePage = ({ principalControl }: NewsCreatePageProps) => (
  <NewsDetailPage mode="create" principalControl={principalControl} />
);

export const NewsEditPage = ({ principalControl }: NewsCreatePageProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as {
    readonly contentId?: string;
    readonly id?: string;
  };
  const contentId = resolveNewsContentId(params);
  const initiallySaved = hasNewsCreatedSaveFeedback(location.state, contentId);
  const consumeInitialSaved = React.useCallback(() => {
    if (!contentId) {
      return;
    }

    void navigate({
      to: '/admin/news/$id',
      params: { id: contentId },
      replace: true,
      state: (previous) => removeNewsSaveFeedback(previous),
    });
  }, [contentId, navigate]);

  return (
    <NewsDetailPage
      mode="edit"
      contentId={contentId}
      principalControl={principalControl}
      initiallySaved={initiallySaved}
      onInitialSavedConsumed={consumeInitialSaved}
    />
  );
};

const resolveNewsContentId = (params: {
  readonly contentId?: string;
  readonly id?: string;
}): string | undefined => {
  if (typeof params.contentId === 'string') {
    return params.contentId;
  }

  return typeof params.id === 'string' ? params.id : undefined;
};
