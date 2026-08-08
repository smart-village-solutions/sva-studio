import type { EffectivePermission } from './authorization-contract.js';

export const uiAccessDecisionReasons = [
  'public_surface',
  'authenticated_surface',
  'authentication_required',
  'snapshot_unresolved',
  'snapshot_loading',
  'snapshot_error',
  'scope_mismatch',
  'platform_role_missing',
  'module_assignment_missing',
  'permission_missing',
  'resource_capability_missing',
  'resource_capability_denied',
  'allowed_by_permission',
  'allowed_by_resource_capability',
] as const;

export type UiAccessDecisionReason = (typeof uiAccessDecisionReasons)[number];

export type UiAccessScope =
  | Readonly<{
      kind: 'platform';
      authGeneration: number;
    }>
  | Readonly<{
      kind: 'tenant';
      authGeneration: number;
      instanceId: string;
      organizationId: string | null;
      moduleAssignmentGeneration: number;
    }>;

export type UiResourceCapability = Readonly<{
  action: string;
  allowed: boolean;
  instanceId: string;
  organizationId?: string | null;
  resourceType: string;
  resourceId: string;
}>;

export type UiAccessRequirement =
  | Readonly<{ kind: 'public' }>
  | Readonly<{ kind: 'authenticated' }>
  | Readonly<{
      kind: 'platform';
      roles: Readonly<{ mode: 'allOf' | 'anyOf'; values: readonly string[] }>;
    }>
  | Readonly<{
      kind: 'tenant';
      actions: Readonly<{ mode: 'allOf' | 'anyOf'; values: readonly string[] }>;
      moduleId?: string;
      resourceCapability?: UiResourceCapability;
    }>;

type PendingEffectiveAccessSnapshot = Readonly<{
  status: 'unresolved' | 'loading';
  scope: UiAccessScope;
  generation: number;
}>;

type ErrorEffectiveAccessSnapshot = Readonly<{
  status: 'error';
  scope: UiAccessScope;
  generation: number;
  errorCode: string;
}>;

type ReadyPlatformAccessSnapshot = Readonly<{
  status: 'ready';
  scope: Extract<UiAccessScope, { kind: 'platform' }>;
  generation: number;
  platformRoles: readonly string[];
}>;

type ReadyTenantAccessSnapshot = Readonly<{
  status: 'ready';
  scope: Extract<UiAccessScope, { kind: 'tenant' }>;
  generation: number;
  assignedModules: readonly string[];
  permissions: readonly EffectivePermission[];
  snapshotVersion?: string;
}>;

export type EffectiveAccessSnapshot =
  | PendingEffectiveAccessSnapshot
  | ErrorEffectiveAccessSnapshot
  | ReadyPlatformAccessSnapshot
  | ReadyTenantAccessSnapshot;

export type UiAccessDecision =
  | Readonly<{ status: 'allowed'; reason: UiAccessDecisionReason }>
  | Readonly<{ status: 'denied'; reason: UiAccessDecisionReason }>
  | Readonly<{ status: 'unresolved'; reason: UiAccessDecisionReason }>
  | Readonly<{ status: 'error'; reason: UiAccessDecisionReason; errorCode: string }>;

export type EvaluateUiAccessInput = Readonly<{
  isAuthenticated: boolean;
  requirement: UiAccessRequirement;
  snapshot?: EffectiveAccessSnapshot;
}>;

const FULLY_QUALIFIED_ACTION_PATTERN = /^[a-z][a-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)+$/;

const isFullyQualifiedAction = (action: string): boolean =>
  FULLY_QUALIFIED_ACTION_PATTERN.test(action);

const satisfiesSet = (
  required: Readonly<{ mode: 'allOf' | 'anyOf'; values: readonly string[] }>,
  available: ReadonlySet<string>
): boolean =>
  required.mode === 'allOf'
    ? required.values.every((value) => available.has(value))
    : required.values.some((value) => available.has(value));

const hasScopedConstraints = (permission: EffectivePermission): boolean =>
  permission.accessScope === 'own' ||
  permission.accessScope === 'organization' ||
  permission.organizationId !== undefined ||
  permission.resourceId !== undefined ||
  permission.geoScope !== undefined ||
  permission.scope !== undefined;

const deny = (reason: UiAccessDecisionReason): UiAccessDecision => ({
  status: 'denied',
  reason,
});

const evaluatePlatformRequirement = (
  requirement: Extract<UiAccessRequirement, { kind: 'platform' }>,
  snapshot: EffectiveAccessSnapshot
): UiAccessDecision => {
  if (snapshot.scope.kind !== 'platform') {
    return deny('scope_mismatch');
  }
  if (snapshot.status !== 'ready' || !('platformRoles' in snapshot)) {
    return deny('scope_mismatch');
  }

  return satisfiesSet(requirement.roles, new Set(snapshot.platformRoles))
    ? { status: 'allowed', reason: 'allowed_by_permission' }
    : deny('platform_role_missing');
};

const capabilityMatchesScope = (
  capability: UiResourceCapability,
  scope: Extract<UiAccessScope, { kind: 'tenant' }>,
  action: string
): boolean =>
  capability.action === action &&
  capability.instanceId === scope.instanceId &&
  (capability.organizationId === undefined || capability.organizationId === scope.organizationId);

const evaluateTenantRequirement = (
  requirement: Extract<UiAccessRequirement, { kind: 'tenant' }>,
  snapshot: EffectiveAccessSnapshot
): UiAccessDecision => {
  if (
    snapshot.scope.kind !== 'tenant' ||
    snapshot.status !== 'ready' ||
    !('assignedModules' in snapshot) ||
    !('permissions' in snapshot)
  ) {
    return deny('scope_mismatch');
  }
  if (requirement.actions.values.length === 0 || requirement.actions.values.some((action) => !isFullyQualifiedAction(action))) {
    return deny('permission_missing');
  }
  if (requirement.moduleId && !snapshot.assignedModules.includes(requirement.moduleId)) {
    return deny('module_assignment_missing');
  }

  const permissionsByAction = new Map<string, readonly EffectivePermission[]>();
  for (const action of requirement.actions.values) {
    permissionsByAction.set(
      action,
      snapshot.permissions.filter((permission) => permission.action === action)
    );
  }

  const unscopedActions = new Set(
    [...permissionsByAction.entries()]
      .filter(([, permissions]) => permissions.some((permission) => !hasScopedConstraints(permission)))
      .map(([action]) => action)
  );
  if (satisfiesSet(requirement.actions, unscopedActions)) {
    return { status: 'allowed', reason: 'allowed_by_permission' };
  }

  const presentActions = new Set(
    [...permissionsByAction.entries()]
      .filter(([, permissions]) => permissions.length > 0)
      .map(([action]) => action)
  );
  if (!satisfiesSet(requirement.actions, presentActions)) {
    return deny('permission_missing');
  }

  const capability = requirement.resourceCapability;
  if (!capability) {
    return deny('resource_capability_missing');
  }
  if (!capability.allowed) {
    return deny('resource_capability_denied');
  }

  const scopedActions = requirement.actions.values.filter((action) => !unscopedActions.has(action));
  const matchingScopedActions = new Set(
    scopedActions.filter((action) => capabilityMatchesScope(capability, snapshot.scope, action))
  );
  const actionRequirement = {
    mode: requirement.actions.mode,
    values: scopedActions,
  } as const;

  return satisfiesSet(actionRequirement, matchingScopedActions)
    ? { status: 'allowed', reason: 'allowed_by_resource_capability' }
    : deny('resource_capability_missing');
};

export const evaluateUiAccess = (input: EvaluateUiAccessInput): UiAccessDecision => {
  if (input.requirement.kind === 'public') {
    return { status: 'allowed', reason: 'public_surface' };
  }
  if (!input.isAuthenticated) {
    return deny('authentication_required');
  }
  if (input.requirement.kind === 'authenticated') {
    return { status: 'allowed', reason: 'authenticated_surface' };
  }

  const snapshot = input.snapshot;
  if (!snapshot || snapshot.status === 'unresolved') {
    return { status: 'unresolved', reason: 'snapshot_unresolved' };
  }
  if (snapshot.status === 'loading') {
    return { status: 'unresolved', reason: 'snapshot_loading' };
  }
  if (snapshot.status === 'error') {
    return { status: 'error', reason: 'snapshot_error', errorCode: snapshot.errorCode };
  }

  return input.requirement.kind === 'platform'
    ? evaluatePlatformRequirement(input.requirement, snapshot)
    : evaluateTenantRequirement(input.requirement, snapshot);
};
