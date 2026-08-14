import type {
  AuthorizeRequest,
  AuthorizeResponse,
  EffectivePermission,
  IamPermissionProvenance,
} from './authorization-contract.js';
import { buildPermissionProvenance } from './authorization-provenance.js';

type Attributes = Readonly<Record<string, unknown>>;

interface AbacEvaluationResult {
  readonly allowed: boolean;
  readonly reason: AuthorizeResponse['reason'];
  readonly hasActiveRules: boolean;
  readonly provenance?: IamPermissionProvenance;
}

interface AbacRuleContext {
  readonly request: AuthorizeRequest;
  readonly permission?: EffectivePermission;
  readonly targetOrganizationId?: string;
  readonly requiredGeoScope: boolean;
  readonly resourceGeoScope?: string;
  readonly resourceGeoUnitId?: string;
  readonly allowedGeoScopes?: readonly string[];
  readonly allowedGeoUnitIds?: readonly string[];
  readonly restrictedGeoUnitIds?: readonly string[];
  readonly restrictedOrganizationIds?: readonly string[];
  readonly matchedAllowedGeoUnitId?: string;
  readonly matchedRestrictedGeoUnitId?: string;
  readonly timeWindow?: Attributes;
  readonly startMinutes?: number | null;
  readonly endMinutes?: number | null;
  readonly currentMinutes?: number | null;
  readonly requiresActingAs: boolean;
  readonly shouldForceDeny: boolean;
}

export const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const readBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

export const readStringArray = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : undefined;
};

export const readRecord = (value: unknown): Attributes | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Attributes;
};

const resolveGeoUnitMatch = (
  allowedGeoUnitIds: readonly string[] | undefined,
  restrictedGeoUnitIds: readonly string[] | undefined,
  resourceGeoUnitId: string | undefined,
  geoHierarchy: readonly string[] | undefined
) => {
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

const parseClockMinutes = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const buildRuleContext = (
  request: AuthorizeRequest,
  attributes: Attributes,
  targetOrganizationId: string | undefined,
  permission: EffectivePermission | undefined
): AbacRuleContext => {
  const resourceAttributes = readRecord(request.resource.attributes);
  const resourceGeoScope =
    readString(resourceAttributes?.geoScope) ?? readString(attributes.geoScope);
  const resourceGeoUnitId =
    readString(resourceAttributes?.geoUnitId) ?? readString(attributes.geoUnitId);
  const geoHierarchy =
    readStringArray(resourceAttributes?.geoHierarchy) ?? readStringArray(attributes.geoHierarchy);
  const allowedGeoUnitIds = readStringArray(attributes.allowedGeoUnitIds);
  const restrictedGeoUnitIds = readStringArray(attributes.restrictedGeoUnitIds);
  const timeWindow = readRecord(attributes.timeWindow);
  const startClock = readString(timeWindow?.start);
  const endClock = readString(timeWindow?.end);
  const startMinutes = startClock ? parseClockMinutes(startClock) : undefined;
  const endMinutes = endClock ? parseClockMinutes(endClock) : undefined;
  const currentMinutes =
    startMinutes !== undefined &&
    startMinutes !== null &&
    endMinutes !== undefined &&
    endMinutes !== null
      ? parseClockMinutes(
          readString(attributes.currentTime) ?? new Date().toISOString().slice(11, 16)
        )
      : undefined;
  const geoUnitMatch = resolveGeoUnitMatch(
    allowedGeoUnitIds,
    restrictedGeoUnitIds,
    resourceGeoUnitId,
    geoHierarchy
  );

  return {
    request,
    permission,
    targetOrganizationId,
    requiredGeoScope: readBoolean(attributes.requireGeoScope) ?? false,
    resourceGeoScope,
    resourceGeoUnitId,
    allowedGeoScopes: readStringArray(attributes.allowedGeoScopes),
    allowedGeoUnitIds,
    restrictedGeoUnitIds,
    restrictedOrganizationIds: readStringArray(attributes.restrictedOrganizationIds),
    ...geoUnitMatch,
    timeWindow,
    startMinutes,
    endMinutes,
    currentMinutes,
    requiresActingAs: readBoolean(attributes.requireActingAs) ?? false,
    shouldForceDeny: readBoolean(attributes.forceDeny) ?? false,
  };
};

const deny = (
  reason: AuthorizeResponse['reason'],
  provenance?: IamPermissionProvenance
): AbacEvaluationResult => ({
  allowed: false,
  reason,
  hasActiveRules: true,
  ...(provenance ? { provenance } : {}),
});

const evaluateRequiredGeoContext = (context: AbacRuleContext): AbacEvaluationResult | undefined => {
  if (context.requiredGeoScope && !context.resourceGeoScope && !context.resourceGeoUnitId) {
    return deny('context_attribute_missing');
  }
  return undefined;
};

const evaluateHierarchyRestrictions = (
  context: AbacRuleContext
): AbacEvaluationResult | undefined => {
  if (
    context.restrictedOrganizationIds &&
    context.targetOrganizationId &&
    context.restrictedOrganizationIds.includes(context.targetOrganizationId)
  ) {
    return deny('hierarchy_restriction');
  }

  const restrictedGeoUnitId = context.matchedRestrictedGeoUnitId;
  if (!restrictedGeoUnitId) {
    return undefined;
  }

  const provenance = context.permission
    ? buildPermissionProvenance(context.permission, { restrictedByGeoUnitId: restrictedGeoUnitId })
    : undefined;
  return deny('hierarchy_restriction', provenance);
};

const evaluateGeoAllows = (context: AbacRuleContext): AbacEvaluationResult | undefined => {
  const hasGeoUnitAllowList = Boolean(
    context.allowedGeoUnitIds && context.allowedGeoUnitIds.length > 0
  );
  if (
    !hasGeoUnitAllowList &&
    context.allowedGeoScopes &&
    (!context.resourceGeoScope || !context.allowedGeoScopes.includes(context.resourceGeoScope))
  ) {
    return deny('abac_condition_unmet');
  }

  if (context.allowedGeoUnitIds && !context.matchedAllowedGeoUnitId) {
    return deny('abac_condition_unmet');
  }
  return undefined;
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

const evaluateTimeWindow = (context: AbacRuleContext): AbacEvaluationResult | undefined => {
  if (context.startMinutes === undefined || context.endMinutes === undefined) {
    return undefined;
  }

  if (context.startMinutes === null || context.endMinutes === null) {
    return deny('abac_condition_unmet');
  }

  if (
    context.currentMinutes === undefined ||
    context.currentMinutes === null ||
    !isWithinWindow(context.currentMinutes, context.startMinutes, context.endMinutes)
  ) {
    return deny('abac_condition_unmet');
  }
  return undefined;
};

const evaluateActingAs = (context: AbacRuleContext): AbacEvaluationResult | undefined => {
  if (context.requiresActingAs && !context.request.context?.actingAsUserId) {
    return deny('context_attribute_missing');
  }
  return undefined;
};

const evaluateForceDeny = (context: AbacRuleContext): AbacEvaluationResult | undefined => {
  if (context.shouldForceDeny) {
    return deny('policy_conflict_restrictive_wins');
  }
  return undefined;
};

const buildAllowedResult = (context: AbacRuleContext): AbacEvaluationResult => {
  const hasActiveRules = Boolean(
    context.requiredGeoScope ||
    context.allowedGeoScopes ||
    context.allowedGeoUnitIds ||
    context.restrictedGeoUnitIds ||
    context.restrictedOrganizationIds ||
    context.timeWindow ||
    context.shouldForceDeny ||
    context.requiresActingAs
  );
  const inheritedFromGeoUnitId =
    context.matchedAllowedGeoUnitId &&
    context.resourceGeoUnitId &&
    context.matchedAllowedGeoUnitId !== context.resourceGeoUnitId
      ? context.matchedAllowedGeoUnitId
      : undefined;

  return {
    allowed: true,
    reason: hasActiveRules ? 'allowed_by_abac' : 'allowed_by_rbac',
    hasActiveRules,
    provenance: context.permission
      ? buildPermissionProvenance(context.permission, { inheritedFromGeoUnitId })
      : undefined,
  };
};

export const evaluateAbacRules = (
  request: AuthorizeRequest,
  attributes: Attributes | undefined,
  targetOrganizationId: string | undefined,
  permission?: EffectivePermission
): AbacEvaluationResult => {
  if (!attributes) {
    return {
      allowed: true,
      reason: 'allowed_by_rbac',
      hasActiveRules: false,
      provenance: permission ? buildPermissionProvenance(permission) : undefined,
    };
  }

  const context = buildRuleContext(request, attributes, targetOrganizationId, permission);

  return (
    evaluateRequiredGeoContext(context) ??
    evaluateHierarchyRestrictions(context) ??
    evaluateGeoAllows(context) ??
    evaluateTimeWindow(context) ??
    evaluateActingAs(context) ??
    evaluateForceDeny(context) ??
    buildAllowedResult(context)
  );
};
