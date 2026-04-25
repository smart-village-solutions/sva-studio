import { createLegalTextMutationHandlers } from '@sva/iam-governance/legal-text-mutation-handlers';
import { createSdkLogger } from '@sva/server-runtime';

import {
  asApiItem,
  createApiError,
  parseRequestBody,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { completeIdempotency, reserveIdempotency } from '../iam-account-management/shared.js';
import { jsonResponse } from '../db.js';

import type { ResolvedLegalTextsActor } from './request-context.js';
import {
  createLegalTextVersion,
  deleteLegalTextVersion,
  loadLegalTextById,
  updateLegalTextVersion,
} from './repository.js';

const logger = createSdkLogger({ component: 'iam-legal-texts', level: 'info' });

const parseLegalTextRequestBody = async <T>(
  request: Request,
  schema: unknown
): Promise<{ ok: true; data: T; rawBody: string } | { ok: false; message: string }> => {
  const result = await parseRequestBody(request, schema as Parameters<typeof parseRequestBody>[1]);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, data: result.data as T, rawBody: result.rawBody };
};

const legalTextMutationHandlers = createLegalTextMutationHandlers({
  validateCsrf,
  requireIdempotencyKey,
  parseRequestBody: parseLegalTextRequestBody,
  toPayloadHash,
  reserveIdempotency,
  completeIdempotency,
  readPathSegment,
  createApiError: (status, code, message, requestId, details) =>
    createApiError(status, code as Parameters<typeof createApiError>[1], message, requestId, details),
  asApiItem: (value, requestId) => asApiItem(value, requestId) as Record<string, unknown>,
  jsonResponse,
  repository: {
    createLegalTextVersion,
    updateLegalTextVersion,
    deleteLegalTextVersion,
    loadLegalTextById,
  },
  logError: (message, fields) => logger.error(message, fields),
});

export const createLegalTextResponse = (
  request: Request,
  actor: ResolvedLegalTextsActor['actor']
): Promise<Response> => legalTextMutationHandlers.createLegalTextResponse(request, actor);

export const updateLegalTextResponse = (
  request: Request,
  actor: ResolvedLegalTextsActor['actor']
): Promise<Response> => legalTextMutationHandlers.updateLegalTextResponse(request, actor);

export const deleteLegalTextResponse = (
  request: Request,
  actor: ResolvedLegalTextsActor['actor']
): Promise<Response> => legalTextMutationHandlers.deleteLegalTextResponse(request, actor);
