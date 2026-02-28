import type { AuthorizeRequest, AuthorizeResponse, EffectivePermission } from './authorization-contract';

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readBoolean = (value: unknown): boolean | undefined => {
  if (typeof value !== 'boolean') {
    return undefined;
  }
  return value;
};

const readStringArray = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
};

const readRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
};

const readOrganizationScope = (request: AuthorizeRequest): string | undefined => {
  return request.context?.organizationId ?? request.resource.organizationId;
};

const isPermissionMatch = (
  request: AuthorizeRequest,
  permission: EffectivePermission,
  targetOrganizationId: string | undefined,
  hierarchyPath: readonly string[] | undefined
): boolean => {
  if (permission.action !== request.action || permission.resourceType !== request.resource.type) {
    return false;
  }

  if (!permission.organizationId) {
    return true;
  }

  if (!targetOrganizationId) {
    return false;
  }

  if (permission.organizationId === targetOrganizationId) {
    return true;
  }

  if (!hierarchyPath || hierarchyPath.length === 0) {
    return false;
  }

  const permissionIndex = hierarchyPath.indexOf(permission.organizationId);
  const targetIndex = hierarchyPath.indexOf(targetOrganizationId);
  if (permissionIndex < 0 || targetIndex < 0) {
    return false;
  }

  // Parent grants may be inherited by descendants unless restricted downstream.
  return permissionIndex <= targetIndex;
};

const parseClockMinutes = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

const isWithinWindow = (currentMinutes: number, startMinutes: number, endMinutes: number): boolean => {
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};

const evaluateAbacRules = (
  request: AuthorizeRequest,
  attributes: Readonly<Record<string, unknown>> | undefined,
  targetOrganizationId: string | undefined
): { allowed: boolean; reason: AuthorizeResponse['reason']; hasActiveRules: boolean } => {
  if (!attributes) {
    return { allowed: true, reason: 'allowed_by_rbac', hasActiveRules: false };
  }

  const requiredGeoScope = readBoolean(attributes.requireGeoScope) ?? false;
  const resourceAttributes = readRecord(request.resource.attributes);
  const resourceGeoScope =
    readString(resourceAttributes?.geoScope) ?? readString(attributes.geoScope) ?? undefined;
  const allowedGeoScopes = readStringArray(attributes.allowedGeoScopes);
  const restrictedOrganizationIds = readStringArray(attributes.restrictedOrganizationIds);
  const shouldForceDeny = readBoolean(attributes.forceDeny) ?? false;

  if (requiredGeoScope && !resourceGeoScope) {
    return { allowed: false, reason: 'context_attribute_missing', hasActiveRules: true };
  }

  if (restrictedOrganizationIds && targetOrganizationId && restrictedOrganizationIds.includes(targetOrganizationId)) {
    return { allowed: false, reason: 'hierarchy_restriction', hasActiveRules: true };
  }

  if (allowedGeoScopes && resourceGeoScope && !allowedGeoScopes.includes(resourceGeoScope)) {
    return { allowed: false, reason: 'abac_condition_unmet', hasActiveRules: true };
  }

  const timeWindow = readRecord(attributes.timeWindow);
  const startClock = readString(timeWindow?.start);
  const endClock = readString(timeWindow?.end);
  const currentClock = readString(attributes.currentTime);
  if (startClock && endClock) {
    const startMinutes = parseClockMinutes(startClock);
    const endMinutes = parseClockMinutes(endClock);
    if (startMinutes === null || endMinutes === null) {
      return { allowed: false, reason: 'abac_condition_unmet', hasActiveRules: true };
    }

    const reference = currentClock ?? new Date().toISOString().slice(11, 16);
    const currentMinutes = parseClockMinutes(reference);
    if (currentMinutes === null || !isWithinWindow(currentMinutes, startMinutes, endMinutes)) {
      return { allowed: false, reason: 'abac_condition_unmet', hasActiveRules: true };
    }
  }

  if ((readBoolean(attributes.requireActingAs) ?? false) && !request.context?.actingAsUserId) {
    return { allowed: false, reason: 'context_attribute_missing', hasActiveRules: true };
  }

  if (shouldForceDeny) {
    return { allowed: false, reason: 'policy_conflict_restrictive_wins', hasActiveRules: true };
  }

  const hasRules = Boolean(
    requiredGeoScope ||
      allowedGeoScopes ||
      restrictedOrganizationIds ||
      timeWindow ||
      shouldForceDeny ||
      (readBoolean(attributes.requireActingAs) ?? false)
  );
  return { allowed: true, reason: hasRules ? 'allowed_by_abac' : 'allowed_by_rbac', hasActiveRules: hasRules };
};

export const evaluateAuthorizeDecision = (
  request: AuthorizeRequest,
  permissions: readonly EffectivePermission[]
): AuthorizeResponse => {
  const contextAttributes = readRecord(request.context?.attributes);
  const resourceAttributes = readRecord(request.resource.attributes);
  const targetOrganizationId = readOrganizationScope(request);

  // Stage 1: instance scope enforcement.
  const scopedInstance =
    readString(contextAttributes?.instanceId) ?? readString(resourceAttributes?.instanceId) ?? request.instanceId;
  if (scopedInstance !== request.instanceId) {
    return {
      allowed: false,
      reason: 'instance_scope_mismatch',
      instanceId: request.instanceId,
      action: request.action,
      resourceType: request.resource.type,
      resourceId: request.resource.id,
      requestId: request.context?.requestId,
      traceId: request.context?.traceId,
      evaluatedAt: new Date().toISOString(),
      diagnostics: { stage: 'instance_scope', scoped_instance: scopedInstance },
    };
  }

  // Stage 2: hard-deny checks for required context attributes.
  const requireContextAttributes = readBoolean(contextAttributes?.requireContextAttributes) ?? false;
  if (requireContextAttributes && !contextAttributes) {
    return {
      allowed: false,
      reason: 'context_attribute_missing',
      instanceId: request.instanceId,
      action: request.action,
      resourceType: request.resource.type,
      resourceId: request.resource.id,
      requestId: request.context?.requestId,
      traceId: request.context?.traceId,
      evaluatedAt: new Date().toISOString(),
      diagnostics: { stage: 'hard_deny' },
    };
  }

  // Stage 3: RBAC baseline.
  const hierarchyPath = readStringArray(contextAttributes?.organizationHierarchy);
  const matchedPermissions = permissions.filter((permission) =>
    isPermissionMatch(request, permission, targetOrganizationId, hierarchyPath)
  );
  if (matchedPermissions.length === 0) {
    return {
      allowed: false,
      reason: 'permission_missing',
      instanceId: request.instanceId,
      action: request.action,
      resourceType: request.resource.type,
      resourceId: request.resource.id,
      requestId: request.context?.requestId,
      traceId: request.context?.traceId,
      evaluatedAt: new Date().toISOString(),
      diagnostics: { stage: 'rbac' },
    };
  }

  // Stage 4: ABAC rules.
  const mergedAttributes = {
    ...(resourceAttributes ?? {}),
    ...(contextAttributes ?? {}),
  };
  const abacResult = evaluateAbacRules(request, mergedAttributes, targetOrganizationId);
  if (!abacResult.allowed) {
    return {
      allowed: false,
      reason: abacResult.reason,
      instanceId: request.instanceId,
      action: request.action,
      resourceType: request.resource.type,
      resourceId: request.resource.id,
      requestId: request.context?.requestId,
      traceId: request.context?.traceId,
      evaluatedAt: new Date().toISOString(),
      diagnostics: { stage: 'abac' },
    };
  }

  // Stage 5: final decision.
  return {
    allowed: true,
    reason: abacResult.hasActiveRules ? 'allowed_by_abac' : 'allowed_by_rbac',
    instanceId: request.instanceId,
    action: request.action,
    resourceType: request.resource.type,
    resourceId: request.resource.id,
    requestId: request.context?.requestId,
    traceId: request.context?.traceId,
    evaluatedAt: new Date().toISOString(),
    diagnostics: { stage: 'final', matched_role_count: matchedPermissions.length },
  };
};
