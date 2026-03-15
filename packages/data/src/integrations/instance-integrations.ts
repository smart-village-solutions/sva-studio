import type { IamInstanceId } from '../iam/types';
import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types';

export type IntegrationProviderKey = 'sva_mainserver';

export type InstanceIntegrationRecord = {
  readonly instanceId: IamInstanceId;
  readonly providerKey: IntegrationProviderKey;
  readonly graphqlBaseUrl: string;
  readonly oauthTokenUrl: string;
  readonly enabled: boolean;
  readonly lastVerifiedAt?: string;
  readonly lastVerifiedStatus?: string;
};

export type InstanceIntegrationRepository = {
  getByInstanceId(
    instanceId: IamInstanceId,
    providerKey: IntegrationProviderKey
  ): Promise<InstanceIntegrationRecord | null>;
  upsert(input: InstanceIntegrationRecord): Promise<void>;
};

type InstanceIntegrationRow = {
  readonly instance_id: string;
  readonly provider_key: IntegrationProviderKey;
  readonly graphql_base_url: string;
  readonly oauth_token_url: string;
  readonly enabled: boolean;
  readonly last_verified_at: string | null;
  readonly last_verified_status: string | null;
};

const mapRow = (row: InstanceIntegrationRow): InstanceIntegrationRecord => ({
  instanceId: row.instance_id,
  providerKey: row.provider_key,
  graphqlBaseUrl: row.graphql_base_url,
  oauthTokenUrl: row.oauth_token_url,
  enabled: row.enabled,
  lastVerifiedAt: row.last_verified_at ?? undefined,
  lastVerifiedStatus: row.last_verified_status ?? undefined,
});

const selectStatement = (
  instanceId: IamInstanceId,
  providerKey: IntegrationProviderKey
): SqlStatement => ({
  text: `
SELECT
  instance_id,
  provider_key,
  graphql_base_url,
  oauth_token_url,
  enabled,
  last_verified_at,
  last_verified_status
FROM iam.instance_integrations
WHERE instance_id = $1
  AND provider_key = $2
LIMIT 1;
`,
  values: [instanceId, providerKey],
});

const upsertStatement = (input: InstanceIntegrationRecord): SqlStatement => ({
  text: `
INSERT INTO iam.instance_integrations (
  instance_id,
  provider_key,
  graphql_base_url,
  oauth_token_url,
  enabled,
  last_verified_at,
  last_verified_status
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (instance_id, provider_key) DO UPDATE
SET graphql_base_url = EXCLUDED.graphql_base_url,
    oauth_token_url = EXCLUDED.oauth_token_url,
    enabled = EXCLUDED.enabled,
    last_verified_at = EXCLUDED.last_verified_at,
    last_verified_status = EXCLUDED.last_verified_status,
    updated_at = NOW();
`,
  values: [
    input.instanceId,
    input.providerKey,
    input.graphqlBaseUrl,
    input.oauthTokenUrl,
    input.enabled,
    input.lastVerifiedAt ?? null,
    input.lastVerifiedStatus ?? null,
  ],
});

export const createInstanceIntegrationRepository = (
  executor: SqlExecutor
): InstanceIntegrationRepository => ({
  async getByInstanceId(instanceId, providerKey) {
    const result = await executor.execute<InstanceIntegrationRow>(selectStatement(instanceId, providerKey));
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },
  async upsert(input) {
    await executor.execute(upsertStatement(input));
  },
});

export const instanceIntegrationStatements = {
  select: selectStatement,
  upsert: upsertStatement,
} as const;

export type { SqlExecutionResult };
