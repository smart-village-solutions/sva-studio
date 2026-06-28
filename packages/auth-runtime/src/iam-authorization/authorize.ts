import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';

import { resolveImpersonationSubject } from '../governance-impersonation.js';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { readString } from '../shared/input-readers.js';
import { resolveEffectivePermissions } from './permission-store.js';
import {
  denyAuthorizeRequest,
  emitPluginActionAuditEvent,
  resolveAuthorizeGeoContext,
} from './authorize-runtime.js';
import { filterTenantEffectivePermissions } from './root-only-permissions.js';
import {
  buildRequestContext,
  errorResponse,
  iamAuthorizeLatencyHistogram,
  loadAuthorizeRequest,
  logger,
} from './shared.js';

const isAuthorizeTimingDebugEnabled = (): boolean =>
  process.env.IAM_DEBUG_AUTHORIZE_TIMINGS === 'true';

const validateAuthorizeImpersonation = async (
  payload: NonNullable<Awaited<ReturnType<typeof loadAuthorizeRequest>>>,
  actorKeycloakSubject: string
): Promise<Response | null> => {
  const actingAsUserId = payload.context?.actingAsUserId;
  if (!actingAsUserId) {
    return null;
  }

  const impersonation = await resolveImpersonationSubject({
    instanceId: payload.instanceId,
    actorKeycloakSubject,
    targetKeycloakSubject: actingAsUserId,
  });

  if (impersonation.ok) {
    return null;
  }

  return denyAuthorizeRequest(
    payload,
    actorKeycloakSubject,
    {
      reason: 'context_attribute_missing',
      instanceId: payload.instanceId,
      action: payload.action,
      resourceType: payload.resource.type,
      resourceId: payload.resource.id,
      requestId: payload.context?.requestId,
      traceId: payload.context?.traceId,
      diagnostics: { stage: 'impersonation', reason_code: impersonation.reasonCode },
    },
    () => undefined
  );
};

export const authorizeHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(
      request,
      async ({ user }) => {
        const startedAt = performance.now();
        const timingDiagnostics = {
          payloadReadMs: 0,
          impersonationMs: 0,
          geoContextMs: 0,
          permissionLookupMs: 0,
          decisionEvaluationMs: 0,
          responseSerializationMs: 0,
        };
        const recordLatency = (allowed: boolean, reason: string) => {
          iamAuthorizeLatencyHistogram.record(performance.now() - startedAt, {
            allowed,
            reason,
            endpoint: '/iam/authorize',
          });
        };

        const payloadReadStartedAt = performance.now();
        const payload = await loadAuthorizeRequest(request);
        timingDiagnostics.payloadReadMs = performance.now() - payloadReadStartedAt;
        if (!payload) {
          recordLatency(false, 'invalid_request');
          return errorResponse(400, 'invalid_request');
        }

        if (!readString(payload.instanceId)) {
          recordLatency(false, 'invalid_instance_id');
          return errorResponse(400, 'invalid_instance_id');
        }

        if (user.instanceId && user.instanceId !== payload.instanceId) {
          return denyAuthorizeRequest(
            payload,
            user.id,
            {
              reason: 'instance_scope_mismatch',
              instanceId: payload.instanceId,
              action: payload.action,
              resourceType: payload.resource.type,
              resourceId: payload.resource.id,
              requestId: payload.context?.requestId,
              traceId: payload.context?.traceId,
            },
            recordLatency
          );
        }

        const actingAsUserId = payload.context?.actingAsUserId;
        const impersonationStartedAt = performance.now();
        const impersonationError = await validateAuthorizeImpersonation(payload, user.id);
        timingDiagnostics.impersonationMs = performance.now() - impersonationStartedAt;
        if (impersonationError) {
          recordLatency(false, 'context_attribute_missing');
          return impersonationError;
        }

        const geoContextStartedAt = performance.now();
        const geoContext = resolveAuthorizeGeoContext(payload);
        timingDiagnostics.geoContextMs = performance.now() - geoContextStartedAt;
        if (geoContext === null) {
          await emitPluginActionAuditEvent(payload, user.id, 'failure', 'invalid_request');
          recordLatency(false, 'invalid_request');
          return errorResponse(400, 'invalid_request');
        }

        const permissionLookupStartedAt = performance.now();
        const resolved = await resolveEffectivePermissions({
          instanceId: payload.instanceId,
          keycloakSubject: actingAsUserId ?? user.id,
          organizationId: payload.context?.organizationId ?? payload.resource.organizationId,
          geoUnitId: geoContext.geoUnitId,
          geoHierarchy: geoContext.geoHierarchy,
        });
        timingDiagnostics.permissionLookupMs = performance.now() - permissionLookupStartedAt;

        if (!resolved.ok) {
          logger.error('Failed to evaluate authorize decision from cache/database', {
            operation: 'authorize',
            error: resolved.error,
            ...buildRequestContext(payload.instanceId),
          });

          await emitPluginActionAuditEvent(payload, user.id, 'failure', 'database_unavailable');
          recordLatency(false, 'database_unavailable');
          return errorResponse(503, 'database_unavailable');
        }

        const decisionEvaluationStartedAt = performance.now();
        const decision = evaluateAuthorizeDecision(
          payload,
          filterTenantEffectivePermissions(resolved.permissions)
        );
        timingDiagnostics.decisionEvaluationMs = performance.now() - decisionEvaluationStartedAt;

        logger[decision.allowed ? 'debug' : 'warn']('Authorize decision evaluated', {
          operation: 'authorize',
          allowed: decision.allowed,
          reason: decision.reason,
          action: payload.action,
          resource_type: payload.resource.type,
          ...buildRequestContext(payload.instanceId),
        });

        await emitPluginActionAuditEvent(
          payload,
          user.id,
          decision.allowed ? 'success' : 'denied',
          decision.reason
        );
        recordLatency(decision.allowed, decision.reason);
        const responseSerializationStartedAt = performance.now();
        const response = jsonResponse(200, {
          ...decision,
          requestId: decision.requestId ?? getWorkspaceContext().requestId,
          traceId: decision.traceId ?? getWorkspaceContext().traceId,
          snapshotVersion: resolved.snapshotVersion ?? null,
          cacheStatus: resolved.cacheStatus,
        });
        timingDiagnostics.responseSerializationMs =
          performance.now() - responseSerializationStartedAt;
        if (isAuthorizeTimingDebugEnabled()) {
          logger.info('Authorize timing diagnostics', {
            operation: 'authorize_timing',
            action: payload.action,
            resource_type: payload.resource.type,
            resource_id: payload.resource.id,
            cache_status: resolved.cacheStatus,
            payload_read_ms: Number(timingDiagnostics.payloadReadMs.toFixed(2)),
            impersonation_ms: Number(timingDiagnostics.impersonationMs.toFixed(2)),
            geo_context_ms: Number(timingDiagnostics.geoContextMs.toFixed(2)),
            permission_lookup_ms: Number(timingDiagnostics.permissionLookupMs.toFixed(2)),
            decision_evaluation_ms: Number(timingDiagnostics.decisionEvaluationMs.toFixed(2)),
            response_serialization_ms: Number(timingDiagnostics.responseSerializationMs.toFixed(2)),
            total_ms: Number((performance.now() - startedAt).toFixed(2)),
            ...buildRequestContext(payload.instanceId),
          });
        }
        return response;
      },
      { skipEffectiveRoleHydration: true }
    );
  });
};
