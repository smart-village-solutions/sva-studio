import { getWorkspaceContext } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../middleware.js';
import { resolveInstanceId } from '../shared/instance-id-resolution.js';

import { createApiError, readInstanceIdFromRequest } from './api-helpers.js';
import { addActiveSpanEvent, annotateActiveSpan } from './diagnostics.js';
import {
  createInstanceLookupError,
  createMissingActorMembershipError,
  resolveActorAccountIdWithProvision,
  resolveMissingActorDiagnosticReason,
} from './shared-actor-resolution-helpers.js';
import { logger } from './shared-observability.js';
import { resolvePool } from './shared-runtime.js';
import type { ActorInfo, ResolveActorOptions } from './types.js';

export type { ActorInfo } from './types.js';
export { resolveActorAccountId } from '@sva/iam-admin';

const resolveActorInstanceId = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options?: ResolveActorOptions
) => {
  const explicitInstanceId = new URL(request.url).searchParams.get('instanceId') ?? undefined;
  const requestedInstanceId = readInstanceIdFromRequest(request, ctx.user.instanceId);
  if (requestedInstanceId !== undefined) {
    if (options?.createMissingInstanceFromKey !== true || explicitInstanceId === undefined) {
      return {
        ok: true as const,
        instanceId: requestedInstanceId,
        fromInstanceKey: false,
        created: false,
      };
    }
  }

  return resolveInstanceId({
    resolvePool,
    candidate: requestedInstanceId,
    createIfMissingFromKey: options?.createMissingInstanceFromKey,
    displayNameForCreate: requestedInstanceId,
  });
};

export const requireRoles = (
  ctx: AuthenticatedRequestContext,
  roles: ReadonlySet<string>,
  requestId?: string
) => {
  const hasRole = ctx.user.roles.some((role) => roles.has(role));
  if (!hasRole) {
    annotateActiveSpan({
      'iam.actor_roles': ctx.user.roles.join(','),
      'iam.reason_code': 'missing_required_role',
      'iam.required_roles': [...roles].join(','),
    });
    addActiveSpanEvent('iam.role_guard_rejected', {
      'iam.reason_code': 'missing_required_role',
    });
    logger.warn('IAM role guard rejected request', {
      operation: 'require_roles',
      required_roles: [...roles],
      user_roles: ctx.user.roles,
      session_instance_id: ctx.user.instanceId,
      request_id: requestId,
    });
    return createApiError(403, 'forbidden', 'Unzureichende Berechtigungen.', requestId);
  }
  return null;
};

const createInstanceLookupFailureResponse = (input: {
  resolvedInstance: { reason: 'database_unavailable' | 'missing_instance' | 'invalid_instance' };
  requestId?: string;
  requestedInstanceId?: string;
  sessionInstanceId?: string;
  traceId?: string;
}) => {
  const { status, code, message } = createInstanceLookupError(
    input.resolvedInstance,
    input.requestId,
    input.requestedInstanceId
  );
  logger.warn('IAM actor resolution failed during instance lookup', {
    operation: 'resolve_actor',
    requested_instance_id: input.requestedInstanceId,
    session_instance_id: input.sessionInstanceId,
    reason_code: code,
    request_id: input.requestId,
    trace_id: input.traceId,
  });
  return {
    error: createApiError(status, code, message, input.requestId, {
      dependency: input.resolvedInstance.reason === 'database_unavailable' ? 'database' : undefined,
      reason_code:
        input.resolvedInstance.reason === 'database_unavailable'
          ? 'instance_lookup_failed'
          : 'invalid_instance_id',
      ...(input.requestedInstanceId ? { instance_id: input.requestedInstanceId } : {}),
    }),
  };
};

const resolveActorAccountLookup = async (input: {
  instanceId: string;
  ctx: AuthenticatedRequestContext;
  mayProvisionMissingActorMembership: boolean;
  requestId?: string;
  traceId?: string;
}): Promise<string | undefined | { error: Response }> => {
  try {
    return await resolveActorAccountIdWithProvision({
      instanceId: input.instanceId,
      keycloakSubject: input.ctx.user.id,
      requestId: input.requestId,
      traceId: input.traceId,
      mayProvisionMissingActorMembership: input.mayProvisionMissingActorMembership,
    });
  } catch (error) {
    annotateActiveSpan({
      'dependency.database.status': 'error',
      'iam.actor_resolution': 'database_unavailable',
      'iam.reason_code': 'actor_lookup_failed',
    });
    addActiveSpanEvent('iam.actor_resolution_failed', {
      'iam.reason_code': 'actor_lookup_failed',
      'iam.instance_id': input.instanceId,
    });
    logger.error('IAM actor resolution failed during account lookup', {
      operation: 'resolve_actor',
      instance_id: input.instanceId,
      session_instance_id: input.ctx.user.instanceId,
      request_id: input.requestId,
      trace_id: input.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error: createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', input.requestId),
    };
  }
};


export const resolveActorInfo = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options?: ResolveActorOptions
): Promise<{ actor: ActorInfo } | { error: Response }> => {
  const requestedInstanceId = readInstanceIdFromRequest(request, ctx.user.instanceId);
  const requestContext = getWorkspaceContext();
  const resolvedInstance = await resolveActorInstanceId(request, ctx, options);
  if (!resolvedInstance.ok) {
    return createInstanceLookupFailureResponse({
      resolvedInstance,
      requestId: requestContext.requestId,
      requestedInstanceId,
      sessionInstanceId: ctx.user.instanceId,
      traceId: requestContext.traceId,
    });
  }

  const instanceId = resolvedInstance.instanceId;
  annotateActiveSpan({
    'iam.instance_id': instanceId,
    'iam.actor_resolution': 'instance_resolved',
  });
  const mayProvisionMissingActorMembership =
    options?.provisionMissingActorMembership === true &&
    (!requestedInstanceId || requestedInstanceId === ctx.user.instanceId);

  const actorAccountLookup = await resolveActorAccountLookup({
      instanceId,
      ctx,
      mayProvisionMissingActorMembership,
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
    });
  if (actorAccountLookup && typeof actorAccountLookup === 'object' && 'error' in actorAccountLookup) {
    return actorAccountLookup;
  }
  const actorAccountId = actorAccountLookup;

  if (options?.requireActorMembership && !actorAccountId) {
    const diagnosticReason = await resolveMissingActorDiagnosticReason(instanceId, ctx.user.id);
    return createMissingActorMembershipError({
      diagnosticReason,
      instanceId,
      userId: ctx.user.id,
      sessionInstanceId: ctx.user.instanceId,
      mayProvisionMissingActorMembership,
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
    });
  }

  annotateActiveSpan({
    'iam.actor_account_present': Boolean(actorAccountId),
    'iam.actor_resolution': actorAccountId ? 'resolved' : 'resolved_without_account',
  });

  return {
    actor: {
      instanceId,
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
      actorAccountId,
    },
  };
};
