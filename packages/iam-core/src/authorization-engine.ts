import type {
  AuthorizeRequest,
  AuthorizeResponse,
  EffectivePermission,
  IamPermissionProvenance,
  MatchedPermissionSummary,
} from './authorization-contract.js';
import {
  evaluateAbacRules,
  readBoolean,
  readRecord,
  readString,
  readStringArray,
} from './authorization-abac.js';
import { buildPermissionProvenance } from './authorization-provenance.js';

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

const buildMatchedPermissionOptionalFields = (
  permission: EffectivePermission,
  sourceId: string | undefined
): Partial<MatchedPermissionSummary> => ({
  ...(permission.resourceId ? { resourceId: permission.resourceId } : {}),
  ...(sourceId ? { sourceId } : {}),
  ...(permission.groupName ? { sourceName: permission.groupName } : {}),
  ...(typeof permission.scope?.geoScope === 'string'
    ? { geoScope: permission.scope.geoScope }
    : {}),
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
          provenance: buildPermissionProvenance(permission),
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
