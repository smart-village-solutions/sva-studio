import type { ContentJsonValue } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { jsonResponse } from '../db.js';
import {
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
  toPayloadHash,
} from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { completeIdempotency, reserveIdempotency } from '../iam-account-management/shared.js';

import type { CreateContentInput } from './repository-types.js';
import type { ResolvedContentActor } from './request-context.js';
import { validateContentTypePayload } from './content-type-registry.js';
import { createContentSchema } from './schemas.js';

const logger = createSdkLogger({ component: 'iam-contents', level: 'info' });

export const completeCreateIdempotency = async (
  actor: ResolvedContentActor['actor'],
  idempotencyKey: string,
  responseStatus: number,
  responseBody: Record<string, unknown>
) =>
  completeIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/contents',
    idempotencyKey,
    status: responseStatus >= 400 ? 'FAILED' : 'COMPLETED',
    responseStatus,
    responseBody,
  });

export const createFailureResponse = async (
  actor: ResolvedContentActor['actor'],
  idempotencyKey: string,
  status: number,
  code: string,
  message: string
) => {
  const responseBody = {
    error: { code, message },
    ...(actor.requestId ? { requestId: actor.requestId } : {}),
  };
  await completeCreateIdempotency(actor, idempotencyKey, status, responseBody);
  return jsonResponse(status, responseBody);
};

export type ParsedCreateRequest = {
  readonly idempotencyKey: string;
  readonly rawBody: string;
  readonly parsedData: Pick<
    CreateContentInput,
    | 'contentType'
    | 'organizationId'
    | 'ownerSubjectId'
    | 'title'
    | 'payload'
    | 'status'
    | 'validationState'
    | 'publishedAt'
    | 'publishFrom'
    | 'publishUntil'
  >;
  readonly payload: ContentJsonValue;
};

export const parseCreateRequest = async (
  request: Request,
  actor: ResolvedContentActor['actor']
): Promise<Response | ParsedCreateRequest> => {
  const csrfError = validateCsrf(request, actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotencyKey = requireIdempotencyKey(request, actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createContentSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', parsed.message, actor.requestId);
  }

  const payloadValidation = validateContentTypePayload(parsed.data.contentType, parsed.data.payload);
  if (!payloadValidation.ok) {
    return createApiError(400, 'invalid_request', payloadValidation.message, actor.requestId);
  }

  return {
    idempotencyKey: idempotencyKey.key,
    rawBody: parsed.rawBody,
    parsedData: parsed.data,
    payload: payloadValidation.payload,
  };
};

export const reserveCreateIdempotency = async (
  actor: ResolvedContentActor['actor'],
  idempotencyKey: string,
  rawBody: string
): Promise<Response | null> => {
  const reserve = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/contents',
    idempotencyKey,
    payloadHash: toPayloadHash(rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actor.requestId);
  }
  return null;
};

export const logCreateFailure = (actor: ResolvedContentActor['actor'], error: unknown) => {
  logger.error('Content create failed', {
    operation: 'content_create',
    instance_id: actor.instanceId,
    request_id: actor.requestId,
    trace_id: actor.traceId,
    error: error instanceof Error ? error.message : String(error),
  });
};
