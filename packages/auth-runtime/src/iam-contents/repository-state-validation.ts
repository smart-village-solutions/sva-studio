import type { NextContentStateValues } from './repository-state-values.js';
import {
  resolveContentPublicationInvariant,
  type ContentPublicationInvariantCode,
} from './content-publication-invariants.js';

export type ContentStateValidationErrorCode =
  | ContentPublicationInvariantCode
  | 'content_author_display_mode_not_allowed'
  | 'content_author_organization_not_found';

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
  const invariant = resolveContentPublicationInvariant({
    status: next.nextStatus,
    publishedAt: next.nextPublishedAt,
    publishFrom: next.nextPublishFrom,
    publishUntil: next.nextPublishUntil,
  });
  if (invariant) {
    throw new ContentStateValidationError(invariant);
  }
};
