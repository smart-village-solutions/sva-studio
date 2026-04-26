import type { NextContentStateValues } from './repository-state-values.js';

export const validateNextContentState = (next: NextContentStateValues): void => {
  if (next.nextStatus === 'published' && !next.nextPublishedAt) {
    throw new Error('content_published_at_required');
  }
  if (
    next.nextPublishFrom &&
    next.nextPublishUntil &&
    new Date(next.nextPublishFrom).getTime() > new Date(next.nextPublishUntil).getTime()
  ) {
    throw new Error('content_publication_window_invalid');
  }
};
