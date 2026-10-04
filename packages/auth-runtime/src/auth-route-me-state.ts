import { type IamUserGroupAssignment } from '@sva/core';
import { resolveEffectivePermissions } from './iam-authorization/permission-store.js';
import { filterTenantEffectivePermissions } from './iam-authorization/root-only-permissions.js';
import { withInstanceScopedDb } from './iam-authorization/shared.js';
import { withRegistryRepository } from './iam-instance-registry/repository.js';
import { resolveConfiguredPluginTenantModuleAccess } from './plugin-tenant-lifecycle/access.js';
import { buildLogContext } from './log-context.js';
import { logger, createAuthMeHeaders, collectEffectivePermissionActions } from './auth-route-responses.js';
import { type AuthMeResolution } from './auth-route-state.js';

const loadAuthMePermissionState = async (user: {
  id: string;
  instanceId?: string;
}): Promise<Pick<AuthMeResolution, 'permissionActions' | 'permissionStatus'>> => {
  if (!user.instanceId) {
    return {
      permissionActions: [],
      permissionStatus: 'ok',
    };
  }

  try {
    const resolvedPermissions = await resolveEffectivePermissions({
      instanceId: user.instanceId,
      keycloakSubject: user.id,
    });

    if (resolvedPermissions.ok) {
      const filteredPermissions = filterTenantEffectivePermissions(resolvedPermissions.permissions);
      return {
        permissionActions: collectEffectivePermissionActions(filteredPermissions),
        permissionStatus: 'ok',
      };
    }

    logger.warn('Auth me resolved user but permission snapshot failed', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      reason_code: 'permission_snapshot_unavailable',
      ...buildLogContext({ kind: 'instance', instanceId: user.instanceId }),
    });
  } catch (error) {
    logger.error('Auth me permission action lookup failed', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      error_type: error instanceof Error ? error.name : typeof error,
      reason_code: 'permission_action_lookup_failed',
      ...buildLogContext({ kind: 'instance', instanceId: user.instanceId }),
    });
  }

  return {
    permissionActions: [],
    permissionStatus: 'degraded',
  };
};

const loadAssignedModulesForAuthMe = async (user: {
  instanceId?: string;
}): Promise<Pick<AuthMeResolution, 'assignedModules' | 'moduleAccessPending'>> => {
  if (!user.instanceId) {
    return { assignedModules: [], moduleAccessPending: false };
  }
  const instanceId = user.instanceId;

  try {
    const assignedModules = Array.from(
      await withRegistryRepository((repository) => repository.listAssignedModules(instanceId))
    );
    const access = await resolveConfiguredPluginTenantModuleAccess(instanceId, assignedModules);
    return {
      assignedModules: Array.from(access.accessibleModules),
      moduleAccessPending: access.hasPendingLifecycleAccess,
    };
  } catch (error) {
    logger.error('Auth me assigned module lookup failed', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      error_type: error instanceof Error ? error.name : typeof error,
      reason_code: 'assigned_module_lookup_failed',
      ...buildLogContext({ kind: 'instance', instanceId }),
    });
    return { assignedModules: [], moduleAccessPending: true };
  }
};

const loadInstanceDisplayNameForAuthMe = async (user: {
  instanceId?: string;
}): Promise<string | undefined> => {
  if (!user.instanceId) {
    return undefined;
  }
  const instanceId = user.instanceId;

  try {
    const instance = await withRegistryRepository((repository) =>
      repository.getInstanceById(instanceId)
    );
    const displayName = instance?.displayName.trim();
    return displayName || undefined;
  } catch (error) {
    logger.error('Auth me instance display name lookup failed', {
      endpoint: '/auth/me',
      operation: 'get_current_user',
      error_type: error instanceof Error ? error.name : typeof error,
      reason_code: 'instance_display_name_lookup_failed',
      ...buildLogContext({ kind: 'instance', instanceId }),
    });
    return undefined;
  }
};

type AuthMeGroupRow = {
  readonly group_id: string;
  readonly group_key: string;
  readonly display_name: string;
  readonly group_type: IamUserGroupAssignment['groupType'];
  readonly origin: IamUserGroupAssignment['origin'];
  readonly valid_from: string | null;
  readonly valid_until: string | null;
};

const loadGroupsForAuthMe = async (user: {
  id: string;
  instanceId?: string;
}): Promise<readonly IamUserGroupAssignment[]> => {
  if (!user.instanceId) {
    return [];
  }

  try {
    const rows = await withInstanceScopedDb(user.instanceId, async (client) => {
      const result = await client.query<AuthMeGroupRow>(
        `
SELECT
  g.id AS group_id,
  g.group_key,
  g.display_name,
  g.group_type,
  ag.origin,
  ag.valid_from,
  ag.valid_until
FROM iam.accounts a
JOIN iam.account_groups ag
  ON ag.instance_id = a.instance_id
 AND ag.account_id = a.id
JOIN iam.groups g
  ON g.instance_id = ag.instance_id
 AND g.id = ag.group_id
WHERE a.instance_id = $1
  AND a.keycloak_subject = $2
  AND g.is_active = true
  AND (ag.valid_from IS NULL OR ag.valid_from <= NOW())
  AND (ag.valid_until IS NULL OR ag.valid_until > NOW())
ORDER BY g.display_name ASC, g.group_key ASC
        `,
        [user.instanceId, user.id]
      );

      return result.rows;
    });

    return rows.map((row) => ({
      groupId: row.group_id,
      groupKey: row.group_key,
      displayName: row.display_name,
      groupType: row.group_type,
      origin: row.origin,
      validFrom: row.valid_from ?? undefined,
      validTo: row.valid_until ?? undefined,
    }));
  } catch (error) {
    logger.error('Auth me group lookup failed', {
      reason_code: 'group_lookup_failed',
      error_type: error instanceof Error ? error.name : typeof error,
      ...buildLogContext(
        user.instanceId ? { kind: 'instance', instanceId: user.instanceId } : undefined
      ),
    });
    return [];
  }
};

export const resolveAuthMeState = async (user: {
  id: string;
  instanceId?: string;
}): Promise<AuthMeResolution> => {
  const permissionState = await loadAuthMePermissionState(user);
  const moduleAccess = await loadAssignedModulesForAuthMe(user);
  const instanceDisplayName = await loadInstanceDisplayNameForAuthMe(user);
  const groups = await loadGroupsForAuthMe(user);

  return {
    ...permissionState,
    ...moduleAccess,
    groups,
    instanceDisplayName,
  };
};

export const createAuthMeResponse = (
  user: Record<string, unknown>,
  resolution: AuthMeResolution,
  expiresAt?: number
) => {
  const permissionStatus =
    user.permissionStatus === 'degraded' || resolution.permissionStatus === 'degraded'
      ? 'degraded'
      : 'ok';

  return new Response(
    JSON.stringify({
      ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
      user: {
        ...user,
        assignedModules: resolution.assignedModules,
        moduleAccessPending: resolution.moduleAccessPending,
        groups: resolution.groups,
        ...(resolution.instanceDisplayName
          ? { instanceDisplayName: resolution.instanceDisplayName }
          : {}),
        permissionActions: resolution.permissionActions,
        permissionStatus,
      },
    }),
    {
      status: 200,
      headers: createAuthMeHeaders(),
    }
  );
};
