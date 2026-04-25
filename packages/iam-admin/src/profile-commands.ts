import type { IamUserDetail } from '@sva/core';

import { protectField } from './encryption.js';
import type { QueryClient } from './query-client.js';

export type ProfileUpdatePayload = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly phone?: string;
  readonly position?: string;
  readonly department?: string;
  readonly preferredLanguage?: string;
  readonly timezone?: string;
};

export type SessionProfileSeed = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
};

export type ProfileActorInfo = {
  readonly instanceId: string;
  readonly actorAccountId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

type ProfileActivityLogInput = {
  readonly instanceId: string;
  readonly accountId?: string;
  readonly subjectId?: string;
  readonly eventType: 'user.profile_updated';
  readonly result: 'success';
  readonly requestId?: string;
  readonly traceId?: string;
};

export type ProfileCommandsDeps = {
  readonly emitActivityLog: (client: QueryClient, input: ProfileActivityLogInput) => Promise<void>;
  readonly jitProvisionAccountWithClient: (
    client: QueryClient,
    input: {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly requestId?: string;
      readonly traceId?: string;
      readonly emitAuditLog?: boolean;
    }
  ) => Promise<{ readonly accountId: string }>;
  readonly logger: {
    readonly warn: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
  readonly resolveActorAccountId: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly keycloakSubject: string }
  ) => Promise<string | undefined>;
  readonly resolveUserDetail: (
    client: QueryClient,
    input: { readonly instanceId: string; readonly userId: string }
  ) => Promise<IamUserDetail | undefined>;
  readonly withInstanceScopedDb: <T>(
    instanceId: string,
    work: (client: QueryClient) => Promise<T>
  ) => Promise<T>;
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

export const createProfileCommands = (deps: ProfileCommandsDeps) => {
  const resolveOrProvisionAccountId = async (
    client: QueryClient,
    actor: ProfileActorInfo,
    keycloakSubject: string
  ): Promise<string> => {
    const existingAccountId = await deps.resolveActorAccountId(client, {
      instanceId: actor.instanceId,
      keycloakSubject,
    });
    if (existingAccountId) {
      return existingAccountId;
    }

    const provisioned = await deps.jitProvisionAccountWithClient(client, {
      instanceId: actor.instanceId,
      keycloakSubject,
      requestId: actor.requestId,
      traceId: actor.traceId,
      emitAuditLog: false,
    });
    return provisioned.accountId;
  };

  const persistProfileUpdate = async (
    client: QueryClient,
    actor: ProfileActorInfo,
    accountId: string,
    keycloakSubject: string,
    payload: ProfileUpdatePayload
  ): Promise<void> => {
    await client.query(
      UPDATE_PROFILE_QUERY,
      buildProfileUpdateParams(accountId, actor.instanceId, keycloakSubject, payload)
    );

    await deps.emitActivityLog(client, {
      instanceId: actor.instanceId,
      accountId,
      subjectId: accountId,
      eventType: 'user.profile_updated',
      result: 'success',
      requestId: actor.requestId,
      traceId: actor.traceId,
    });
  };

  const seedProfileFromSessionIfMissing = async (
    client: QueryClient,
    actor: ProfileActorInfo,
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

  const loadMyProfileDetail = async (
    actor: ProfileActorInfo,
    keycloakSubject: string,
    sessionProfile?: SessionProfileSeed
  ) => deps.withInstanceScopedDb(actor.instanceId, async (client) => {
    const accountId = await resolveOrProvisionAccountId(client, actor, keycloakSubject);

    try {
      await client.query(`SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
      await seedProfileFromSessionIfMissing(client, actor, accountId, keycloakSubject, sessionProfile);
      await client.query(`RELEASE SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
      await client.query(`RELEASE SAVEPOINT ${PROFILE_SESSION_SEED_SAVEPOINT}`);
      deps.logger.warn('IAM profile session seed skipped after failure', {
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

    return deps.resolveUserDetail(client, { instanceId: actor.instanceId, userId: accountId });
  });

  const updateMyProfileDetail = async (
    actor: ProfileActorInfo,
    keycloakSubject: string,
    payload: ProfileUpdatePayload
  ) => deps.withInstanceScopedDb(actor.instanceId, async (client) => {
    const accountId = await resolveOrProvisionAccountId(client, actor, keycloakSubject);
    await persistProfileUpdate(client, actor, accountId, keycloakSubject, payload);
    return deps.resolveUserDetail(client, { instanceId: actor.instanceId, userId: accountId });
  });

  return {
    loadMyProfileDetail,
    updateMyProfileDetail,
  };
};
