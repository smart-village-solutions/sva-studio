import { classifyTenantKeycloakRole, isTenantKeycloakRoleVisible } from '@sva/iam-admin';
import type { IamKeycloakRealmRoleAssignment, IamUserKeycloakRoleAssignments } from '@sva/core';
import { z } from 'zod';

import type { IdentityProviderPort, IdentityRole } from '../identity-provider-port.js';
import type { QueryClient } from '../db.js';
import {
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
} from '../keycloak-admin-client/errors.js';

import { createApiError, readPathSegment } from './api-helpers.js';
import { trackKeycloakCall } from './shared-observability.js';
import { resolveIdentityProviderForInstance } from './shared-runtime.js';

export const roleMutationSchema = z.object({
  roleName: z.string().trim().min(1).max(255),
  operation: z.enum(['assign', 'remove']),
});
export type RoleMutationPayload = z.infer<typeof roleMutationSchema>;
export type ResolvedKeycloakRoleTarget = {
  readonly externalId: string;
  readonly mappingStatus: 'mapped' | 'unmapped';
};

const ROLE_PAGE_SIZE = 100;

const readManagedBy = (role: IdentityRole): 'studio' | 'external' | 'keycloak_builtin' => {
  const policy = classifyTenantKeycloakRole(role);
  if (policy.category === 'keycloak_builtin') return 'keycloak_builtin';
  return role.attributes?.managed_by?.[0] === 'studio' ? 'studio' : 'external';
};

export const projectKeycloakRoleAssignments = (input: {
  readonly catalog: readonly IdentityRole[];
  readonly direct: readonly IdentityRole[];
  readonly effective: readonly IdentityRole[];
}): readonly IamKeycloakRealmRoleAssignment[] => {
  const directNames = new Set(input.direct.map((role) => role.externalName));
  const effectiveNames = new Set(input.effective.map((role) => role.externalName));
  return input.catalog
    .filter(isTenantKeycloakRoleVisible)
    .map((role): IamKeycloakRealmRoleAssignment => {
      const policy = classifyTenantKeycloakRole(role);
      const direct = directNames.has(role.externalName);
      const effective = effectiveNames.has(role.externalName);
      return {
        id: role.id ?? role.externalName,
        roleName: role.externalName,
        ...(role.description ? { description: role.description } : {}),
        composite: role.composite === true,
        managedBy: readManagedBy(role),
        category: policy.category,
        assignable: policy.assignable,
        direct,
        effective,
        origin: direct ? 'direct' : effective ? 'composite' : 'unassigned',
        ...(policy.reasonCode ? { reasonCode: policy.reasonCode } : {}),
      };
    })
    .sort((left, right) => left.roleName.localeCompare(right.roleName));
};

export const resolveKeycloakRoleMutationDelta = (input: {
  readonly operation: 'assign' | 'remove';
  readonly roleName: string;
  readonly direct: readonly IdentityRole[];
  readonly effective: readonly IdentityRole[];
}): { readonly needsWrite: boolean; readonly inheritedOnly: boolean } => {
  const direct = input.direct.some((entry) => entry.externalName === input.roleName);
  const effective = input.effective.some((entry) => entry.externalName === input.roleName);
  return {
    needsWrite: input.operation === 'assign' ? !direct : direct,
    inheritedOnly: input.operation === 'remove' && !direct && effective,
  };
};

export const readKeycloakRoleUserRef = (
  request: Request,
  requestId?: string
): string | Response => {
  const userRef = readPathSegment(request, 4)?.trim();
  if (!userRef || userRef.length > 512) {
    return createApiError(400, 'invalid_request', 'Ungültige Benutzerreferenz.', requestId);
  }
  return userRef;
};

export const resolveKeycloakRoleTarget = async (
  client: QueryClient,
  instanceId: string,
  userRef: string
): Promise<ResolvedKeycloakRoleTarget | null> => {
  if (userRef.startsWith('keycloak:')) {
    const externalId = userRef.slice('keycloak:'.length).trim();
    return externalId ? { externalId, mappingStatus: 'unmapped' } : null;
  }
  if (!z.string().uuid().safeParse(userRef).success) return null;
  const result = await client.query<{ keycloak_subject: string }>(
    `
SELECT keycloak_subject
FROM iam.accounts
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [instanceId, userRef]
  );
  const externalId = result.rows[0]?.keycloak_subject;
  return externalId ? { externalId, mappingStatus: 'mapped' } : null;
};

export const requireKeycloakRoleProvider = async (instanceId: string, requestId?: string) => {
  const resolved = await resolveIdentityProviderForInstance(instanceId, {
    executionMode: 'tenant_admin',
  });
  return (
    resolved?.provider ??
    createApiError(
      409,
      'tenant_admin_client_not_configured',
      'Tenant-lokale Keycloak-Administration ist nicht konfiguriert.',
      requestId,
      { reason_code: 'tenant_admin_client_not_configured' }
    )
  );
};

export const verifyKeycloakRoleTarget = async (
  provider: IdentityProviderPort,
  externalId: string,
  requestId?: string
): Promise<Response | null> => {
  try {
    await trackKeycloakCall('keycloak_role_target_lookup', () =>
      provider.getUserAttributes(externalId, [])
    );
    return null;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 404
    ) {
      return createApiError(
        404,
        'not_found',
        'Benutzer wurde im Tenant-Realm nicht gefunden.',
        requestId
      );
    }
    throw error;
  }
};

export const loadKeycloakRoleAssignments = async (
  provider: IdentityProviderPort,
  externalId: string
) => {
  const listAssignments = provider.listUserRealmRoleAssignments;
  if (listAssignments) {
    return trackKeycloakCall('list_user_keycloak_role_assignments', () =>
      listAssignments.call(provider, externalId)
    );
  }
  const directNames = await trackKeycloakCall('list_user_keycloak_role_names', () =>
    provider.listUserRoleNames(externalId)
  );
  const roles = await loadKeycloakRoleCatalog(provider);
  const direct = roles.filter((role) => directNames.includes(role.externalName));
  return { direct, effective: direct };
};

export const loadKeycloakRoleCatalog = async (
  provider: IdentityProviderPort
): Promise<readonly IdentityRole[]> => {
  if (!provider.countRoles) {
    return trackKeycloakCall('list_keycloak_role_catalog', () =>
      provider.listRoles({ first: 0, max: 1000 })
    );
  }
  const total = await trackKeycloakCall(
    'count_keycloak_role_catalog',
    () => provider.countRoles?.() ?? Promise.resolve(0)
  );
  const pageCount = Math.ceil(total / ROLE_PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, page) =>
      trackKeycloakCall('list_keycloak_role_catalog_page', () =>
        provider.listRoles({ first: page * ROLE_PAGE_SIZE, max: ROLE_PAGE_SIZE })
      )
    )
  );
  return pages.flat();
};

export const projectUserKeycloakRoleAssignments = async (
  provider: IdentityProviderPort,
  userRef: string,
  target: ResolvedKeycloakRoleTarget
): Promise<IamUserKeycloakRoleAssignments> => {
  const [catalog, assignments] = await Promise.all([
    loadKeycloakRoleCatalog(provider),
    loadKeycloakRoleAssignments(provider, target.externalId),
  ]);
  const roles = projectKeycloakRoleAssignments({
    catalog,
    direct: assignments.direct,
    effective: assignments.effective,
  });
  return { userRef, mappingStatus: target.mappingStatus, roles };
};

export const createKeycloakRoleDependencyError = (requestId?: string): Response =>
  createApiError(
    503,
    'keycloak_unavailable',
    'Die Verbindung zu Keycloak ist derzeit nicht verfügbar.',
    requestId,
    { dependency: 'keycloak' }
  );

export const createKeycloakRoleOperationError = (error: unknown, requestId?: string): Response => {
  if (error instanceof KeycloakAdminUnavailableError) {
    return createKeycloakRoleDependencyError(requestId);
  }
  if (error instanceof KeycloakAdminRequestError) {
    return createApiError(
      502,
      'keycloak_request_failed',
      'Die Keycloak-Anfrage wurde nicht erfolgreich ausgeführt.',
      requestId,
      { dependency: 'keycloak', reason_code: 'keycloak_request_failed' }
    );
  }
  return createApiError(
    500,
    'internal_error',
    'Die Keycloak-Rollenzuweisung konnte intern nicht verarbeitet werden.',
    requestId,
    { reason_code: 'unexpected_internal_error' }
  );
};
