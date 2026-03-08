type AccessRoles = {
  roles?: unknown;
};

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

/**
 * Collect roles from access claims, optionally scoped to a client.
 */
export const extractRoles = (claims: Record<string, unknown>, clientId?: string) => {
  const roles = new Set<string>();
  for (const role of readRoles(claims.roles)) {
    roles.add(role);
  }
  for (const role of readAccessRoles(claims.realm_access)) {
    roles.add(role);
  }
  const resourceAccess = claims.resource_access;
  if (resourceAccess && typeof resourceAccess === 'object') {
    const accessEntries = resourceAccess as Record<string, unknown>;
    if (clientId && accessEntries[clientId]) {
      for (const role of readAccessRoles(accessEntries[clientId])) {
        roles.add(role);
      }
    } else {
      for (const entry of Object.values(accessEntries)) {
        for (const role of readAccessRoles(entry)) {
          roles.add(role);
        }
      }
    }
  }
  return [...roles];
};
