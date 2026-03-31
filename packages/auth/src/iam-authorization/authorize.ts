import type { AuthorizeResponse } from '@sva/core';
import { evaluateAuthorizeDecision } from '@sva/core';
import { getWorkspaceContext, withRequestContext } from '@sva/sdk/server';

import { resolveImpersonationSubject } from '../iam-governance.server.js';
import { withAuthenticatedUser } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { resolveEffectivePermissions } from './permission-store.js';
import {
  buildRequestContext,
  type DeniedAuthorizeResponseInput,
  errorResponse,
  iamAuthorizeLatencyHistogram,
  loadAuthorizeRequest,
  logger,
} from './shared.js';

const MAX_GEO_HIERARCHY_LENGTH = 32;

const readGeoUuid = (value: unknown): string | undefined | null => {
  const normalized = readString(value);
  if (!normalized) {
    return undefined;
  }
  return isUuid(normalized) ? normalized : null;
};

const readGeoUuidArray = (value: unknown): readonly string[] | undefined | null => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => readGeoUuid(entry))
    .filter((entry): entry is string | null => entry !== undefined);

  if (normalized.some((entry) => entry === null)) {
    return null;
  }

  const deduplicated = [...new Set(normalized)].filter((entry): entry is string => entry !== null);
  if (deduplicated.length > MAX_GEO_HIERARCHY_LENGTH) {
    return null;
  }

  return deduplicated.length > 0 ? deduplicated : undefined;
};

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

const denyAuthorizeRequest = (
  input: DeniedAuthorizeResponseInput,
  recordLatency: (allowed: boolean, reason: string) => void
): Response => {
  const denied = buildDeniedResponse(input);
  recordLatency(false, denied.reason);
  return jsonResponse(200, denied);
};

const resolveAuthorizeGeoContext = (
  payload: Awaited<ReturnType<typeof loadAuthorizeRequest>>
): { geoUnitId?: string; geoHierarchy?: readonly string[] } | null => {
  const resourceGeoUnitId = readGeoUuid(payload?.resource.attributes?.geoUnitId);
  const contextGeoUnitId = readGeoUuid(payload?.context?.attributes?.geoUnitId);
  const resourceGeoHierarchy = readGeoUuidArray(payload?.resource.attributes?.geoHierarchy);
  const contextGeoHierarchy = readGeoUuidArray(payload?.context?.attributes?.geoHierarchy);

  if (
    resourceGeoUnitId === null ||
    contextGeoUnitId === null ||
    resourceGeoHierarchy === null ||
    contextGeoHierarchy === null
  ) {
    return null;
  }

  return {
    geoUnitId: resourceGeoUnitId ?? contextGeoUnitId,
    geoHierarchy: resourceGeoHierarchy ?? contextGeoHierarchy,
  };
};

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
        return denyAuthorizeRequest(
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
      const impersonationError = await validateAuthorizeImpersonation(payload, user.id);
      if (impersonationError) {
        recordLatency(false, 'context_attribute_missing');
        return impersonationError;
      }

      const geoContext = resolveAuthorizeGeoContext(payload);
      if (geoContext === null) {
        recordLatency(false, 'invalid_request');
        return errorResponse(400, 'invalid_request');
      }

      const resolved = await resolveEffectivePermissions({
        instanceId: payload.instanceId,
        keycloakSubject: actingAsUserId ?? user.id,
        organizationId: payload.context?.organizationId ?? payload.resource.organizationId,
        geoUnitId: geoContext.geoUnitId,
        geoHierarchy: geoContext.geoHierarchy,
      });

      if (!resolved.ok) {
        logger.error('Failed to evaluate authorize decision from cache/database', {
          operation: 'authorize',
          error: resolved.error,
          ...buildRequestContext(payload.instanceId),
        });

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
      return jsonResponse(200, {
        ...decision,
        requestId: decision.requestId ?? getWorkspaceContext().requestId,
        traceId: decision.traceId ?? getWorkspaceContext().traceId,
        snapshotVersion: resolved.snapshotVersion ?? null,
        cacheStatus: resolved.cacheStatus,
      });
    });
  });
};
