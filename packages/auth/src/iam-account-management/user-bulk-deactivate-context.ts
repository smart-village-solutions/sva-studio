import type { ApiErrorResponse } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { ADMIN_ROLES } from './constants.js';
import { asApiItem, createApiError, parseRequestBody, requireIdempotencyKey, toPayloadHash } from './api-helpers.js';
import { validateCsrf } from './csrf.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { type ActorInfo, requireRoles, resolveActorInfo } from './shared-actor-resolution.js';
import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';
import { resolveIdentityProvider } from './shared-runtime.js';
import { bulkDeactivateSchema } from './schemas.js';
import { createUserMutationErrorResponse } from './user-mutation-errors.js';

type BulkDeactivatePayload = z.infer<typeof bulkDeactivateSchema>;

export type BulkDeactivateContext =
  | Response
  | {
      actor: ActorInfo;
      identityProvider: NonNullable<ReturnType<typeof resolveIdentityProvider>>;
      payload: BulkDeactivatePayload;
      idempotencyKey: string;
    };

const resolveBulkDeactivatePreconditions = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response | { actor: ActorInfo & { actorAccountId: string; requestId: string }; requestId: string }> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_bulk', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, {
    requireActorMembership: true,
    provisionMissingActorMembership: true,
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  return {
    actor: actorResolution.actor as ActorInfo & { actorAccountId: string; requestId: string },
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

  const csrfError = validateCsrf(request, requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'bulk',
    requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

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

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      requestId
    );
  }

  return {
    actor,
    identityProvider,
    payload: parsed.data,
    idempotencyKey: idempotencyKey.key,
  };
};

export const completeBulkDeactivateSuccess = async (input: {
  actor: ActorInfo;
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
  actor: ActorInfo;
  idempotencyKey: string;
  error: unknown;
}) => {
  const knownError = createUserMutationErrorResponse({
    error: input.error,
    requestId: input.actor.requestId,
    fallbackMessage: 'Bulk-Deaktivierung fehlgeschlagen.',
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
