import type { AuthorizeResponse } from '@sva/core';
import { getWorkspaceContext } from '@sva/sdk/server';

import { emitAuthAuditEvent } from '../audit-events.server.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { jsonResponse } from '../shared/db-helpers.js';

import type { DeniedAuthorizeResponseInput } from './shared.js';
import { loadAuthorizeRequest } from './shared.js';

const MAX_GEO_HIERARCHY_LENGTH = 32;
const ACTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_CORE_ACTION_NAMESPACES = new Set(['content', 'iam', 'core']);

type AuthorizePayload = NonNullable<Awaited<ReturnType<typeof loadAuthorizeRequest>>>;

const readGeoUuid = (value: unknown): string | undefined | null => {
  const normalized = readString(value);
  if (!normalized) {
    return undefined;
  }
  return isUuid(normalized) ? normalized : null;
};

const readGeoUuidArray = (value: unknown): readonly string[] | undefined | null => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return null;
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

const derivePluginActionAuditPayload = (
  payload: AuthorizePayload,
  result: 'success' | 'failure' | 'denied',
  reasonCode?: string
) => {
  if (ACTION_ID_PATTERN.test(payload.action) === false) {
    return undefined;
  }

  const separatorIndex = payload.action.indexOf('.');
  const actionNamespace = payload.action.slice(0, separatorIndex);
  if (RESERVED_CORE_ACTION_NAMESPACES.has(actionNamespace)) {
    return undefined;
  }

  return {
    actionId: payload.action,
    actionNamespace,
    actionOwner: actionNamespace,
    result,
    reasonCode,
    resourceType: payload.resource.type,
    resourceId: payload.resource.id,
  } as const;
};

export const emitPluginActionAuditEvent = async (
  payload: AuthorizePayload,
  actorUserId: string,
  result: 'success' | 'failure' | 'denied',
  reasonCode?: string
) => {
  const pluginAction = derivePluginActionAuditPayload(payload, result, reasonCode);
  if (!pluginAction) {
    return;
  }

  await emitAuthAuditEvent({
    eventType:
      result === 'success'
        ? 'plugin_action_authorized'
        : result === 'denied'
          ? 'plugin_action_denied'
          : 'plugin_action_failed',
    actorUserId,
    workspaceId: payload.instanceId,
    outcome: result,
    requestId: payload.context?.requestId,
    traceId: payload.context?.traceId,
    pluginAction,
  });
};

export const denyAuthorizeRequest = async (
  payload: AuthorizePayload,
  actorUserId: string,
  input: DeniedAuthorizeResponseInput,
  recordLatency: (allowed: boolean, reason: string) => void
): Promise<Response> => {
  const denied = buildDeniedResponse(input);
  await emitPluginActionAuditEvent(payload, actorUserId, 'denied', denied.reason);
  recordLatency(false, denied.reason);
  return jsonResponse(200, denied);
};

export const resolveAuthorizeGeoContext = (
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
