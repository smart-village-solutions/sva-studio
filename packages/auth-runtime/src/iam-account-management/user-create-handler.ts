import type { ApiErrorResponse } from '@sva/core';
import {
  createCreateUserHandlerInternal,
  type CreateUserHandlerDeps,
} from '@sva/iam-admin';
import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { jsonResponse } from '../db.js';

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
import type { IdentityProviderResolution } from './shared-runtime.js';
import { validateCsrf } from './csrf.js';
import { createUserMutationErrorResponse } from './user-mutation-errors.js';
import { executeCreateUser } from './user-create-operation.js';
import type { CreateUserPayload } from './user-create-persistence.js';

type CreateUserActorContext = {
  actor: {
    instanceId: string;
    actorAccountId: string;
    requestId?: string;
    traceId?: string;
  };
  actorSubject: string;
};

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

type CreateUserResult = Awaited<ReturnType<typeof executeCreateUser>>;

const executeCreateUserWithKnownErrors: CreateUserHandlerDeps<
  CreateUserPayload,
  IdentityProviderResolution,
  CreateUserResult
>['executeCreateUser'] = async (input) => {
  try {
    return await executeCreateUser({
      ...input,
      payload: {
        ...input.payload,
        roleIds: [...input.payload.roleIds],
        groupIds: input.payload.groupIds ? [...input.payload.groupIds] : [],
      },
    });
  } catch (error) {
    const knownError = createUserMutationErrorResponse({
      error,
      requestId: input.actor.requestId,
      forbiddenFallbackMessage: 'Nutzer enthält unzulässige Rollen- oder Gruppenzuweisungen.',
    });
    if (knownError) {
      throw knownError;
    }
    throw error;
  }
};

export const createUserInternal = createCreateUserHandlerInternal({
  asApiItem,
  completeIdempotency,
  createApiError,
  createIdpUnavailableBody,
  executeCreateUser: executeCreateUserWithKnownErrors,
  iamUserOperationsCounter,
  jsonResponse,
  parseCreateUserBody: (request) => parseRequestBody(request, createUserSchema),
  requireIdempotencyKey,
  reserveIdempotency,
  resolveCreateUserActorContext,
  resolveIdentityProviderForInstance,
  toPayloadHash,
});
