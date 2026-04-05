import type { ActorInfo } from './types.js';
import { z } from 'zod';

import { jitProvisionAccountWithClient } from '../jit-provisioning.server.js';
import type { QueryClient } from '../shared/db-helpers.js';

import { protectField } from './encryption.js';
import {
  emitActivityLog,
  logger,
  resolveActorAccountId,
  withInstanceScopedDb,
} from './shared.js';
import { updateMyProfileSchema } from './schemas.js';
import { resolveUserDetail } from './user-detail-query.js';

export type ProfileUpdatePayload = z.infer<typeof updateMyProfileSchema>;

type SessionProfileSeed = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
};

const UPDATE_PROFILE_QUERY = `
UPDATE iam.accounts
SET
  username_ciphertext = COALESCE($3, username_ciphertext),
  email_ciphertext = COALESCE($4, email_ciphertext),
  first_name_ciphertext = COALESCE($5, first_name_ciphertext),
  last_name_ciphertext = COALESCE($6, last_name_ciphertext),
  display_name_ciphertext = COALESCE($7, display_name_ciphertext),
  phone_ciphertext = COALESCE($8, phone_ciphertext),
  position = COALESCE($9, position),
  department = COALESCE($10, department),
  preferred_language = COALESCE($11, preferred_language),
  timezone = COALESCE($12, timezone),
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2;
`;

const resolveOrProvisionAccountId = async (
  client: QueryClient,
  actor: ActorInfo,
  keycloakSubject: string
): Promise<string> => {
  const existingAccountId = await resolveActorAccountId(client, {
    instanceId: actor.instanceId,
    keycloakSubject,
  });
  if (existingAccountId) {
    return existingAccountId;
  }

  const provisioned = await jitProvisionAccountWithClient(client, {
    instanceId: actor.instanceId,
    keycloakSubject,
    requestId: actor.requestId,
    traceId: actor.traceId,
    // Self-service reads must not fail only because audit inserts are stricter than the read path.
    emitAuditLog: false,
  });
  return provisioned.accountId;
};

const buildProfileUpdateParams = (
  accountId: string,
  instanceId: string,
  keycloakSubject: string,
  payload: ProfileUpdatePayload
): readonly (string | null)[] => [
  accountId,
  instanceId,
  payload.username ? protectField(payload.username, `iam.accounts.username:${keycloakSubject}`) : null,
  payload.email ? protectField(payload.email, `iam.accounts.email:${keycloakSubject}`) : null,
  payload.firstName ? protectField(payload.firstName, `iam.accounts.first_name:${keycloakSubject}`) : null,
  payload.lastName ? protectField(payload.lastName, `iam.accounts.last_name:${keycloakSubject}`) : null,
  payload.displayName ? protectField(payload.displayName, `iam.accounts.display_name:${keycloakSubject}`) : null,
  payload.phone ? protectField(payload.phone, `iam.accounts.phone:${keycloakSubject}`) : null,
  payload.position ?? null,
  payload.department ?? null,
  payload.preferredLanguage ?? null,
  payload.timezone ?? null,
];

const persistProfileUpdate = async (
  client: QueryClient,
  actor: ActorInfo,
  accountId: string,
  keycloakSubject: string,
  payload: ProfileUpdatePayload
): Promise<void> => {
  await client.query(
    UPDATE_PROFILE_QUERY,
    buildProfileUpdateParams(accountId, actor.instanceId, keycloakSubject, payload)
  );

  await emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId,
    subjectId: accountId,
    eventType: 'user.profile_updated',
    result: 'success',
    requestId: actor.requestId,
    traceId: actor.traceId,
  });
};

const normalizeSeedValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const buildSeedDisplayName = (input: SessionProfileSeed): string | undefined => {
  const explicitDisplayName = normalizeSeedValue(input.displayName);
  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const fullName = [normalizeSeedValue(input.firstName), normalizeSeedValue(input.lastName)]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .trim();

  return fullName || normalizeSeedValue(input.username);
};

const PROFILE_SESSION_SEED_SAVEPOINT = 'iam_profile_session_seed';

const seedProfileFromSessionIfMissing = async (
  client: QueryClient,
  actor: ActorInfo,
  accountId: string,
  keycloakSubject: string,
  sessionProfile: SessionProfileSeed | undefined
): Promise<void> => {
  const username = normalizeSeedValue(sessionProfile?.username);
  const email = normalizeSeedValue(sessionProfile?.email);
  const firstName = normalizeSeedValue(sessionProfile?.firstName);
  const lastName = normalizeSeedValue(sessionProfile?.lastName);
  const displayName = buildSeedDisplayName(sessionProfile ?? {});

  if (!username && !email && !firstName && !lastName && !displayName) {
    return;
  }

  await client.query(
    `
UPDATE iam.accounts
SET
  username_ciphertext = CASE
    WHEN username_ciphertext IS NULL AND $3 IS NOT NULL THEN $3
    ELSE username_ciphertext
  END,
  email_ciphertext = CASE
    WHEN email_ciphertext IS NULL AND $4 IS NOT NULL THEN $4
    ELSE email_ciphertext
  END,
  first_name_ciphertext = CASE
    WHEN first_name_ciphertext IS NULL AND $5 IS NOT NULL THEN $5
    ELSE first_name_ciphertext
  END,
  last_name_ciphertext = CASE
    WHEN last_name_ciphertext IS NULL AND $6 IS NOT NULL THEN $6
    ELSE last_name_ciphertext
  END,
  display_name_ciphertext = CASE
    WHEN display_name_ciphertext IS NULL AND $7 IS NOT NULL THEN $7
    ELSE display_name_ciphertext
  END,
  updated_at = CASE
    WHEN
      (username_ciphertext IS NULL AND $3 IS NOT NULL) OR
      (email_ciphertext IS NULL AND $4 IS NOT NULL) OR
      (first_name_ciphertext IS NULL AND $5 IS NOT NULL) OR
      (last_name_ciphertext IS NULL AND $6 IS NOT NULL) OR
      (display_name_ciphertext IS NULL AND $7 IS NOT NULL)
    THEN NOW()
    ELSE updated_at
  END
WHERE id = $1::uuid
  AND instance_id = $2;
`,
    [
      accountId,
      actor.instanceId,
      username ? protectField(username, `iam.accounts.username:${keycloakSubject}`) : null,
      email ? protectField(email, `iam.accounts.email:${keycloakSubject}`) : null,
      firstName ? protectField(firstName, `iam.accounts.first_name:${keycloakSubject}`) : null,
      lastName ? protectField(lastName, `iam.accounts.last_name:${keycloakSubject}`) : null,
      displayName ? protectField(displayName, `iam.accounts.display_name:${keycloakSubject}`) : null,
    ]
  );
};

export const loadMyProfileDetail = async (
  actor: ActorInfo,
  keycloakSubject: string,
  sessionProfile?: SessionProfileSeed
) => withInstanceScopedDb(actor.instanceId, async (client) => {
  const accountId = await resolveOrProvisionAccountId(client, actor, keycloakSubject);

  try {
    await client.query(`SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
    await seedProfileFromSessionIfMissing(client, actor, accountId, keycloakSubject, sessionProfile);
    await client.query(`RELEASE SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
    await client.query(`RELEASE SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
    logger.warn('IAM profile session seed skipped after failure', {
      operation: 'get_my_profile',
      request_id: actor.requestId,
      trace_id: actor.traceId,
      instance_id: actor.instanceId,
      actor_account_id_present: Boolean(actor.actorAccountId),
      seeded_account_id_present: Boolean(accountId),
      session_profile_claims_present: Boolean(
        normalizeSeedValue(sessionProfile?.username) ||
          normalizeSeedValue(sessionProfile?.email) ||
          normalizeSeedValue(sessionProfile?.firstName) ||
          normalizeSeedValue(sessionProfile?.lastName) ||
          normalizeSeedValue(sessionProfile?.displayName)
      ),
      error_name: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  return resolveUserDetail(client, { instanceId: actor.instanceId, userId: accountId });
});

export const updateMyProfileDetail = async (
  actor: ActorInfo,
  keycloakSubject: string,
  payload: ProfileUpdatePayload
) => withInstanceScopedDb(actor.instanceId, async (client) => {
  const accountId = await resolveOrProvisionAccountId(client, actor, keycloakSubject);
  await persistProfileUpdate(client, actor, accountId, keycloakSubject, payload);
  return resolveUserDetail(client, { instanceId: actor.instanceId, userId: accountId });
});
