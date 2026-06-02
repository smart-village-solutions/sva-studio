import { protectField } from './encryption.js';
import type { QueryClient } from './query-client.js';

export type OrganizationMainserverCredentialRow = {
  readonly mainserver_application_id: string | null;
  readonly mainserver_application_secret_ciphertext: string | null;
};

export type OrganizationMainserverCredentialState = {
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecretSet: boolean;
};

export const buildOrganizationMainserverSecretAad = (organizationId: string): string =>
  `iam.organization_mainserver_credentials.mainserver_application_secret:${organizationId}`;

export const projectOrganizationMainserverCredentialState = (
  row: OrganizationMainserverCredentialRow
): OrganizationMainserverCredentialState => ({
  mainserverApplicationId: row.mainserver_application_id ?? undefined,
  mainserverApplicationSecretSet: Boolean(row.mainserver_application_secret_ciphertext),
});

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const loadOrganizationMainserverCredentialRow = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
  }
): Promise<OrganizationMainserverCredentialRow | null> => {
  const result = await client.query<OrganizationMainserverCredentialRow>(
    `
SELECT
  mainserver_application_id,
  mainserver_application_secret_ciphertext
FROM iam.organization_mainserver_credentials
WHERE instance_id = $1
  AND organization_id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.organizationId]
  );

  return result.rows[0] ?? null;
};

export const loadOrganizationMainserverCredentialState = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
  }
): Promise<OrganizationMainserverCredentialState> => {
  const row = await loadOrganizationMainserverCredentialRow(client, input);
  if (!row) {
    return {
      mainserverApplicationSecretSet: false,
    };
  }

  return projectOrganizationMainserverCredentialState(row);
};

export const upsertOrganizationMainserverCredentials = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId: string;
    readonly actorAccountId?: string;
    readonly mainserverApplicationId?: string;
    readonly mainserverApplicationSecret?: string;
  }
): Promise<OrganizationMainserverCredentialState> => {
  const currentRow = await loadOrganizationMainserverCredentialRow(client, input);
  const nextApplicationId =
    input.mainserverApplicationId !== undefined
      ? normalizeOptionalText(input.mainserverApplicationId)
      : currentRow?.mainserver_application_id ?? null;
  const nextSecretPlaintext = normalizeOptionalText(input.mainserverApplicationSecret);
  const nextSecretCiphertext = nextSecretPlaintext
    ? protectField(nextSecretPlaintext, buildOrganizationMainserverSecretAad(input.organizationId))
    : currentRow?.mainserver_application_secret_ciphertext ?? null;

  if (!nextApplicationId && !nextSecretCiphertext) {
    if (currentRow) {
      await client.query(
        `
DELETE FROM iam.organization_mainserver_credentials
WHERE instance_id = $1
  AND organization_id = $2::uuid;
`,
        [input.instanceId, input.organizationId]
      );
    }

    return {
      mainserverApplicationSecretSet: false,
    };
  }

  await client.query(
    `
INSERT INTO iam.organization_mainserver_credentials (
  instance_id,
  organization_id,
  mainserver_application_id,
  mainserver_application_secret_ciphertext,
  updated_by_account_id
)
VALUES ($1, $2::uuid, $3, $4, $5::uuid)
ON CONFLICT (instance_id, organization_id) DO UPDATE
SET
  mainserver_application_id = EXCLUDED.mainserver_application_id,
  mainserver_application_secret_ciphertext = EXCLUDED.mainserver_application_secret_ciphertext,
  updated_by_account_id = EXCLUDED.updated_by_account_id,
  updated_at = NOW();
`,
    [input.instanceId, input.organizationId, nextApplicationId, nextSecretCiphertext, input.actorAccountId ?? null]
  );

  return {
    mainserverApplicationId: nextApplicationId ?? undefined,
    mainserverApplicationSecretSet: Boolean(nextSecretCiphertext),
  };
};
