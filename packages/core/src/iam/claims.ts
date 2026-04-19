type AccessRoles = {
  roles?: unknown;
};

const ROLE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // The external SVA Mainserver realm exposes the elevated studio role as `Admin`.
  Admin: ['system_admin'],
};

const ROLE_ALIAS_REALM_ROLES = new Set<string>(['Admin']);

/**
 * Resolve a display name from standard OIDC claims with fallbacks.
 */
export const resolveUserName = (claims: Record<string, unknown>) => {
  const name = claims.name;
  if (typeof name === 'string' && name.trim()) {
    return name;
  }
  const preferredUsername = claims.preferred_username;
  if (typeof preferredUsername === 'string' && preferredUsername.trim()) {
    return preferredUsername;
  }
  const givenName = claims.given_name;
  const familyName = claims.family_name;
  if (typeof givenName === 'string' && typeof familyName === 'string') {
    return `${givenName} ${familyName}`.trim();
  }
  return 'Unbekannt';
};

/**
 * Reads the instance context claim from token claims.
 */
export const resolveInstanceId = (claims: Record<string, unknown>) => {
  const value = claims.instanceId;
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * Normalize a roles array and filter non-string values.
 */
const readRoles = (value: unknown) =>
  Array.isArray(value) ? value.filter((role): role is string => typeof role === 'string') : [];

/**
 * Extract role strings from a realm/resource access object.
 */
const readAccessRoles = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return [];
  }
  return readRoles((value as AccessRoles).roles);
};

const addRole = (roles: Set<string>, role: string, allowAlias: boolean): void => {
  roles.add(role);
  if (!allowAlias) {
    return;
  }

  for (const alias of ROLE_ALIASES[role] ?? []) {
    roles.add(alias);
  }
};

const addRoles = (roles: Set<string>, nextRoles: readonly string[], allowAlias: boolean): void => {
  for (const role of nextRoles) {
    addRole(roles, role, allowAlias);
  }
};

const readResourceAccessEntries = (value: unknown, clientId?: string): readonly string[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const accessEntries = value as Record<string, unknown>;
  if (clientId) {
    return readAccessRoles(accessEntries[clientId]);
  }

  const roles: string[] = [];
  for (const entry of Object.values(accessEntries)) {
    roles.push(...readAccessRoles(entry));
  }
  return roles;
};

/**
 * Collect roles from access claims, optionally scoped to a client.
 */
export const extractRoles = (claims: Record<string, unknown>, clientId?: string) => {
  const roles = new Set<string>();

  addRoles(roles, readRoles(claims.roles), false);
  for (const role of readAccessRoles(claims.realm_access)) {
    addRole(roles, role, ROLE_ALIAS_REALM_ROLES.has(role));
  }
  addRoles(roles, readResourceAccessEntries(claims.resource_access, clientId), false);

  return [...roles];
};
