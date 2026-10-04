import { createSdkLogger } from '@sva/server-runtime';
import type { TenantAdminStatus } from './provisioning-auth-types.js';
import type { KeycloakAdminUser, KeycloakProvisioningClient } from './provisioning-auth-client.js';
import { STUDIO_OWNERSHIP_ATTRIBUTES, readStudioOwnedUser } from './provisioning-auth-policy.js';
import { SYSTEM_ADMIN_ROLE } from './provisioning-auth-utils.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

type TenantAdminInput = {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword?: string;
};

const isConflictRequestError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'statusCode' in error &&
  (error as { readonly statusCode?: unknown }).statusCode === 409;

export const ensureTenantAdmin = async (
  client: KeycloakProvisioningClient,
  input: TenantAdminInput & { instanceId: string }
): Promise<void> => {
  const checkpoint = (result: string) =>
    logger.info('tenant_admin_bootstrap_checkpoint', {
      operation: 'ensure_tenant_admin',
      instance_id: input.instanceId,
      result,
    });
  checkpoint('started');
  const ownershipAttributes = {
    [STUDIO_OWNERSHIP_ATTRIBUTES.managedBy]: ['studio'],
    [STUDIO_OWNERSHIP_ATTRIBUTES.instanceId]: [input.instanceId],
    [STUDIO_OWNERSHIP_ATTRIBUTES.artifactKey]: ['tenant_admin'],
  } as const;
  const syncTenantAdminAccess = async (userId: string) => {
    await client.syncRoles(userId, [SYSTEM_ADMIN_ROLE]);
    checkpoint('roles_synced');
    if (!input.temporaryPassword) {
      return;
    }
    await client.setUserPassword(userId, input.temporaryPassword, true);
    await client.setUserRequiredActions(userId, ['UPDATE_PASSWORD']);
  };

  const updateExisting = async (user: KeycloakAdminUser) => {
    if (readStudioOwnedUser(user, input.instanceId, 'tenant_admin') !== 'owned') {
      throw new Error('tenant_admin_ownership_conflict');
    }
    await client.updateUser(user.id, {
      username: input.username,
      email: input.email ?? user.email ?? fallbackEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: user.enabled ?? true,
      attributes: ownershipAttributes,
    });
    await syncTenantAdminAccess(user.id);
    checkpoint('completed');
  };

  const fallbackEmail = `${input.username}@tenant.invalid`;
  const resolvedEmail = input.email ?? fallbackEmail;

  const existing = await client.findUserByUsername(input.username);
  checkpoint(existing ? 'user_found' : 'user_missing');
  if (!existing) {
    try {
      const created = await client.createUser({
        username: input.username,
        email: resolvedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        attributes: ownershipAttributes,
      });
      checkpoint('user_created');
      await syncTenantAdminAccess(created.externalId);
      checkpoint('completed');
      return;
    } catch (error) {
      if (!isConflictRequestError(error)) {
        throw error;
      }

      const conflictingUser = await client.findUserByUsername(input.username);
      checkpoint(conflictingUser ? 'conflict_user_found' : 'conflict_user_missing');
      if (!conflictingUser) {
        throw error;
      }

      await updateExisting(conflictingUser);
      return;
    }
  }
  await updateExisting(existing);
};

export const readTenantAdminStatus = async (
  client: KeycloakProvisioningClient,
  input: {
    username: string | undefined;
  }
): Promise<{ status: TenantAdminStatus; representation: KeycloakAdminUser | null }> => {
  if (!input.username) {
    return {
      status: { tenantAdminExists: false, tenantAdminHasSystemAdmin: false },
      representation: null,
    };
  }

  const tenantAdmin = await client.findUserByUsername(input.username);
  const tenantAdminRoles = tenantAdmin ? await client.listUserRoleNames(tenantAdmin.id) : [];
  return {
    status: {
      tenantAdminExists: Boolean(tenantAdmin),
      tenantAdminHasSystemAdmin: tenantAdminRoles.includes(SYSTEM_ADMIN_ROLE),
    },
    representation: tenantAdmin,
  };
};
