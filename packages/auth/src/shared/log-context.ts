import { getWorkspaceContext } from '@sva/sdk/server';
import type { RuntimeScopeRef } from '../types.js';
import { DEFAULT_WORKSPACE_ID, PLATFORM_WORKSPACE_ID, getWorkspaceIdForScope } from '../scope.js';

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
  const explicitScopeKind =
    typeof scopeOrWorkspaceId === 'string'
      ? scopeOrWorkspaceId === PLATFORM_WORKSPACE_ID
        ? 'platform'
        : scopeOrWorkspaceId === DEFAULT_WORKSPACE_ID
          ? undefined
          : 'instance'
      : scopeOrWorkspaceId?.kind;
  const base = {
    workspace_id: resolvedWorkspaceId,
    scope_kind: explicitScopeKind,
    instance_id:
      explicitScopeKind === 'instance'
        ? typeof scopeOrWorkspaceId === 'string'
          ? scopeOrWorkspaceId
          : scopeOrWorkspaceId?.kind === 'instance'
            ? scopeOrWorkspaceId.instanceId
            : undefined
        : undefined,
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
