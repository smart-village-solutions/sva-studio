import { createSdkLogger } from '@sva/server-runtime';
import type { TenantAdminStatus } from './provisioning-auth-types.js';
import type { KeycloakAdminUser, KeycloakProvisioningClient } from './provisioning-auth-client.js';
import {
  isUnmarkedStudioUser,
  STUDIO_OWNERSHIP_ATTRIBUTES,
  readStudioOwnedUser,
} from './provisioning-auth-policy.js';
import { SYSTEM_ADMIN_ROLE } from './provisioning-auth-utils.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

type TenantAdminInput = {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword?: string;
  adoptExisting?: boolean;
};

type ScopedTenantAdminInput = TenantAdminInput & { instanceId: string };
type TenantAdminCheckpoint = (result: string) => void;

const isConflictRequestError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'statusCode' in error &&
  (error as { readonly statusCode?: unknown }).statusCode === 409;

export const ensureTenantAdmin = async (
  client: KeycloakProvisioningClient,
  input: ScopedTenantAdminInput
): Promise<void> => {
  const checkpoint = createTenantAdminCheckpoint(input.instanceId);
  checkpoint('started');
  const ownershipAttributes = buildTenantAdminOwnershipAttributes(input.instanceId);
  const fallbackEmail = `${input.username}@tenant.invalid`;
  const resolvedEmail = input.email ?? fallbackEmail;
  const existing = await findExistingTenantAdmin(client, input);
  checkpoint(existing ? 'user_found' : 'user_missing');
  if (existing) {
    await updateExistingTenantAdmin(client, input, existing, ownershipAttributes, checkpoint);
    return;
  }
  if (input.adoptExisting) throw new Error('tenant_admin_ownership_conflict');

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
    await syncTenantAdminAccess(client, input, created.externalId, checkpoint);
    checkpoint('completed');
  } catch (error) {
    if (!isConflictRequestError(error)) throw error;

    const conflictingUser = await client.findUserByUsername(input.username);
    checkpoint(conflictingUser ? 'conflict_user_found' : 'conflict_user_missing');
    if (!conflictingUser) throw error;
    await updateExistingTenantAdmin(
      client,
      input,
      conflictingUser,
      ownershipAttributes,
      checkpoint
    );
  }
};

const createTenantAdminCheckpoint =
  (instanceId: string): TenantAdminCheckpoint =>
  (result) =>
    logger.info('tenant_admin_bootstrap_checkpoint', {
      operation: 'ensure_tenant_admin',
      instance_id: instanceId,
      result,
    });

const buildTenantAdminOwnershipAttributes = (instanceId: string) => ({
  [STUDIO_OWNERSHIP_ATTRIBUTES.managedBy]: ['studio'],
  [STUDIO_OWNERSHIP_ATTRIBUTES.instanceId]: [instanceId],
  [STUDIO_OWNERSHIP_ATTRIBUTES.artifactKey]: ['tenant_admin'],
});

const findExistingTenantAdmin = async (
  client: KeycloakProvisioningClient,
  input: TenantAdminInput
): Promise<KeycloakAdminUser | null> => {
  if (!input.adoptExisting) return client.findUserByUsername(input.username);
  const matches = input.email ? await client.findUsersByEmail(input.email) : [];
  return matches.length === 1 && normalizeEmail(matches[0]?.email) === normalizeEmail(input.email)
    ? (matches[0] ?? null)
    : null;
};

const syncTenantAdminAccess = async (
  client: KeycloakProvisioningClient,
  input: TenantAdminInput,
  userId: string,
  checkpoint: TenantAdminCheckpoint
): Promise<void> => {
  if (input.adoptExisting) await client.assignRealmRoles(userId, [SYSTEM_ADMIN_ROLE]);
  else await client.syncRoles(userId, [SYSTEM_ADMIN_ROLE]);
  checkpoint('roles_synced');
  if (!input.temporaryPassword) return;
  await client.setUserPassword(userId, input.temporaryPassword, true);
  await client.setUserRequiredActions(userId, ['UPDATE_PASSWORD']);
};

const updateExistingTenantAdmin = async (
  client: KeycloakProvisioningClient,
  input: ScopedTenantAdminInput,
  user: KeycloakAdminUser,
  ownershipAttributes: ReturnType<typeof buildTenantAdminOwnershipAttributes>,
  checkpoint: TenantAdminCheckpoint
): Promise<void> => {
  const owned = readStudioOwnedUser(user, input.instanceId, 'tenant_admin') === 'owned';
  const emailMatches =
    input.adoptExisting && input.email ? await client.findUsersByEmail(input.email) : [];
  const adoptable =
    input.adoptExisting === true &&
    isUnmarkedStudioUser(user) &&
    normalizeEmail(user.email) === normalizeEmail(input.email) &&
    emailMatches.length === 1 &&
    emailMatches[0]?.id === user.id;
  if (!owned && !adoptable) throw new Error('tenant_admin_ownership_conflict');

  await client.updateUser(user.id, {
    username: input.adoptExisting ? user.username! : input.username,
    email: input.adoptExisting
      ? user.email!
      : (input.email ?? user.email ?? `${input.username}@tenant.invalid`),
    firstName: input.firstName,
    lastName: input.lastName,
    enabled: user.enabled ?? !input.adoptExisting,
    attributes: { ...(user.attributes ?? {}), ...ownershipAttributes },
  });
  await syncTenantAdminAccess(client, input, user.id, checkpoint);
  checkpoint('completed');
};

const normalizeEmail = (email: string | undefined): string | undefined =>
  email?.trim().toLocaleLowerCase('en-US');

export const assertTenantAdminAdoptionTarget = async (
  client: KeycloakProvisioningClient,
  input: ScopedTenantAdminInput
): Promise<void> => {
  if (!input.adoptExisting) return;
  const emailMatches = input.email ? await client.findUsersByEmail(input.email) : [];
  const user = emailMatches.length === 1 ? emailMatches[0] : undefined;
  if (
    !user ||
    (!isUnmarkedStudioUser(user) &&
      readStudioOwnedUser(user, input.instanceId, 'tenant_admin') !== 'owned') ||
    normalizeEmail(user.email) !== normalizeEmail(input.email) ||
    emailMatches.length !== 1 ||
    emailMatches[0]?.id !== user.id
  ) {
    throw new Error('tenant_admin_ownership_conflict');
  }
};

export const readTenantAdminStatus = async (
  client: KeycloakProvisioningClient,
  input: {
    username: string | undefined;
    email?: string;
    adoptExisting?: boolean;
  }
): Promise<{ status: TenantAdminStatus; representation: KeycloakAdminUser | null }> => {
  if (!input.username && !input.adoptExisting) {
    return {
      status: { tenantAdminExists: false, tenantAdminHasSystemAdmin: false },
      representation: null,
    };
  }

  const emailMatches = input.email ? await client.findUsersByEmail(input.email) : [];
  const tenantAdmin = input.adoptExisting
    ? emailMatches.length === 1 &&
      normalizeEmail(emailMatches[0]?.email) === normalizeEmail(input.email)
      ? emailMatches[0]
      : null
    : input.username
      ? await client.findUserByUsername(input.username)
      : null;
  const tenantAdminRoles = tenantAdmin ? await client.listUserRoleNames(tenantAdmin.id) : [];
  const representation = tenantAdmin
    ? {
        ...tenantAdmin,
        emailUniqueMatch: emailMatches.length === 1 && emailMatches[0]?.id === tenantAdmin.id,
      }
    : null;
  return {
    status: {
      tenantAdminExists: Boolean(tenantAdmin),
      tenantAdminHasSystemAdmin: tenantAdminRoles.includes(SYSTEM_ADMIN_ROLE),
    },
    representation,
  };
};
