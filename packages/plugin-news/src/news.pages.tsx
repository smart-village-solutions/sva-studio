import { useParams } from '@tanstack/react-router';

import { NewsDetailPage } from './news.detail-page.js';
import type { NewsPrincipalControl } from './news.types.js';

type NewsCreatePageProps = Readonly<{
  principalControl?: NewsPrincipalControl;
}>;

export const NewsCreatePage = ({ principalControl }: NewsCreatePageProps) => (
  <NewsDetailPage mode="create" principalControl={principalControl} />
);

export const NewsEditPage = ({ principalControl }: NewsCreatePageProps = {}) => {
  const params = useParams({ strict: false }) as {
    readonly contentId?: string;
    readonly id?: string;
  };
  const contentId = resolveNewsContentId(params);

  return <NewsDetailPage mode="edit" contentId={contentId} principalControl={principalControl} />;
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
