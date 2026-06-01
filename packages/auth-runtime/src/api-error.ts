import type { ApiErrorCode, ApiErrorResponse } from '@sva/core';
import { deriveIamRuntimeDiagnostics } from '@sva/core';
import { jsonResponse } from './db.js';

export const createApiError = (
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId?: string,
  details?: Readonly<Record<string, unknown>>
): Response => {
  const diagnostics = deriveIamRuntimeDiagnostics({ code, status, details });

  return jsonResponse(
    status,
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        classification: diagnostics.classification,
        status: diagnostics.status,
        recommendedAction: diagnostics.recommendedAction,
        ...(diagnostics.safeDetails ? { safeDetails: diagnostics.safeDetails } : {}),
      },
      ...(requestId ? { requestId } : {}),
    } satisfies ApiErrorResponse,
    requestId ? { 'X-Request-Id': requestId } : undefined
  );
};
