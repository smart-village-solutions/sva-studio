import type { ApiErrorCode } from '@sva/core';

import { createApiError } from './api-helpers.js';

const parseMutationError = (
  error: unknown
): {
  code?: string;
  detail?: string;
  message: string;
} => {
  const message = error instanceof Error ? error.message : String(error);
  const [code, detail] = message.split(':', 2);
  return { code, detail, message };
};

export const createUserMutationErrorResponse = (input: {
  error: unknown;
  requestId?: string;
  fallbackMessage: string;
  forbiddenFallbackMessage: string;
}): Response | null => {
  const parsed = parseMutationError(input.error);

  if (parsed.code === 'not_found') {
    return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', input.requestId);
  }
  if (parsed.code === 'self_protection') {
    return createApiError(409, 'self_protection', 'Eigener Nutzer kann nicht deaktiviert werden.', input.requestId);
  }
  if (parsed.code === 'last_admin_protection') {
    return createApiError(
      409,
      'last_admin_protection',
      'Letzter aktiver system_admin kann nicht deaktiviert werden.',
      input.requestId
    );
  }
  if (parsed.code === 'forbidden') {
    return createApiError(403, 'forbidden', parsed.detail ?? input.forbiddenFallbackMessage, input.requestId);
  }
  if (parsed.code === 'invalid_request') {
    return createApiError(400, 'invalid_request', parsed.detail || 'Ungültiger Payload.', input.requestId);
  }
  if (parsed.code === 'pii_encryption_required') {
    return createApiError(
      503,
      'internal_error',
      'PII-Verschlüsselung ist nicht konfiguriert.',
      input.requestId
    );
  }

  return null;
};

export const createUnexpectedMutationErrorResponse = (input: {
  requestId?: string;
  message: string;
  code?: ApiErrorCode;
  status?: number;
}): Response =>
  createApiError(
    input.status ?? 500,
    input.code ?? 'internal_error',
    input.message,
    input.requestId
  );
