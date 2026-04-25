import { getWorkspaceContext } from '@sva/server-runtime';

import { DEFAULT_WORKSPACE_ID, PLATFORM_WORKSPACE_ID, getWorkspaceIdForScope } from './scope.js';
import type { RuntimeScopeRef } from './types.js';

const resolveScopeKind = (scopeOrWorkspaceId?: RuntimeScopeRef | string): RuntimeScopeRef['kind'] | undefined => {
  if (typeof scopeOrWorkspaceId !== 'string') {
    return scopeOrWorkspaceId?.kind;
  }

  if (scopeOrWorkspaceId === PLATFORM_WORKSPACE_ID) {
    return 'platform';
  }

  if (scopeOrWorkspaceId === DEFAULT_WORKSPACE_ID) {
    return undefined;
  }

  return 'instance';
};

const resolveInstanceId = (
  scopeOrWorkspaceId: RuntimeScopeRef | string | undefined,
  scopeKind: RuntimeScopeRef['kind'] | undefined
): string | undefined => {
  if (scopeKind !== 'instance') {
    return undefined;
  }

  return typeof scopeOrWorkspaceId === 'string'
    ? scopeOrWorkspaceId
    : scopeOrWorkspaceId?.kind === 'instance'
      ? scopeOrWorkspaceId.instanceId
      : undefined;
};

export const buildLogContext = (
  scopeOrWorkspaceId?: RuntimeScopeRef | string,
  options?: { includeTraceId?: boolean }
): Record<string, string | undefined> => {
  const context = getWorkspaceContext();
  const explicitWorkspaceId =
    typeof scopeOrWorkspaceId === 'string'
      ? scopeOrWorkspaceId
      : getWorkspaceIdForScope(scopeOrWorkspaceId);
  const resolvedWorkspaceId = explicitWorkspaceId ?? context.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const explicitScopeKind = resolveScopeKind(scopeOrWorkspaceId);
  const base = {
    workspace_id: resolvedWorkspaceId,
    scope_kind: explicitScopeKind,
    instance_id: resolveInstanceId(scopeOrWorkspaceId, explicitScopeKind),
    request_id: context.requestId,
  };

  if (options?.includeTraceId) {
    return {
      ...base,
      trace_id: context.traceId,
    };
  }

  return base;
};
