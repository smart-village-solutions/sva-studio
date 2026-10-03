import { createHash } from 'node:crypto';
import type { createUserImportPersistence } from '@sva/iam-admin';

import type { IdentityListedUser } from '../identity-provider-port.js';
import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import type { QueryClient } from '../db.js';

import { logger, resolveIdentityProviderForInstance, trackKeycloakCall } from './shared.js';

const KEYCLOAK_READ_ONLY_ATTRIBUTE_ERROR = 'error-user-attribute-read-only';

const normalizeOptionalText = (value: string | undefined | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const hasRequiredImportEmail = (user: IdentityListedUser): boolean =>
  normalizeOptionalText(user.email) !== undefined;

const isReadOnlyAttributeRejection = (error: unknown): boolean =>
  error instanceof KeycloakAdminRequestError &&
  error.statusCode === 400 &&
  !error.retryable &&
  error.fieldErrors.length > 0 &&
  error.fieldErrors.every(
    (fieldError) =>
      (fieldError.field === 'firstName' || fieldError.field === 'lastName') &&
      fieldError.code === KEYCLOAK_READ_ONLY_ATTRIBUTE_ERROR
  );

export const normalizeIdentityUserProfile = (user: IdentityListedUser): IdentityListedUser => ({
  ...user,
  username: normalizeOptionalText(user.username),
  email: normalizeOptionalText(user.email),
  firstName: normalizeOptionalText(user.firstName),
  lastName: normalizeOptionalText(user.lastName),
});

const looksLikeEmail = (value: string | undefined): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) {
    return false;
  }

  const domain = value.slice(atIndex + 1);
  return domain.length > 2 && !domain.includes(' ') && domain.includes('.');
};

export const toSubjectRef = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 12);
export type IdentityProviderResolution = NonNullable<
  Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>
>;

type LoadLocalProfileSeed = ReturnType<typeof createUserImportPersistence>['loadLocalProfileSeed'];
type LocalProfileSeed = Awaited<ReturnType<LoadLocalProfileSeed>>;

type ResolvedProfileFields = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

type ProfileRepairPlan = {
  readonly user: IdentityListedUser;
  readonly update: ResolvedProfileFields;
  readonly repairedUsername: boolean;
  readonly repairedEmail: boolean;
  readonly repairedFirstName: boolean;
  readonly repairedLastName: boolean;
};

const resolveProfileValue = (
  sourceValue: string | undefined,
  seedValue: string | undefined
): string | undefined => normalizeOptionalText(sourceValue) ?? normalizeOptionalText(seedValue);

const resolveProfileEmail = (
  sourceEmail: string | undefined,
  seedEmail: string | undefined,
  username: string | undefined
): string | undefined =>
  resolveProfileValue(sourceEmail, seedEmail) ?? (looksLikeEmail(username) ? username : undefined);

const resolveProfileFields = (
  user: IdentityListedUser,
  localSeed: LocalProfileSeed
): ResolvedProfileFields => {
  const username = resolveProfileValue(user.username, localSeed?.username);
  return {
    username,
    email: resolveProfileEmail(user.email, localSeed?.email, username),
    firstName: resolveProfileValue(user.firstName, localSeed?.firstName),
    lastName: resolveProfileValue(user.lastName, localSeed?.lastName),
  };
};

const buildProfileRepairPlan = (
  user: IdentityListedUser,
  localSeed: LocalProfileSeed
): ProfileRepairPlan | undefined => {
  const sourceUsername = normalizeOptionalText(user.username);
  const sourceEmail = normalizeOptionalText(user.email);
  const sourceFirstName = normalizeOptionalText(user.firstName);
  const sourceLastName = normalizeOptionalText(user.lastName);
  const resolved = resolveProfileFields(user, localSeed);
  const repairedUsername = resolved.username !== sourceUsername;
  const repairedEmail = resolved.email !== sourceEmail;
  const repairedFirstName = resolved.firstName !== sourceFirstName;
  const repairedLastName = resolved.lastName !== sourceLastName;

  if (!repairedEmail && !repairedFirstName && !repairedLastName) {
    return undefined;
  }

  const update = {
    ...(repairedUsername && resolved.username ? { username: resolved.username } : {}),
    ...(repairedEmail && resolved.email ? { email: resolved.email } : {}),
    ...(repairedFirstName && resolved.firstName ? { firstName: resolved.firstName } : {}),
    ...(repairedLastName && resolved.lastName ? { lastName: resolved.lastName } : {}),
  };
  return {
    user: { ...user, ...update },
    update,
    repairedUsername,
    repairedEmail,
    repairedFirstName,
    repairedLastName,
  };
};

export const repairIdentityUserProfileIfPossible = async (
  client: QueryClient,
  input: {
    instanceId: string;
    user: IdentityListedUser;
    identityProvider: IdentityProviderResolution;
    requestId?: string;
    traceId?: string;
  },
  loadLocalProfileSeed: LoadLocalProfileSeed
): Promise<{ user: IdentityListedUser; repaired: boolean }> => {
  const localSeed = await loadLocalProfileSeed(client, {
    instanceId: input.instanceId,
    keycloakSubject: input.user.externalId,
  });
  const repair = buildProfileRepairPlan(input.user, localSeed);
  if (!repair) {
    return { user: input.user, repaired: false };
  }

  try {
    await trackKeycloakCall('repair_imported_user_profile', () =>
      input.identityProvider.provider.updateUser(input.user.externalId, repair.update)
    );
  } catch (error) {
    if (repair.repairedUsername || repair.repairedEmail || !isReadOnlyAttributeRejection(error)) {
      throw error;
    }

    logger.warn('Optional Keycloak user name repair skipped during IAM sync', {
      operation: 'sync_keycloak_users',
      instance_id: input.instanceId,
      auth_realm: input.identityProvider.realm,
      provider_source: input.identityProvider.source,
      request_id: input.requestId,
      trace_id: input.traceId,
      subject_ref: toSubjectRef(input.user.externalId),
      reason: 'optional_name_update_failed',
      repaired_first_name: repair.repairedFirstName,
      repaired_last_name: repair.repairedLastName,
    });

    return { repaired: false, user: repair.user };
  }

  logger.info('Keycloak user profile repaired during IAM sync', {
    operation: 'sync_keycloak_users',
    instance_id: input.instanceId,
    auth_realm: input.identityProvider.realm,
    provider_source: input.identityProvider.source,
    request_id: input.requestId,
    trace_id: input.traceId,
    subject_ref: toSubjectRef(input.user.externalId),
    repaired_email: repair.repairedEmail,
    repaired_first_name: repair.repairedFirstName,
    repaired_last_name: repair.repairedLastName,
  });

  return { repaired: true, user: repair.user };
};
