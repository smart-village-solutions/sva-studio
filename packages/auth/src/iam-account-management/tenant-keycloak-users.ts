import type { IamKeycloakObjectDiagnostic, IamUserListItem } from '@sva/core';

import type { IdentityListedUser, IdentityProviderPort, IdentityUserListQuery } from '../identity-provider-port.js';
import type { QueryClient } from '../shared/db-helpers.js';

import { mapUserRowToListItem } from './user-mapping.js';
import { resolveIdentityProviderForInstance } from './shared-runtime.js';
import { logger, trackKeycloakCall } from './shared-observability.js';
import type { IamRoleRow, UserStatus } from './types.js';

const TENANT_KEYCLOAK_PAGE_SIZE = 100;
const TENANT_USER_ROLE_PROJECTION_CONCURRENCY = 5;

type AccountProjectionRow = {
  id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  first_name_ciphertext: string | null;
  last_name_ciphertext: string | null;
  email_ciphertext: string | null;
  position: string | null;
  department: string | null;
  status: UserStatus;
  last_login_at: string | null;
  role_rows: Array<{
    id: string;
    role_key: string;
    role_name: string;
    display_name: string | null;
    external_role_name: string | null;
    role_level: number;
    is_system_role: boolean;
  }> | null;
};

type TenantKeycloakUsersInput = {
  readonly client: QueryClient;
  readonly instanceId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: UserStatus;
  readonly role?: string;
  readonly search?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

const readSingleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const value = attributes?.[key]?.[0]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const resolveDisplayName = (user: IdentityListedUser): string => {
  const explicitDisplayName = readSingleAttribute(user.attributes, 'displayName');
  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const fullName = [user.firstName, user.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  return fullName || user.username || user.email || user.externalId;
};

const mapKeycloakUserStatus = (user: IdentityListedUser): UserStatus => (user.enabled === false ? 'inactive' : 'active');

const toKeycloakQuery = (
  input: Pick<TenantKeycloakUsersInput, 'search' | 'status'>
): Omit<IdentityUserListQuery, 'first' | 'max'> => ({
  ...(input.search ? { search: input.search } : {}),
  ...(input.status === 'active'
    ? { enabled: true }
    : input.status === 'inactive'
      ? { enabled: false }
      : {}),
});

const mapRoleRows = (roleRows: AccountProjectionRow['role_rows']): readonly IamRoleRow[] =>
  roleRows?.map((entry) => ({
    id: entry.id,
    role_key: entry.role_key,
    role_name: entry.role_name,
    display_name: entry.display_name,
    external_role_name: entry.external_role_name,
    role_level: Number(entry.role_level),
    is_system_role: Boolean(entry.is_system_role),
  })) ?? [];

const loadMappedUsersBySubject = async (
  client: QueryClient,
  input: { instanceId: string; subjects: readonly string[] }
): Promise<ReadonlyMap<string, IamUserListItem>> => {
  if (input.subjects.length === 0) {
    return new Map();
  }

  const result = await client.query<AccountProjectionRow>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.display_name_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.email_ciphertext,
  a.position,
  a.department,
  a.status,
  MAX(al.created_at)::text AS last_login_at,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', r.id,
        'role_key', r.role_key,
        'role_name', r.role_name,
        'display_name', r.display_name,
        'external_role_name', r.external_role_name,
        'role_level', r.role_level,
        'is_system_role', r.is_system_role
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE a.keycloak_subject = ANY($2::text[])
GROUP BY a.id;
`,
    [input.instanceId, input.subjects]
  );

  return new Map(
    result.rows.map((row) => [
      row.keycloak_subject,
      mapUserRowToListItem({
        ...row,
        roles: mapRoleRows(row.role_rows),
      }),
    ])
  );
};

const resolveRoleNamesForUsers = async (input: {
  readonly provider: IdentityProviderPort;
  readonly users: readonly IdentityListedUser[];
  readonly instanceId: string;
  readonly requestId?: string;
  readonly traceId?: string;
}): Promise<ReadonlyMap<string, readonly string[] | null>> => {
  const roleNamesBySubject = new Map<string, readonly string[] | null>();
  const workers = Array.from(
    { length: Math.min(TENANT_USER_ROLE_PROJECTION_CONCURRENCY, input.users.length) },
    async (_, workerIndex) => {
      for (let index = workerIndex; index < input.users.length; index += TENANT_USER_ROLE_PROJECTION_CONCURRENCY) {
        const user = input.users[index];
        if (!user) {
          continue;
        }
        try {
          roleNamesBySubject.set(
            user.externalId,
            await trackKeycloakCall('list_tenant_user_roles', () => input.provider.listUserRoleNames(user.externalId))
          );
        } catch (error) {
          logger.warn('Tenant user role projection degraded', {
            operation: 'list_tenant_keycloak_users',
            instance_id: input.instanceId,
            request_id: input.requestId,
            trace_id: input.traceId,
            user_ref: user.externalId,
            error: error instanceof Error ? error.message : String(error),
          });
          roleNamesBySubject.set(user.externalId, null);
        }
      }
    }
  );
  await Promise.all(workers);
  return roleNamesBySubject;
};

const listAllTenantUsers = async (
  provider: IdentityProviderPort,
  query: Omit<IdentityUserListQuery, 'first' | 'max'>
): Promise<readonly IdentityListedUser[]> => {
  const users: IdentityListedUser[] = [];
  for (let first = 0; ; first += TENANT_KEYCLOAK_PAGE_SIZE) {
    const page = await trackKeycloakCall('list_tenant_users', () =>
      provider.listUsers({ ...query, first, max: TENANT_KEYCLOAK_PAGE_SIZE })
    );
    users.push(...page);
    if (page.length < TENANT_KEYCLOAK_PAGE_SIZE) {
      return users;
    }
  }
};

const mapUnmappedKeycloakUser = (
  user: IdentityListedUser,
  roleNames: readonly string[] | null,
  instanceId: string
): IamUserListItem => {
  const configuredInstanceIds = user.attributes?.instanceId ?? [];
  const missingInstanceAttribute = configuredInstanceIds.length === 0;
  const wrongInstanceAttribute = configuredInstanceIds.length > 0 && !configuredInstanceIds.includes(instanceId);
  const diagnostics: IamKeycloakObjectDiagnostic[] = [];
  if (missingInstanceAttribute) {
    diagnostics.push({ code: 'missing_instance_attribute', objectId: user.externalId, objectType: 'user' });
  } else if (wrongInstanceAttribute) {
    diagnostics.push({ code: 'mapping_incomplete', objectId: user.externalId, objectType: 'user' });
  } else {
    diagnostics.push({ code: 'mapping_missing', objectId: user.externalId, objectType: 'user' });
  }
  if (roleNames === null) {
    diagnostics.push({ code: 'keycloak_projection_degraded', objectId: user.externalId, objectType: 'user' });
  }

  return {
    id: `keycloak:${user.externalId}`,
    keycloakSubject: user.externalId,
    displayName: resolveDisplayName(user),
    email: user.email,
    status: mapKeycloakUserStatus(user),
    mappingStatus: missingInstanceAttribute || wrongInstanceAttribute ? 'manual_review' : 'unmapped',
    editability: 'blocked',
    diagnostics,
    roles: [],
  };
};

const mergeMappedUserWithKeycloak = (
  mapped: IamUserListItem,
  user: IdentityListedUser,
  roleNames: readonly string[] | null
): IamUserListItem => ({
  ...mapped,
  displayName: mapped.displayName || resolveDisplayName(user),
  email: mapped.email ?? user.email,
  status: mapKeycloakUserStatus(user),
  mappingStatus: roleNames === null ? 'manual_review' : 'mapped',
  editability: roleNames === null ? 'blocked' : 'editable',
  diagnostics:
    roleNames === null
      ? [{ code: 'keycloak_projection_degraded', objectId: user.externalId, objectType: 'user' }]
      : mapped.diagnostics,
});

export const resolveTenantKeycloakUsersWithPagination = async (
  input: TenantKeycloakUsersInput
): Promise<{ readonly users: readonly IamUserListItem[]; readonly total: number }> => {
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, { executionMode: 'tenant_admin' });
  if (!identityProvider) {
    throw new Error('tenant_admin_client_not_configured');
  }

  const query = toKeycloakQuery(input);
  const first = Math.max(0, (input.page - 1) * input.pageSize);

  const listedUsers = input.role
    ? await listAllTenantUsers(identityProvider.provider, query)
    : await trackKeycloakCall('list_tenant_users', () =>
        identityProvider.provider.listUsers({ ...query, first, max: input.pageSize })
      );
  const roleNamesBySubject = await resolveRoleNamesForUsers({
    provider: identityProvider.provider,
    users: listedUsers,
    instanceId: input.instanceId,
    requestId: input.requestId,
    traceId: input.traceId,
  });
  const roleFilteredUsers = input.role
    ? listedUsers.filter((user) => roleNamesBySubject.get(user.externalId)?.includes(input.role as string))
    : listedUsers;
  const visibleUsers = input.role ? roleFilteredUsers.slice(first, first + input.pageSize) : roleFilteredUsers;
  const mappedUsersBySubject = await loadMappedUsersBySubject(input.client, {
    instanceId: input.instanceId,
    subjects: visibleUsers.map((user) => user.externalId),
  });

  const users = visibleUsers.map((user) => {
    const roleNames = roleNamesBySubject.get(user.externalId) ?? null;
    const mapped = mappedUsersBySubject.get(user.externalId);
    return mapped
      ? mergeMappedUserWithKeycloak(mapped, user, roleNames)
      : mapUnmappedKeycloakUser(user, roleNames, input.instanceId);
  });

  const total = input.role
    ? roleFilteredUsers.length
    : (await identityProvider.provider.countUsers?.(query)) ?? users.length;

  return { users, total };
};
