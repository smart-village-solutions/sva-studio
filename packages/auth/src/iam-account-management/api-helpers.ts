import type { ApiErrorCode } from '@sva/core';

import { annotateApiErrorSpan } from './diagnostics.js';
import {
  asApiItem,
  asApiList,
  createApiError as createSharedApiError,
  parseRequestBody,
  readInstanceIdFromRequest,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from '../shared/request-helpers.js';

export const createApiError = (
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId?: string,
  details?: Readonly<Record<string, unknown>>
): Response => {
  annotateApiErrorSpan({ status, code, details });

  return createSharedApiError(status, code, message, requestId, details);
};

export {
  asApiItem,
  asApiList,
  parseRequestBody,
  readInstanceIdFromRequest,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
};
