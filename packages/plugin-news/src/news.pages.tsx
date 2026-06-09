import { useParams } from '@tanstack/react-router';

import { NewsDetailPage } from './news.detail-page.js';

type NewsCreatePageProps = Readonly<{
  initialAuthor?: string;
}>;

export const NewsCreatePage = ({ initialAuthor }: NewsCreatePageProps) => (
  <NewsDetailPage mode="create" initialAuthor={initialAuthor} />
);

export const NewsEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  const contentId = resolveNewsContentId(params);

  return <NewsDetailPage mode="edit" contentId={contentId} />;
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
