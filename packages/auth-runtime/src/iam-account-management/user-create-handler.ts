import type { ApiErrorResponse } from '@sva/core';
import {
  createCreateUserHandlerInternal,
  type CreateUserHandlerDeps,
} from '@sva/iam-admin';

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
import { createUserSchema } from './schemas.js';
import {
  completeIdempotency,
  iamUserOperationsCounter,
  reserveIdempotency,
  resolveIdentityProviderForInstance,
} from './shared.js';
import type { IdentityProviderResolution } from './shared-runtime.js';
import { createUserMutationErrorResponse } from './user-mutation-errors.js';
import { executeCreateUser } from './user-create-operation.js';
import type { CreateUserPayload } from './user-create-persistence.js';
import { resolveMutationActorWithAccount } from './mutation-request-context.shared.js';

type CreateUserActorContext = {
  actor: {
    instanceId: string;
    actorAccountId: string;
    activeOrganizationId?: string;
    requestId?: string;
    traceId?: string;
  };
  actorSubject: string;
};

const resolveCreateUserActorContext = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<CreateUserActorContext | Response> => {
  const actorResolution = await resolveMutationActorWithAccount(request, ctx, {
    allowedRoles: ADMIN_ROLES,
    requiredPermissionAction: 'iam.user.write',
    feature: 'iam_admin',
    scope: 'write',
    provisionMissingActorMembership: true,
  });
  if ('response' in actorResolution) {
    return actorResolution.response;
  }

  return {
    actor: {
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      activeOrganizationId: ctx.activeOrganizationId,
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

export const executeCreateUserWithKnownErrors: CreateUserHandlerDeps<
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
