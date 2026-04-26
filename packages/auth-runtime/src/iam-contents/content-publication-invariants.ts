import type { IamContentStatus } from '@sva/core';

export type ContentPublicationInvariantCode =
  | 'content_published_at_required'
  | 'content_publication_window_invalid';

export const resolveContentPublicationInvariant = (value: {
  readonly status?: IamContentStatus;
  readonly publishedAt?: string | null;
  readonly publishFrom?: string | null;
  readonly publishUntil?: string | null;
}): ContentPublicationInvariantCode | null => {
  if (value.status === 'published' && !value.publishedAt) {
    return 'content_published_at_required';
  }
  if (
    value.publishFrom &&
    value.publishUntil &&
    new Date(value.publishFrom).getTime() >= new Date(value.publishUntil).getTime()
  ) {
    return 'content_publication_window_invalid';
  }
  return null;
};
