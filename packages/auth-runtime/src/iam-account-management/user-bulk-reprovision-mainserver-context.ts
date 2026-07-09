import type { ApiErrorResponse } from '@sva/core';
import { getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { jsonResponse } from '../db.js';

import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey, toPayloadHash } from './api-helpers.js';
import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
import { bulkReprovisionMainserverSchema } from './schemas.js';
import {
  type UserMutationActor,
  requireUserMutationIdentityProvider,
  resolveUserMutationActor,
} from './user-mutation-request-context.shared.js';
import { createUserMutationErrorResponse } from './user-mutation-errors.js';

type BulkReprovisionPayload = z.infer<typeof bulkReprovisionMainserverSchema>;

type IdentityProviderResult = Awaited<ReturnType<typeof requireUserMutationIdentityProvider>>;

export type BulkReprovisionMainserverContext =
  | Response
  | {
      actor: UserMutationActor;
      identityProvider: Exclude<IdentityProviderResult, Response>;
      payload: BulkReprovisionPayload;
      idempotencyKey: string;
    };

const ENDPOINT = 'POST:/api/v1/iam/users/bulk-reprovision-mainserver';

const completeReservedBulkReprovisionResponse = async (input: {
  actor: UserMutationActor;
  idempotencyKey: string;
  response: Response;
}) => {
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId!,
    endpoint: ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: input.response.status,
    responseBody: await input.response.clone().json(),
  });
  return input.response;
};

const resolveBulkReprovisionPreconditions = async (
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
    requestId: actorResolution.actor.requestId ?? requestContext.requestId ?? 'bulk-reprovision-mainserver',
  };
};

export const resolveBulkReprovisionMainserverContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<BulkReprovisionMainserverContext> => {
  const resolved = await resolveBulkReprovisionPreconditions(request, ctx);
  if (resolved instanceof Response) {
    return resolved;
  }
  const { actor, requestId } = resolved;

  const idempotencyKey = requireIdempotencyKey(request, requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, bulkReprovisionMainserverSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint: ENDPOINT,
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
    return completeReservedBulkReprovisionResponse({
      actor,
      idempotencyKey: idempotencyKey.key,
      response: identityProvider,
    });
  }

  return {
    actor,
    identityProvider,
    payload: parsed.data,
    idempotencyKey: idempotencyKey.key,
  };
};

export const completeBulkReprovisionMainserverSuccess = async (input: {
  actor: UserMutationActor;
  idempotencyKey: string;
  result: {
    successes: readonly { id: string }[];
    failures: readonly { id: string; code: string; message: string }[];
  };
}) => {
  const responseBody = asApiItem(
    {
      successes: input.result.successes,
      failures: input.result.failures,
      successCount: input.result.successes.length,
      failureCount: input.result.failures.length,
    },
    input.actor.requestId
  );
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId!,
    endpoint: ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    status: 'COMPLETED',
    responseStatus: 200,
    responseBody,
  });
  return jsonResponse(200, responseBody);
};

export const completeBulkReprovisionMainserverFailure = async (input: {
  actor: UserMutationActor;
  idempotencyKey: string;
  error: unknown;
}) => {
  const knownError = createUserMutationErrorResponse({
    error: input.error,
    requestId: input.actor.requestId,
    forbiddenFallbackMessage: 'Bulk-Reprovision enthält nicht erlaubte Zielnutzer.',
  });
  if (knownError) {
    const responseBody = await knownError.clone().json();
    await completeIdempotency({
      instanceId: input.actor.instanceId,
      actorAccountId: input.actor.actorAccountId!,
      endpoint: ENDPOINT,
      idempotencyKey: input.idempotencyKey,
      status: 'FAILED',
      responseStatus: knownError.status,
      responseBody,
    });
    return knownError;
  }

  const errorBody = {
    error: {
      code: 'internal_error',
      message: 'Bulk-Reprovision der Mainserver-Daten fehlgeschlagen.',
    },
    ...(input.actor.requestId ? { requestId: input.actor.requestId } : {}),
  } satisfies ApiErrorResponse;
  await completeIdempotency({
    instanceId: input.actor.instanceId,
    actorAccountId: input.actor.actorAccountId!,
    endpoint: ENDPOINT,
    idempotencyKey: input.idempotencyKey,
    status: 'FAILED',
    responseStatus: 500,
    responseBody: errorBody,
  });
  return jsonResponse(500, errorBody);
};
