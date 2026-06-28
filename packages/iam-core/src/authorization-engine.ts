import type {
  AuthorizeRequest,
  AuthorizeResponse,
  EffectivePermission,
  IamPermissionProvenance,
  IamPermissionSourceKind,
  MatchedPermissionSummary,
} from './authorization-contract.js';

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

const buildDecisionResponse = (
  request: AuthorizeRequest,
  allowed: boolean,
  reason: AuthorizeResponse['reason'],
  input?: {
    readonly diagnostics?: Readonly<Record<string, unknown>>;
    readonly matchedPermissions?: readonly MatchedPermissionSummary[];
    readonly provenance?: IamPermissionProvenance;
  }
): AuthorizeResponse => ({
  allowed,
  reason,
  instanceId: request.instanceId,
  action: request.action,
  resourceType: request.resource.type,
  resourceId: request.resource.id,
  requestId: request.context?.requestId,
  traceId: request.context?.traceId,
  evaluatedAt: new Date().toISOString(),
  ...(input?.diagnostics ? { diagnostics: input.diagnostics } : {}),
  ...(input?.matchedPermissions ? { matchedPermissions: input.matchedPermissions } : {}),
  ...(input?.provenance ? { provenance: input.provenance } : {}),
});

const readActorAccountId = (
  contextAttributes: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  return (
    readString(contextAttributes?.actorAccountId) ??
    readString(contextAttributes?.effectiveAccountId)
  );
};

const readOwnerUserId = (
  resourceAttributes: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  return readString(resourceAttributes?.ownerUserId);
};

const readOwnerOrganizationId = (
  resourceAttributes: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  return readString(resourceAttributes?.ownerOrganizationId);
};

const resolveSourceKinds = (
  permission: EffectivePermission
): readonly IamPermissionSourceKind[] | undefined => {
  const sourceKinds = permission.provenance?.sourceKinds;
  if (sourceKinds && sourceKinds.length > 0) {
    return sourceKinds;
  }

  const derivedKinds = new Set<IamPermissionSourceKind>();
  const sourceRoleIds = permission.sourceRoleIds ?? [];
  const sourceGroupIds = permission.sourceGroupIds ?? [];
  if (sourceRoleIds.length > 0) {
    derivedKinds.add('direct_role');
  }
  if (sourceGroupIds.length > 0) {
    derivedKinds.add('group_role');
  }
  return derivedKinds.size > 0 ? [...derivedKinds] : undefined;
};

const buildProvenance = (
  permission: EffectivePermission,
  overrides?: Partial<IamPermissionProvenance>
): IamPermissionProvenance | undefined => {
  const sourceKinds = resolveSourceKinds(permission);
  const provenance = {
    ...(permission.provenance ?? {}),
    ...(sourceKinds ? { sourceKinds } : {}),
    ...(overrides ?? {}),
  };

  return Object.keys(provenance).length > 0 ? provenance : undefined;
};

const buildMatchedPermissionOptionalFields = (
  permission: EffectivePermission,
  sourceId: string | undefined
): Partial<MatchedPermissionSummary> => ({
  ...(permission.resourceId ? { resourceId: permission.resourceId } : {}),
  ...(sourceId ? { sourceId } : {}),
  ...(permission.groupName ? { sourceName: permission.groupName } : {}),
  ...(typeof permission.scope?.geoScope === 'string' ? { geoScope: permission.scope.geoScope } : {}),
});

const summarizeMatchedPermission = (permission: EffectivePermission): MatchedPermissionSummary => {
  const sourceGroupIds = permission.sourceGroupIds ?? [];
  const sourceRoleIds = permission.sourceRoleIds ?? [];
  const sourceId = sourceGroupIds[0] ?? sourceRoleIds[0];

  return {
    action: permission.action,
    resourceType: permission.resourceType,
    source: sourceGroupIds.length > 0 ? 'group' : 'role',
    ...buildMatchedPermissionOptionalFields(permission, sourceId),
  };
};

const resolveGeoUnitMatch = (
  allowedGeoUnitIds: readonly string[] | undefined,
  restrictedGeoUnitIds: readonly string[] | undefined,
  resourceGeoUnitId: string | undefined,
  geoHierarchy: readonly string[] | undefined
): {
  readonly matchedAllowedGeoUnitId?: string;
  readonly matchedRestrictedGeoUnitId?: string;
} => {
  const hierarchy = [...(geoHierarchy ?? []), ...(resourceGeoUnitId ? [resourceGeoUnitId] : [])];
  if (hierarchy.length === 0) {
    return {};
  }

  const readMostSpecificMatch = (candidates: readonly string[] | undefined): string | undefined => {
    if (!candidates || candidates.length === 0) {
      return undefined;
    }

    for (let index = hierarchy.length - 1; index >= 0; index -= 1) {
      const hierarchyEntry = hierarchy[index];
      if (hierarchyEntry && candidates.includes(hierarchyEntry)) {
        return hierarchyEntry;
      }
    }

    return undefined;
  };

  return {
    matchedAllowedGeoUnitId: readMostSpecificMatch(allowedGeoUnitIds),
    matchedRestrictedGeoUnitId: readMostSpecificMatch(restrictedGeoUnitIds),
  };
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

  if (permission.resourceId && permission.resourceId !== request.resource.id) {
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

const mergePermissionAttributes = (
  permission: EffectivePermission,
  contextAttributes: Readonly<Record<string, unknown>> | undefined,
  resourceAttributes: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> | undefined => {
  if (!permission.scope && !contextAttributes && !resourceAttributes) {
    return undefined;
  }

  return {
    ...(permission.scope ?? {}),
    ...(contextAttributes ?? {}),
    ...(resourceAttributes ?? {}),
  };
};

const isPermissionActiveForScope = (
  permission: EffectivePermission,
  request: AuthorizeRequest,
  _targetOrganizationId: string | undefined,
  contextAttributes: Readonly<Record<string, unknown>> | undefined,
  resourceAttributes: Readonly<Record<string, unknown>> | undefined
): { active: boolean; denyReason?: AuthorizeResponse['reason'] } => {
  const actorAccountId = readActorAccountId(contextAttributes);
  const activeOrganizationId = request.context?.organizationId;
  const ownerUserId = readOwnerUserId(resourceAttributes);
  const ownerOrganizationId = readOwnerOrganizationId(resourceAttributes);

  if (permission.accessScope === 'own') {
    if (!actorAccountId || !ownerUserId || actorAccountId !== ownerUserId) {
      return { active: false };
    }
  }

  if (permission.accessScope === 'organization') {
    const ownMatch = Boolean(actorAccountId && ownerUserId && actorAccountId === ownerUserId);
    const organizationMatch = Boolean(
      activeOrganizationId && ownerOrganizationId === activeOrganizationId
    );

    if (!ownMatch && !organizationMatch) {
      return { active: false };
    }
  }

  return { active: true };
};

const parseClockMinutes = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

const isWithinWindow = (
  currentMinutes: number,
  startMinutes: number,
  endMinutes: number
): boolean => {
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};

const evaluateAbacRules = (
  request: AuthorizeRequest,
  attributes: Readonly<Record<string, unknown>> | undefined,
  targetOrganizationId: string | undefined,
  permission?: EffectivePermission
): {
  allowed: boolean;
  reason: AuthorizeResponse['reason'];
  hasActiveRules: boolean;
  provenance?: IamPermissionProvenance;
} => {
  if (!attributes) {
    return {
      allowed: true,
      reason: 'allowed_by_rbac',
      hasActiveRules: false,
      provenance: permission ? buildProvenance(permission) : undefined,
    };
  }

  const requiredGeoScope = readBoolean(attributes.requireGeoScope) ?? false;
  const resourceAttributes = readRecord(request.resource.attributes);
  const resourceGeoScope =
    readString(resourceAttributes?.geoScope) ?? readString(attributes.geoScope) ?? undefined;
  const resourceGeoUnitId =
    readString(resourceAttributes?.geoUnitId) ?? readString(attributes.geoUnitId) ?? undefined;
  const geoHierarchy =
    readStringArray(resourceAttributes?.geoHierarchy) ?? readStringArray(attributes.geoHierarchy);
  const allowedGeoScopes = readStringArray(attributes.allowedGeoScopes);
  const allowedGeoUnitIds = readStringArray(attributes.allowedGeoUnitIds);
  const restrictedGeoUnitIds = readStringArray(attributes.restrictedGeoUnitIds);
  const restrictedOrganizationIds = readStringArray(attributes.restrictedOrganizationIds);
  const shouldForceDeny = readBoolean(attributes.forceDeny) ?? false;
  const geoUnitMatch = resolveGeoUnitMatch(
    allowedGeoUnitIds,
    restrictedGeoUnitIds,
    resourceGeoUnitId,
    geoHierarchy
  );

  if (requiredGeoScope && !resourceGeoScope && !resourceGeoUnitId) {
    return { allowed: false, reason: 'context_attribute_missing', hasActiveRules: true };
  }

  if (
    restrictedOrganizationIds &&
    targetOrganizationId &&
    restrictedOrganizationIds.includes(targetOrganizationId)
  ) {
    return { allowed: false, reason: 'hierarchy_restriction', hasActiveRules: true };
  }

  if (geoUnitMatch.matchedRestrictedGeoUnitId) {
    return {
      allowed: false,
      reason: 'hierarchy_restriction',
      hasActiveRules: true,
      provenance: permission
        ? buildProvenance(permission, {
            restrictedByGeoUnitId: geoUnitMatch.matchedRestrictedGeoUnitId,
          })
        : undefined,
    };
  }

  const shouldApplyGeoScopeFallback = !allowedGeoUnitIds || allowedGeoUnitIds.length === 0;
  if (
    shouldApplyGeoScopeFallback &&
    allowedGeoScopes &&
    (!resourceGeoScope || !allowedGeoScopes.includes(resourceGeoScope))
  ) {
    return { allowed: false, reason: 'abac_condition_unmet', hasActiveRules: true };
  }

  if (allowedGeoUnitIds && !geoUnitMatch.matchedAllowedGeoUnitId) {
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
    allowedGeoUnitIds ||
    restrictedGeoUnitIds ||
    restrictedOrganizationIds ||
    timeWindow ||
    shouldForceDeny ||
    (readBoolean(attributes.requireActingAs) ?? false)
  );
  return {
    allowed: true,
    reason: hasRules ? 'allowed_by_abac' : 'allowed_by_rbac',
    hasActiveRules: hasRules,
    provenance: permission
      ? buildProvenance(permission, {
          inheritedFromGeoUnitId:
            geoUnitMatch.matchedAllowedGeoUnitId &&
            resourceGeoUnitId &&
            geoUnitMatch.matchedAllowedGeoUnitId !== resourceGeoUnitId
              ? geoUnitMatch.matchedAllowedGeoUnitId
              : undefined,
        })
      : undefined,
  };
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
    readString(contextAttributes?.instanceId) ??
    readString(resourceAttributes?.instanceId) ??
    request.instanceId;
  if (scopedInstance !== request.instanceId) {
    return buildDecisionResponse(request, false, 'instance_scope_mismatch', {
      diagnostics: { stage: 'instance_scope', scoped_instance: scopedInstance },
    });
  }

  // Stage 2: hard-deny checks for required context attributes.
  const requireContextAttributes =
    readBoolean(contextAttributes?.requireContextAttributes) ?? false;
  if (requireContextAttributes && !contextAttributes) {
    return buildDecisionResponse(request, false, 'context_attribute_missing', {
      diagnostics: { stage: 'hard_deny' },
    });
  }

  // Stage 3: RBAC baseline.
  const hierarchyPath = readStringArray(contextAttributes?.organizationHierarchy);
  const matchedPermissions = permissions.filter((permission) =>
    isPermissionMatch(request, permission, targetOrganizationId, hierarchyPath)
  );
  const matchedPermissionSummaries = matchedPermissions.map(summarizeMatchedPermission);
  const allowPermissions = matchedPermissions;

  if (matchedPermissions.length === 0 || allowPermissions.length === 0) {
    return buildDecisionResponse(request, false, 'permission_missing', {
      diagnostics: { stage: 'rbac' },
      matchedPermissions: matchedPermissionSummaries,
    });
  }

  // Stage 4: ABAC rules.
  const abacResults = allowPermissions.map((permission) => {
    const scopeMatch = isPermissionActiveForScope(
      permission,
      request,
      targetOrganizationId,
      contextAttributes,
      resourceAttributes
    );
    if (!scopeMatch.active) {
      return {
        permission,
        result: {
          allowed: false,
          reason:
            scopeMatch.denyReason ?? ('abac_condition_unmet' satisfies AuthorizeResponse['reason']),
          hasActiveRules: true,
          provenance: buildProvenance(permission),
        },
      };
    }

    return {
      permission,
      result: evaluateAbacRules(
        request,
        mergePermissionAttributes(permission, contextAttributes, resourceAttributes),
        targetOrganizationId,
        permission
      ),
    };
  });
  const firstAllowedResult = abacResults.find((entry) => entry.result.allowed);

  if (!firstAllowedResult) {
    const denyResult = abacResults.find((entry) => !entry.result.allowed);
    return buildDecisionResponse(
      request,
      false,
      denyResult?.result.reason ?? 'abac_condition_unmet',
      {
        diagnostics: { stage: 'abac' },
        matchedPermissions: matchedPermissionSummaries,
        provenance: denyResult?.result.provenance,
      }
    );
  }

  // Stage 6: final decision.
  return buildDecisionResponse(
    request,
    true,
    firstAllowedResult.result.hasActiveRules ? 'allowed_by_abac' : 'allowed_by_rbac',
    {
      diagnostics: { stage: 'final', matched_role_count: matchedPermissions.length },
      matchedPermissions: matchedPermissionSummaries,
      provenance: firstAllowedResult.result.provenance,
    }
  );
};
