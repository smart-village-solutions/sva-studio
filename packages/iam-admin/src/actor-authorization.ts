import type { ApiErrorCode } from '@sva/core';

import type { QueryClient } from './query-client.js';
import { resolveRolesByExternalNames, resolveRolesByIds } from './role-resolution.js';
import type { IamRoleRow } from './types.js';

export const resolveActorMaxRoleLevel = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly keycloakSubject: string; readonly sessionRoleNames?: readonly string[] }
): Promise<number> => {
  const row = await client.query<{ readonly max_role_level: number }>(
    `
SELECT COALESCE(MAX(r.role_level), 0)::int AS max_role_level
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE a.keycloak_subject = $2;
`,
    [input.instanceId, input.keycloakSubject]
  );
  const persistedMaxRoleLevel = row.rows[0]?.max_role_level ?? 0;
  const normalizedSessionRoleNames =
    input.sessionRoleNames
      ?.map((roleName) => roleName.trim())
      .filter((roleName) => roleName.length > 0) ?? [];

  if (normalizedSessionRoleNames.includes('system_admin')) {
    return Math.max(persistedMaxRoleLevel, 100);
  }

  if (normalizedSessionRoleNames.length === 0) {
    return persistedMaxRoleLevel;
  }

  const sessionRoles = await resolveRolesByExternalNames(client, {
    instanceId: input.instanceId,
    externalRoleNames: normalizedSessionRoleNames,
  });
  const sessionMaxRoleLevel = sessionRoles.reduce(
    (maxRoleLevel, role) => Math.max(maxRoleLevel, role.role_level),
    0
  );

  return Math.max(persistedMaxRoleLevel, sessionMaxRoleLevel);
};

const canAssignRoles = (input: {
  readonly actorMaxRoleLevel: number;
  readonly targetRoles: readonly IamRoleRow[];
}): boolean => input.targetRoles.every((role) => role.role_level <= input.actorMaxRoleLevel);

export const ensureActorCanManageTarget = (input: {
  readonly actorMaxRoleLevel: number;
  readonly actorRoles: readonly string[];
  readonly targetRoles: readonly {
    readonly roleKey: string;
    readonly roleLevel: number;
  }[];
}): { ok: true } | { ok: false; code: ApiErrorCode; message: string } => {
  if (input.actorRoles.includes('system_admin')) {
    return { ok: true };
  }

  const targetMaxRoleLevel = input.targetRoles.reduce((maxLevel, role) => Math.max(maxLevel, role.roleLevel), 0);
  if (targetMaxRoleLevel > input.actorMaxRoleLevel) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Zielnutzer überschreitet die eigene Berechtigungsstufe.',
    };
  }

  const targetHasSystemAdmin = input.targetRoles.some((role) => role.roleKey === 'system_admin');
  const actorIsSystemAdmin = input.actorRoles.includes('system_admin');
  if (targetHasSystemAdmin && !actorIsSystemAdmin) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Nur system_admin darf system_admin-Nutzer verwalten.',
    };
  }

  return { ok: true };
};

export const resolveSystemAdminCount = async (client: QueryClient, instanceId: string): Promise<number> => {
  const result = await client.query<{ readonly admin_count: number }>(
    `
SELECT COUNT(DISTINCT a.id)::int AS admin_count
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE a.status = 'active'
    AND r.role_key = 'system_admin';
`,
    [instanceId]
  );
  return result.rows[0]?.admin_count ?? 0;
};

export const isSystemAdminAccount = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly accountId: string }
): Promise<boolean> => {
  const result = await client.query<{ readonly has_role: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM iam.account_roles ar
  JOIN iam.roles r
    ON r.instance_id = ar.instance_id
   AND r.id = ar.role_id
  WHERE ar.instance_id = $1
    AND ar.account_id = $2::uuid
    AND ar.valid_from <= NOW()
    AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
    AND r.role_key = 'system_admin'
) AS has_role;
`,
    [input.instanceId, input.accountId]
  );
  return Boolean(result.rows[0]?.has_role);
};

export const ensureRoleAssignmentWithinActorLevel = async (input: {
  readonly client: QueryClient;
  readonly instanceId: string;
  readonly actorSubject: string;
  readonly actorRoles?: readonly string[];
  readonly roleIds: readonly string[];
}): Promise<{ ok: true; roles: readonly IamRoleRow[] } | { ok: false; code: ApiErrorCode; message: string }> => {
  const roles = await resolveRolesByIds(input.client, {
    instanceId: input.instanceId,
    roleIds: input.roleIds,
  });
  if (roles.length !== input.roleIds.length) {
    return { ok: false, code: 'invalid_request', message: 'Mindestens eine Rolle existiert nicht.' };
  }

  if (input.actorRoles?.includes('system_admin')) {
    return { ok: true, roles };
  }

  const actorMaxRoleLevel = await resolveActorMaxRoleLevel(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
    sessionRoleNames: input.actorRoles,
  });
  if (!canAssignRoles({ actorMaxRoleLevel, targetRoles: roles })) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Rollenzuweisung überschreitet die eigene Berechtigungsstufe.',
    };
  }

  return { ok: true, roles };
};
