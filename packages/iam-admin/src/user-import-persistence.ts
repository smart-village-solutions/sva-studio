import { createHash } from 'node:crypto';

import { protectField, revealField } from './encryption.js';
import type { QueryClient } from './query-client.js';
import { IamSchemaDriftError } from './runtime-errors.js';

export type ImportIdentityListedUser = {
  readonly externalId: string;
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
};

export type UserImportLocalProfileSeed = {
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
};

export type UserImportPersistenceDeps = {
  readonly logger: {
    readonly error: (message: string, meta: Readonly<Record<string, unknown>>) => void;
  };
};

const UPSERT_ACCOUNT_QUERY = `
INSERT INTO iam.accounts (
  instance_id,
  keycloak_subject,
  username_ciphertext,
  email_ciphertext,
  display_name_ciphertext,
  first_name_ciphertext,
  last_name_ciphertext,
  status
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8
)
ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO UPDATE
SET
  username_ciphertext = EXCLUDED.username_ciphertext,
  email_ciphertext = EXCLUDED.email_ciphertext,
  display_name_ciphertext = EXCLUDED.display_name_ciphertext,
  first_name_ciphertext = EXCLUDED.first_name_ciphertext,
  last_name_ciphertext = EXCLUDED.last_name_ciphertext,
  status = EXCLUDED.status,
  updated_at = NOW()
RETURNING id, (xmax = 0) AS created;
`;

const INSERT_MEMBERSHIP_QUERY = `
INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES ($1, $2::uuid, 'member')
ON CONFLICT (instance_id, account_id) DO NOTHING;
`;

type LocalProfileSeedRow = {
  readonly username_ciphertext: string | null;
  readonly email_ciphertext: string | null;
  readonly first_name_ciphertext: string | null;
  readonly last_name_ciphertext: string | null;
};

const readSingleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const value = attributes?.[key]?.[0];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
};

const resolveDisplayName = (user: ImportIdentityListedUser): string => {
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

const protectOptionalField = (value: string | undefined, context: string): string | null =>
  value ? protectField(value, context) : null;

const normalizeOptionalText = (value: string | undefined | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const toSubjectRef = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 12);

const shouldRetryWithoutUsernameCiphertext = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('username_ciphertext') &&
    (message.includes('does not exist') || message.includes('missing') || message.includes('undefined column'))
  );
};

export const createUserImportPersistence = (deps: UserImportPersistenceDeps) => {
  const upsertIdentityUser = async (
    client: QueryClient,
    input: { readonly instanceId: string; readonly user: ImportIdentityListedUser }
  ): Promise<{ readonly accountId: string; readonly created: boolean }> => {
    const status = input.user.enabled === false ? 'inactive' : 'active';
    const displayName = resolveDisplayName(input.user);
    const usernameCiphertext = protectOptionalField(input.user.username, `iam.accounts.username:${input.user.externalId}`);
    const emailCiphertext = protectOptionalField(input.user.email, `iam.accounts.email:${input.user.externalId}`);
    const displayNameCiphertext = protectField(displayName, `iam.accounts.display_name:${input.user.externalId}`);
    const firstNameCiphertext = protectOptionalField(
      input.user.firstName,
      `iam.accounts.first_name:${input.user.externalId}`
    );
    const lastNameCiphertext = protectOptionalField(input.user.lastName, `iam.accounts.last_name:${input.user.externalId}`);

    let upsert;
    try {
      upsert = await client.query<{ readonly id: string; readonly created: boolean }>(UPSERT_ACCOUNT_QUERY, [
        input.instanceId,
        input.user.externalId,
        usernameCiphertext,
        emailCiphertext,
        displayNameCiphertext,
        firstNameCiphertext,
        lastNameCiphertext,
        status,
      ]);
    } catch (error) {
      if (!shouldRetryWithoutUsernameCiphertext(error)) {
        throw error;
      }

      deps.logger.error('Keycloak user sync aborted because IAM schema is outdated', {
        operation: 'sync_keycloak_users',
        instance_id: input.instanceId,
        subject_ref: toSubjectRef(input.user.externalId),
        error: error instanceof Error ? error.message : String(error),
        schema_object: 'iam.accounts.username_ciphertext',
        mode: 'fail_fast',
      });
      throw new IamSchemaDriftError({
        message: 'IAM user sync requires iam.accounts.username_ciphertext',
        operation: 'sync_keycloak_users',
        schemaObject: 'iam.accounts.username_ciphertext',
        expectedMigration: '0011_iam_account_username.sql',
        cause: error,
      });
    }

    const accountId = upsert.rows[0]?.id;
    if (!accountId) {
      throw new Error('keycloak_import_upsert_failed');
    }

    await client.query(INSERT_MEMBERSHIP_QUERY, [input.instanceId, accountId]);
    return {
      accountId,
      created: Boolean(upsert.rows[0]?.created),
    };
  };

  const loadLocalProfileSeed = async (
    client: QueryClient,
    input: { readonly instanceId: string; readonly keycloakSubject: string }
  ): Promise<UserImportLocalProfileSeed | null> => {
    const result = await client.query<LocalProfileSeedRow>(
      `
SELECT
  username_ciphertext,
  email_ciphertext,
  first_name_ciphertext,
  last_name_ciphertext
FROM iam.accounts
WHERE instance_id = $1
  AND keycloak_subject = $2
LIMIT 1;
`,
      [input.instanceId, input.keycloakSubject]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      username: normalizeOptionalText(revealField(row.username_ciphertext, `iam.accounts.username:${input.keycloakSubject}`)),
      email: normalizeOptionalText(revealField(row.email_ciphertext, `iam.accounts.email:${input.keycloakSubject}`)),
      firstName: normalizeOptionalText(
        revealField(row.first_name_ciphertext, `iam.accounts.first_name:${input.keycloakSubject}`)
      ),
      lastName: normalizeOptionalText(
        revealField(row.last_name_ciphertext, `iam.accounts.last_name:${input.keycloakSubject}`)
      ),
    };
  };

  return {
    loadLocalProfileSeed,
    upsertIdentityUser,
  };
};
