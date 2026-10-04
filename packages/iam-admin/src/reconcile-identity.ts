import type { IdentityProviderPort } from './identity-provider-port.js';
import { readString } from './input-readers.js';
import { getRoleDisplayName, getRoleExternalName } from './role-audit.js';
import { isTenantTechnicalKeycloakRole } from './role-governance.js';
import { classifyTenantKeycloakRole } from './keycloak-role-assignment-policy.js';
import type { ManagedRoleRow } from './types.js';
import type { IdentityRole, RoleCatalogReconciliationDeps } from './reconcile-types.js';

export const buildReconcileRoleIndexes = (input: {
  technicalDbRoles: readonly ManagedRoleRow[];
  technicalManagedIdpRoles: readonly IdentityRole[];
}) => ({
  idpByExternalName: new Map(
    input.technicalManagedIdpRoles.map((role) => [role.externalName, role])
  ),
  idpByRoleKey: new Map(
    input.technicalManagedIdpRoles.flatMap((role) => {
      const roleKey = readRoleAttribute(role.attributes, 'role_key');
      return roleKey ? ([[roleKey, role]] as const) : [];
    })
  ),
  dbByExternalName: new Map(
    input.technicalDbRoles.map((role) => [getRoleExternalName(role), role])
  ),
  dbByRoleKey: new Map(input.technicalDbRoles.map((role) => [role.role_key, role])),
});

export const readRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return Array.isArray(values) ? readString(values[0]) : undefined;
};

export const isStudioManagedIdentityRole = (role: IdentityRole, instanceId: string): boolean =>
  readRoleAttribute(role.attributes, 'managed_by') === 'studio' &&
  readRoleAttribute(role.attributes, 'instance_id') === instanceId;

export const readImportableRoleMetadata = (
  role: IdentityRole
): { roleKey: string; displayName: string; roleLevel: number } | null => {
  const roleKey = readRoleAttribute(role.attributes, 'role_key');
  const displayName = readRoleAttribute(role.attributes, 'display_name');
  const roleLevelRaw = readRoleAttribute(role.attributes, 'role_level');
  const parsedRoleLevel = roleLevelRaw ? Number(roleLevelRaw) : 0;

  if (!roleKey || !displayName) {
    return null;
  }

  if (!Number.isFinite(parsedRoleLevel) || parsedRoleLevel < 0 || parsedRoleLevel > 100) {
    return null;
  }

  return {
    roleKey,
    displayName,
    roleLevel: parsedRoleLevel,
  };
};

const requiresRoleDetailHydration = (role: IdentityRole): boolean =>
  !readRoleAttribute(role.attributes, 'managed_by') ||
  !readRoleAttribute(role.attributes, 'instance_id') ||
  !readRoleAttribute(role.attributes, 'role_key') ||
  !readRoleAttribute(role.attributes, 'display_name');

export const isPotentialStudioManagedRealmRole = (role: IdentityRole): boolean => {
  const category = classifyTenantKeycloakRole(role).category;
  return category === 'assignable' || category === 'system_admin';
};

export const hydrateRoleDetailsForReconciliation = async (
  deps: RoleCatalogReconciliationDeps,
  identityProvider: { provider: IdentityProviderPort },
  roles: readonly IdentityRole[]
): Promise<readonly IdentityRole[]> =>
  Promise.all(
    roles.map(async (role) => {
      if (!isPotentialStudioManagedRealmRole(role) || !requiresRoleDetailHydration(role)) {
        return role;
      }

      const detailedRole = await deps.trackKeycloakCall('reconcile_get_role_by_name', () =>
        identityProvider.provider.getRoleByName(role.externalName)
      );

      return detailedRole ?? role;
    })
  );

export const isAcceptedIdentityRoleKey = (
  roleKey: string,
  identityRoleKey: string | undefined
): boolean => {
  if (!identityRoleKey) {
    return false;
  }

  return identityRoleKey === roleKey;
};

export const resolveMatchingIdentityRole = (input: {
  role: ManagedRoleRow;
  idpByExternalName: ReadonlyMap<string, IdentityRole>;
  idpByRoleKey: ReadonlyMap<string, IdentityRole>;
}): {
  externalRoleName: string;
  alias?: string;
  matchingIdentityRole?: IdentityRole;
} => {
  const externalRoleName = getRoleExternalName(input.role);
  const matchingIdentityRoleByExternalName = input.idpByExternalName.get(externalRoleName);
  if (matchingIdentityRoleByExternalName) {
    return {
      externalRoleName,
      matchingIdentityRole: matchingIdentityRoleByExternalName,
    };
  }

  const matchingIdentityRoleByRoleKey = input.idpByRoleKey.get(input.role.role_key);
  if (!matchingIdentityRoleByRoleKey) {
    return {
      externalRoleName,
      matchingIdentityRole: undefined,
    };
  }

  return {
    externalRoleName,
    alias:
      matchingIdentityRoleByRoleKey.externalName !== externalRoleName
        ? externalRoleName
        : undefined,
    matchingIdentityRole: matchingIdentityRoleByRoleKey,
  };
};

export const describeMatchedIdentityRole = (input: {
  role: ManagedRoleRow;
  externalRoleName: string;
  alias?: string;
  matchingIdentityRole: IdentityRole;
}): {
  expectedDisplayName: string;
  identityDisplayName: string | undefined;
  identityRoleKey: string | undefined;
  canonicalExternalRoleName: string;
  aliasSatisfiedByCanonicalRole: boolean;
  reportedExternalRoleName: string;
} => {
  const expectedDisplayName = getRoleDisplayName(input.role);
  const identityDisplayName = readRoleAttribute(
    input.matchingIdentityRole.attributes,
    'display_name'
  );
  const identityRoleKey = readRoleAttribute(input.matchingIdentityRole.attributes, 'role_key');
  const canonicalExternalRoleName =
    input.matchingIdentityRole.externalName ?? input.externalRoleName;
  const aliasSatisfiedByCanonicalRole =
    input.alias !== undefined && canonicalExternalRoleName !== input.alias;

  return {
    expectedDisplayName,
    identityDisplayName,
    identityRoleKey,
    canonicalExternalRoleName,
    aliasSatisfiedByCanonicalRole,
    reportedExternalRoleName: input.alias ?? input.externalRoleName,
  };
};

export const markMatchedIdentityRole = (
  matchedIdentityExternalNames: Set<string>,
  matchedIdentityRoleKeys: Set<string>,
  identityRole: IdentityRole
) => {
  matchedIdentityExternalNames.add(identityRole.externalName);
  const identityRoleKey = readRoleAttribute(identityRole.attributes, 'role_key');
  if (identityRoleKey) {
    matchedIdentityRoleKeys.add(identityRoleKey);
  }
};

export const shouldSkipManagedIdentityRole = (input: {
  identityRole: IdentityRole;
  dbByExternalName: ReadonlyMap<string, ManagedRoleRow>;
  dbByRoleKey: ReadonlyMap<string, ManagedRoleRow>;
  matchedIdentityExternalNames: Set<string>;
  matchedIdentityRoleKeys: Set<string>;
}): boolean => {
  const identityRoleKey = readRoleAttribute(input.identityRole.attributes, 'role_key');
  return (
    input.matchedIdentityExternalNames.has(input.identityRole.externalName) ||
    Boolean(identityRoleKey && input.matchedIdentityRoleKeys.has(identityRoleKey)) ||
    input.dbByExternalName.has(input.identityRole.externalName) ||
    Boolean(identityRoleKey && input.dbByRoleKey.has(identityRoleKey))
  );
};

export const isTechnicalIdentityRole = (identityRole: IdentityRole): boolean =>
  isTenantTechnicalKeycloakRole({
    role_key: readRoleAttribute(identityRole.attributes, 'role_key') ?? identityRole.externalName,
    external_role_name: identityRole.externalName,
  });
