import type { ApiErrorResponse } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { ADMIN_ROLES } from './constants.js';
import {
  asApiItem,
  createApiError,
  parseRequestBody,
  requireIdempotencyKey,
  toPayloadHash,
} from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { createUserSchema } from './schemas.js';
import {
  completeIdempotency,
  iamUserOperationsCounter,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  resolveIdentityProviderForInstance,
} from './shared.js';
import { validateCsrf } from './csrf.js';
import { executeCreateUser } from './user-create-operation.js';

type CreateUserActorContext = {
  actor: {
    instanceId: string;
    actorAccountId: string;
    requestId?: string;
    traceId?: string;
  };
  actorSubject: string;
};

const CREATE_USER_ENDPOINT = 'POST:/api/v1/iam/users';

const resolveCreateUserActorContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<CreateUserActorContext | Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
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

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  return {
    actor: {
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      requestId: actorResolution.actor.requestId,
      traceId: actorResolution.actor.traceId,
    },
    actorSubject: ctx.user.id,
  };
};

const createIdpUnavailableBody = (requestId?: string) =>
  ({
    error: {
      code: 'keycloak_unavailable',
      message: 'Keycloak Admin API ist nicht konfiguriert.',
    },
    ...(requestId ? { requestId } : {}),
  }) satisfies ApiErrorResponse;

const failCreateIdempotency = async (
  actor: CreateUserActorContext['actor'],
  idempotencyKey: string,
  responseStatus: number,
  responseBody: ApiErrorResponse
): Promise<Response> => {
  await completeIdempotency({
    instanceId: actor.instanceId,
    actorAccountId: actor.actorAccountId,
    endpoint: CREATE_USER_ENDPOINT,
    idempotencyKey,
    status: 'FAILED',
    responseStatus,
    responseBody,
  });
  return jsonResponse(responseStatus, responseBody);
};

export const createUserInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const actorContext = await resolveCreateUserActorContext(request, ctx);
  if (actorContext instanceof Response) {
    return actorContext;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorContext.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createUserSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorContext.actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actorContext.actor.instanceId,
    actorAccountId: actorContext.actor.actorAccountId,
    endpoint: CREATE_USER_ENDPOINT,
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorContext.actor.requestId);
  }

  const identityProvider = await resolveIdentityProviderForInstance(actorContext.actor.instanceId);
  if (!identityProvider) {
    return failCreateIdempotency(
      actorContext.actor,
      idempotencyKey.key,
      503,
      createIdpUnavailableBody(actorContext.actor.requestId)
    );
  }

  try {
    const result = await executeCreateUser({
      actor: {
        ...actorContext.actor,
        actorRoles: ctx.user.roles,
      },
      actorSubject: actorContext.actorSubject,
      identityProvider,
      payload: parsed.data,
    });
    const responseBody = asApiItem(result.responseData, actorContext.actor.requestId);
    await completeIdempotency({
      instanceId: actorContext.actor.instanceId,
      actorAccountId: actorContext.actor.actorAccountId,
      endpoint: CREATE_USER_ENDPOINT,
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });
    iamUserOperationsCounter.add(1, { action: 'create_user', result: 'success' });
    return jsonResponse(201, responseBody);
  } catch {
    iamUserOperationsCounter.add(1, { action: 'create_user', result: 'failure' });
    return failCreateIdempotency(actorContext.actor, idempotencyKey.key, 500, {
      error: {
        code: 'internal_error',
        message: 'Nutzer konnte nicht erstellt werden.',
      },
      ...(actorContext.actor.requestId ? { requestId: actorContext.actor.requestId } : {}),
    });
  }
};
