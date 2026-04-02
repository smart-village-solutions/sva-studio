import type { ApiErrorResponse } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey, toPayloadHash } from './api-helpers.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
import { bulkDeactivateSchema } from './schemas.js';
import {
  type UserMutationActor,
  requireUserMutationIdentityProvider,
  resolveUserMutationActor,
} from './user-mutation-request-context.shared.js';
import { createUserMutationErrorResponse } from './user-mutation-errors.js';

type BulkDeactivatePayload = z.infer<typeof bulkDeactivateSchema>;

export type BulkDeactivateContext =
  | Response
  | {
      actor: UserMutationActor;
      identityProvider: IdentityProviderResolution;
      payload: BulkDeactivatePayload;
      idempotencyKey: string;
    };

const resolveBulkDeactivatePreconditions = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response | { actor: UserMutationActor; requestId: string }> => {
  const requestContext = getWorkspaceContext();
  const actorResolution = await resolveUserMutationActor(request, ctx, {
    feature: 'iam_bulk',
    scope: 'bulk',
    requestId: requestContext.requestId,
  });
  if ('response' in actorResolution) {
    return actorResolution.response;
  }

  return {
    actor: actorResolution.actor,
    requestId: actorResolution.actor.requestId ?? getWorkspaceContext().requestId ?? 'bulk-deactivate',
  };
};

export const resolveBulkDeactivateContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<BulkDeactivateContext> => {
  const resolved = await resolveBulkDeactivatePreconditions(request, ctx);
  if (resolved instanceof Response) {
    return resolved;
  }
  const { actor, requestId } = resolved;

  const idempotencyKey = requireIdempotencyKey(request, requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, bulkDeactivateSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, requestId);
  }

  const identityProvider = await requireUserMutationIdentityProvider(actor.instanceId, requestId);
  if (identityProvider instanceof Response) {
    return identityProvider;
  }

  return {
    actor,
    identityProvider,
    payload: parsed.data,
    idempotencyKey: idempotencyKey.key,
  };
};

export const completeBulkDeactivateSuccess = async (input: {
  actor: UserMutationActor;
  idempotencyKey: string;
  details: readonly { id: string }[];
}) => {
  const responseBody = asApiItem(
    {
      deactivatedUserIds: input.details.map((entry) => entry.id),
      count: input.details.length,
    },
    input.actor.requestId
  );
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
    idempotencyKey: input.idempotencyKey,
    status: 'COMPLETED',
    responseStatus: 200,
    responseBody,
  });
  return jsonResponse(200, responseBody);
};

export const completeBulkDeactivateFailure = async (input: {
  actor: UserMutationActor;
  idempotencyKey: string;
  error: unknown;
}) => {
  const knownError = createUserMutationErrorResponse({
    error: input.error,
    requestId: input.actor.requestId,
    forbiddenFallbackMessage: 'Bulk-Deaktivierung enthält nicht erlaubte Zielnutzer.',
  });
  if (knownError) {
    return knownError;
  }

  const errorBody = {
    error: {
      code: 'internal_error',
      message: 'Bulk-Deaktivierung fehlgeschlagen.',
    },
    ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
  } satisfies ApiErrorResponse;
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId!,
    endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: 500,
    responseBody: errorBody,
  });
  return jsonResponse(500, errorBody);
};
