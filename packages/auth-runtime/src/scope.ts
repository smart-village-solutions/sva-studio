import type { AuthConfig, RuntimeScopeRef, ScopeKind } from './types.js';

export const PLATFORM_WORKSPACE_ID = 'platform';
export const DEFAULT_WORKSPACE_ID = 'default';

export const getWorkspaceIdForScope = (scope?: RuntimeScopeRef): string | undefined => {
  if (!scope) {
    return undefined;
  }

  return scope.kind === 'platform' ? PLATFORM_WORKSPACE_ID : scope.instanceId;
};

export const getRuntimeScopeRef = (input: {
  kind?: ScopeKind;
  scopeKind?: ScopeKind;
  instanceId?: string;
  workspaceId?: string;
}): RuntimeScopeRef | undefined => {
  if (input.kind === 'platform') {
    return { kind: 'platform' };
  }

  if (input.kind === 'instance' && input.instanceId) {
    return { kind: 'instance', instanceId: input.instanceId };
  }

  if (input.scopeKind === 'platform') {
    return { kind: 'platform' };
  }

  if (input.scopeKind === 'instance' && input.instanceId) {
    return { kind: 'instance', instanceId: input.instanceId };
  }

  if (input.instanceId) {
    return { kind: 'instance', instanceId: input.instanceId };
  }

  if (input.workspaceId === PLATFORM_WORKSPACE_ID) {
    return { kind: 'platform' };
  }

  if (input.workspaceId && input.workspaceId !== DEFAULT_WORKSPACE_ID) {
    return { kind: 'instance', instanceId: input.workspaceId };
  }

  return undefined;
};

export const getScopeFromAuthConfig = (authConfig: AuthConfig): RuntimeScopeRef =>
  authConfig.kind === 'platform'
    ? { kind: 'platform' }
    : { kind: 'instance', instanceId: authConfig.instanceId };

export const isPlatformScope = (scope?: RuntimeScopeRef): boolean => scope?.kind === 'platform';
