import type { NextContentStateValues } from './repository-state-values.js';

export type ContentStateValidationErrorCode =
  | 'content_published_at_required'
  | 'content_publication_window_invalid';

export class ContentStateValidationError extends Error {
  public readonly code: ContentStateValidationErrorCode;

  public constructor(code: ContentStateValidationErrorCode) {
    super(code);
    this.name = 'ContentStateValidationError';
    this.code = code;
  }
}

export const isContentStateValidationError = (error: unknown): error is ContentStateValidationError =>
  error instanceof ContentStateValidationError;

export const validateNextContentState = (next: NextContentStateValues): void => {
  if (next.nextStatus === 'published' && !next.nextPublishedAt) {
    throw new ContentStateValidationError('content_published_at_required');
  }
  if (
    next.nextPublishFrom &&
    next.nextPublishUntil &&
    new Date(next.nextPublishFrom).getTime() > new Date(next.nextPublishUntil).getTime()
  ) {
    throw new ContentStateValidationError('content_publication_window_invalid');
  }
};
