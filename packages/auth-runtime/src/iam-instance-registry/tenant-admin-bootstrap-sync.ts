import type { TenantAdminBootstrap } from '@sva/instance-registry';
import type { QueryClient } from '../db.js';

import { jitProvisionAccountWithClient } from '../jit-provisioning.js';
import { assignRoles, notifyPermissionInvalidation, resolveRolesByExternalNames } from '../iam-account-management/shared.js';
import { resolveIdentityProviderForInstance, withInstanceScopedDb } from '../iam-account-management/shared-runtime.js';

const SYSTEM_ADMIN_ROLE = 'system_admin';

type ExistingRoleRow = {
  readonly role_id: string;
};

const loadExistingDirectRoleIds = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId: string;
  }
): Promise<readonly string[]> => {
  const result = await client.query<ExistingRoleRow>(
    `
SELECT role_id
FROM iam.account_roles
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND valid_from <= NOW()
  AND (valid_to IS NULL OR valid_to > NOW());
`,
    [input.instanceId, input.accountId]
  );

  return result.rows.map((row) => row.role_id);
};

const resolveTenantAdminIdentityUser = async (input: {
  instanceId: string;
  tenantAdminBootstrap: TenantAdminBootstrap;
}) => {
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
    throw new Error('tenant_admin_identity_provider_unavailable');
  }

  const bootstrapUsername = input.tenantAdminBootstrap.username.trim();
  const bootstrapEmail = input.tenantAdminBootstrap.email?.trim() || undefined;

  const [usernameMatch] = await identityProvider.provider.listUsers({
    username: bootstrapUsername,
    max: 1,
  });
  const [emailMatch] = bootstrapEmail
    ? await identityProvider.provider.listUsers({
        email: bootstrapEmail,
        max: 1,
      })
    : [];
  const user = usernameMatch ?? emailMatch ?? null;

  if (!user) {
    throw new Error('tenant_admin_bootstrap_user_not_found');
  }

  return {
    identityProvider,
    user,
  };
};

export const syncTenantAdminBootstrapAccount = async (input: {
  instanceId: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
  requestId?: string;
  actorId?: string;
}) => {
  if (!input.tenantAdminBootstrap?.username.trim()) {
    return;
  }

  const { user } = await resolveTenantAdminIdentityUser({
    instanceId: input.instanceId,
    tenantAdminBootstrap: input.tenantAdminBootstrap,
  });

  await withInstanceScopedDb(input.instanceId, async (client) => {
    const provisioned = await jitProvisionAccountWithClient(client, {
      instanceId: input.instanceId,
      keycloakSubject: user.externalId,
      requestId: input.requestId,
      emitAuditLog: false,
    });

    const systemAdminRoles = await resolveRolesByExternalNames(client, {
      instanceId: input.instanceId,
      externalRoleNames: [SYSTEM_ADMIN_ROLE],
    });
    const systemAdminRole = systemAdminRoles.find((role) => role.role_key === SYSTEM_ADMIN_ROLE);
    if (!systemAdminRole) {
      throw new Error('tenant_admin_local_system_admin_missing');
    }

    const existingRoleIds = await loadExistingDirectRoleIds(client, {
      instanceId: input.instanceId,
      accountId: provisioned.accountId,
    });

    await assignRoles(client, {
      instanceId: input.instanceId,
      accountId: provisioned.accountId,
      existingRoleIds,
      roleIds: [...existingRoleIds, systemAdminRole.id],
    });

    await notifyPermissionInvalidation(client, {
      instanceId: input.instanceId,
      keycloakSubject: user.externalId,
      trigger: 'tenant_admin_bootstrap_sync',
    });
  });
};
