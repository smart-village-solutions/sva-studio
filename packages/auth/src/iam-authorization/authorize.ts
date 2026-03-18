import type { AuthorizeResponse } from '@sva/core';
import { evaluateAuthorizeDecision } from '@sva/core';
import { createHash } from 'node:crypto';
import { getWorkspaceContext, withRequestContext } from '@sva/sdk/server';

import { resolveImpersonationSubject } from '../iam-governance.server';
import { withAuthenticatedUser } from '../middleware.server';
import { jsonResponse } from '../shared/db-helpers';
import { readString } from '../shared/input-readers';
import { resolveEffectivePermissions } from './permission-store';
import {
  buildRequestContext,
  type DeniedAuthorizeResponseInput,
  errorResponse,
  iamAuthorizeLatencyHistogram,
  loadAuthorizeRequest,
  logger,
} from './shared';

const buildDeniedResponse = (input: DeniedAuthorizeResponseInput): AuthorizeResponse => ({
  allowed: false,
  reason: input.reason,
  instanceId: input.instanceId,
  action: input.action,
  resourceType: input.resourceType,
  resourceId: input.resourceId,
  evaluatedAt: new Date().toISOString(),
  requestId: input.requestId ?? getWorkspaceContext().requestId,
  traceId: input.traceId ?? getWorkspaceContext().traceId,
  diagnostics: input.diagnostics,
});

export const authorizeHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const startedAt = performance.now();
      const recordLatency = (allowed: boolean, reason: string) => {
        iamAuthorizeLatencyHistogram.record(performance.now() - startedAt, {
          allowed,
          reason,
          endpoint: '/iam/authorize',
        });
      };

      const payload = await loadAuthorizeRequest(request);
      if (!payload) {
        recordLatency(false, 'invalid_request');
        return errorResponse(400, 'invalid_request');
      }

      if (!readString(payload.instanceId)) {
        recordLatency(false, 'invalid_instance_id');
        return errorResponse(400, 'invalid_instance_id');
      }

      if (user.instanceId && user.instanceId !== payload.instanceId) {
        const denied = buildDeniedResponse({
          reason: 'instance_scope_mismatch',
          instanceId: payload.instanceId,
          action: payload.action,
          resourceType: payload.resource.type,
          resourceId: payload.resource.id,
          requestId: payload.context?.requestId,
          traceId: payload.context?.traceId,
        });

        recordLatency(false, denied.reason);
        return jsonResponse(200, denied);
      }

      const actingAsUserId = payload.context?.actingAsUserId;
      if (actingAsUserId) {
        const impersonation = await resolveImpersonationSubject({
          instanceId: payload.instanceId,
          actorKeycloakSubject: user.id,
          targetKeycloakSubject: actingAsUserId,
        });

        if (!impersonation.ok) {
          const denied = buildDeniedResponse({
            reason: 'context_attribute_missing',
            instanceId: payload.instanceId,
            action: payload.action,
            resourceType: payload.resource.type,
            resourceId: payload.resource.id,
            requestId: payload.context?.requestId,
            traceId: payload.context?.traceId,
            diagnostics: { stage: 'impersonation', reason_code: impersonation.reasonCode },
          });

          recordLatency(false, denied.reason);
          return jsonResponse(200, denied);
        }
      }

      const resolved = await resolveEffectivePermissions({
        instanceId: payload.instanceId,
        keycloakSubject: actingAsUserId ?? user.id,
        organizationId: payload.context?.organizationId ?? payload.resource.organizationId,
      });

      if (!resolved.ok) {
        logger.error('Failed to evaluate authorize decision from cache/database', {
          operation: 'authorize',
          error: resolved.error,
          ...buildRequestContext(payload.instanceId),
        });

        if (resolved.error === 'cache_stale_guard') {
          const denied = buildDeniedResponse({
            reason: 'cache_stale_guard',
            instanceId: payload.instanceId,
            action: payload.action,
            resourceType: payload.resource.type,
            resourceId: payload.resource.id,
            requestId: payload.context?.requestId,
            traceId: payload.context?.traceId,
          });

          recordLatency(false, denied.reason);
          return jsonResponse(200, denied);
        }

        recordLatency(false, 'database_unavailable');
        return errorResponse(503, 'database_unavailable');
      }

      const decision = evaluateAuthorizeDecision(payload, resolved.permissions);

      logger[decision.allowed ? 'debug' : 'warn']('Authorize decision evaluated', {
        operation: 'authorize',
        allowed: decision.allowed,
        reason: decision.reason,
        action: payload.action,
        resource_type: payload.resource.type,
        ...buildRequestContext(payload.instanceId),
      });

      recordLatency(decision.allowed, decision.reason);
      const snapshotVersion = createHash('sha256')
        .update(JSON.stringify(resolved.permissions))
        .digest('hex')
        .slice(0, 16);

      return jsonResponse(200, {
        ...decision,
        requestId: decision.requestId ?? getWorkspaceContext().requestId,
        traceId: decision.traceId ?? getWorkspaceContext().traceId,
        snapshotVersion,
        cacheStatus: resolved.cacheStatus,
      });
    });
  });
};
