import { createSdkLogger } from '@sva/server-runtime';

import { resolvePool, withResolvedInstanceDb, type QueryClient } from './db.js';
import { buildLogContext } from './log-context.js';
import type { SessionUser } from './types.js';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });

type EffectiveRoleRow = {
  readonly role_key: string;
};

type EffectiveSessionRoleDeps = {
  readonly resolvePool: typeof resolvePool;
  readonly withResolvedInstanceDb: typeof withResolvedInstanceDb;
};

const defaultDeps: EffectiveSessionRoleDeps = {
  resolvePool,
  withResolvedInstanceDb,
};

const normalizeRoleNames = (roles: readonly string[]): readonly string[] =>
  [...new Set(roles.map((role) => role.trim()).filter((role) => role.length > 0))];

const loadPersistedEffectiveRoleNames = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
  }
): Promise<readonly string[]> => {
  const result = await client.query<EffectiveRoleRow>(
    `
SELECT DISTINCT role_key
FROM (
  SELECT r.role_key
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
  WHERE a.keycloak_subject = $2

  UNION

  SELECT r.role_key
  FROM iam.accounts a
  JOIN iam.instance_memberships im
    ON im.account_id = a.id
   AND im.instance_id = $1
  JOIN iam.account_groups ag
    ON ag.instance_id = im.instance_id
   AND ag.account_id = im.account_id
   AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
   AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
  JOIN iam.groups g
    ON g.instance_id = ag.instance_id
   AND g.id = ag.group_id
   AND g.is_active = true
  JOIN iam.group_roles gr
    ON gr.instance_id = ag.instance_id
   AND gr.group_id = ag.group_id
  JOIN iam.roles r
    ON r.instance_id = gr.instance_id
   AND r.id = gr.role_id
  WHERE a.keycloak_subject = $2
) AS effective_roles
ORDER BY role_key ASC
    `,
    [input.instanceId, input.keycloakSubject]
  );

  return normalizeRoleNames(result.rows.map((row) => row.role_key));
};

export const enrichSessionUserWithEffectiveRoles = async (
  user: SessionUser,
  deps: EffectiveSessionRoleDeps = defaultDeps
): Promise<SessionUser> => {
  const instanceId = user.instanceId;
  if (!instanceId) {
    return user;
  }

  try {
    const persistedRoleNames = await deps.withResolvedInstanceDb(
      deps.resolvePool,
      instanceId,
      async (client) =>
        loadPersistedEffectiveRoleNames(client, {
          instanceId,
          keycloakSubject: user.id,
        })
    );
    const mergedRoles = normalizeRoleNames([...persistedRoleNames]);

    if (
      mergedRoles.length === user.roles.length &&
      mergedRoles.every((roleName, index) => roleName === user.roles[index])
    ) {
      return user;
    }

    return {
      ...user,
      roles: [...mergedRoles],
    };
  } catch (error) {
    logger.warn('Effective IAM role hydration failed for session user', {
      user_id: user.id,
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
      ...buildLogContext({ kind: 'instance', instanceId }),
    });
    return {
      ...user,
      roles: [],
      permissionStatus: 'degraded',
    };
  }
};
