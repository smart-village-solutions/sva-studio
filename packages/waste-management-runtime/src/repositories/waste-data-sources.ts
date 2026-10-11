import type {
  WasteManagementConnectionCheckRecord,
  WasteManagementDataSourceProvider,
  WasteManagementDataSourceRecord,
} from '@sva/waste-management-contracts';

import type { SqlExecutor, SqlStatement } from '@sva/data-repositories';

export type WasteDataSourceRepository = {
  getByInstanceId(instanceId: string): Promise<WasteManagementDataSourceRecord | null>;
  upsert(input: WasteManagementDataSourceRecord): Promise<void>;
  updateConnectionCheck(input: WasteManagementConnectionCheckRecord): Promise<void>;
};

type WasteDataSourceRow = {
  readonly instance_id: string;
  readonly provider_key: WasteManagementDataSourceProvider;
  readonly project_url: string;
  readonly schema_name: string;
  readonly enabled: boolean;
  readonly database_url_ciphertext: string | null;
  readonly service_role_key_ciphertext: string | null;
  readonly visible_status: WasteManagementDataSourceRecord['visibleStatus'];
  readonly last_checked_at: string | null;
  readonly last_check_status: WasteManagementDataSourceRecord['lastCheckStatus'] | null;
  readonly last_check_error_code: string | null;
  readonly last_check_error_message: string | null;
  readonly updated_at: string | null;
};

const mapRow = (row: WasteDataSourceRow): WasteManagementDataSourceRecord => ({
  instanceId: row.instance_id,
  provider: row.provider_key,
  schemaName: row.schema_name,
  enabled: row.enabled,
  disruptionLocationEnabled: false,
  disruptionAllLocationsEnabled: false,
  databaseUrlConfigured: Boolean(row.database_url_ciphertext),
  databaseUrlCiphertext: row.database_url_ciphertext ?? undefined,
  visibleStatus: row.visible_status,
  lastCheckedAt: row.last_checked_at ?? undefined,
  lastCheckStatus: row.last_check_status ?? undefined,
  lastCheckErrorCode: row.last_check_error_code ?? undefined,
  lastCheckErrorMessage: row.last_check_error_message ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});

const selectStatement = (instanceId: string): SqlStatement => ({
  text: `
SELECT
  instance_id,
  provider_key,
  project_url,
  schema_name,
  enabled,
  database_url_ciphertext,
  service_role_key_ciphertext,
  visible_status,
  last_checked_at,
  last_check_status,
  last_check_error_code,
  last_check_error_message,
  updated_at
FROM iam.instance_waste_data_sources
WHERE instance_id = $1
LIMIT 1;
`,
  values: [instanceId],
});

const upsertStatement = (input: WasteManagementDataSourceRecord): SqlStatement => ({
  text: `
INSERT INTO iam.instance_waste_data_sources (
  instance_id,
  provider_key,
  project_url,
  schema_name,
  enabled,
  database_url_ciphertext,
  service_role_key_ciphertext,
  visible_status,
  last_checked_at,
  last_check_status,
  last_check_error_code,
  last_check_error_message
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (instance_id) DO UPDATE
SET provider_key = EXCLUDED.provider_key,
    project_url = EXCLUDED.project_url,
    schema_name = EXCLUDED.schema_name,
    enabled = EXCLUDED.enabled,
    database_url_ciphertext = EXCLUDED.database_url_ciphertext,
    service_role_key_ciphertext = EXCLUDED.service_role_key_ciphertext,
    visible_status = EXCLUDED.visible_status,
    last_checked_at = EXCLUDED.last_checked_at,
    last_check_status = EXCLUDED.last_check_status,
    last_check_error_code = EXCLUDED.last_check_error_code,
    last_check_error_message = EXCLUDED.last_check_error_message,
    updated_at = NOW();
`,
  values: [
    input.instanceId,
    input.provider,
    '',
    input.schemaName,
    input.enabled,
    input.databaseUrlCiphertext ?? null,
    null,
    input.visibleStatus,
    input.lastCheckedAt ?? null,
    input.lastCheckStatus ?? null,
    input.lastCheckErrorCode ?? null,
    input.lastCheckErrorMessage ?? null,
  ],
});

const updateConnectionCheckStatement = (
  input: WasteManagementConnectionCheckRecord
): SqlStatement => ({
  text: `
UPDATE iam.instance_waste_data_sources
SET visible_status = $2,
    last_checked_at = $3,
    last_check_status = $4,
    last_check_error_code = $5,
    last_check_error_message = $6,
    updated_at = NOW()
WHERE instance_id = $1;
`,
  values: [
    input.instanceId,
    input.visibleStatus,
    input.checkedAt,
    input.checkStatus,
    input.errorCode ?? null,
    input.errorMessage ?? null,
  ],
});

export const createWasteDataSourceRepository = (
  executor: SqlExecutor
): WasteDataSourceRepository => ({
  async getByInstanceId(instanceId) {
    const result = await executor.execute<WasteDataSourceRow>(selectStatement(instanceId));
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },
  async upsert(input) {
    await executor.execute(upsertStatement(input));
  },
  async updateConnectionCheck(input) {
    await executor.execute(updateConnectionCheckStatement(input));
  },
});

export const wasteDataSourceStatements = {
  select: selectStatement,
  upsert: upsertStatement,
  updateConnectionCheck: updateConnectionCheckStatement,
} as const;

export type WasteDataSourceDbClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ readonly rowCount: number | null; readonly rows: readonly TRow[] }>;
};

export type WasteDataSourceAccess = Readonly<{
  loadWasteDataSourceRecord(
    instanceId: string
  ): Promise<WasteManagementDataSourceRecord | null>;
  saveWasteDataSourceRecord(record: WasteManagementDataSourceRecord): Promise<void>;
  saveWasteConnectionCheck(input: WasteManagementConnectionCheckRecord): Promise<void>;
  checkWasteDataSourceSchema(instanceId: string): Promise<boolean>;
}>;

export const createWasteDataSourceAccess = (
  withInstanceDb: <T>(
    instanceId: string,
    work: (client: WasteDataSourceDbClient) => Promise<T>
  ) => Promise<T>
): WasteDataSourceAccess => {
  const withRepository = <T>(
    instanceId: string,
    work: (repository: WasteDataSourceRepository) => Promise<T>
  ) =>
    withInstanceDb(instanceId, async (client) =>
      work(
        createWasteDataSourceRepository({
          async execute<TRow = Record<string, unknown>>(query: SqlStatement) {
            const result = await client.query<TRow>(query.text, query.values);
            return { rowCount: result.rowCount ?? 0, rows: result.rows };
          },
        })
      )
    );

  return {
    loadWasteDataSourceRecord: (instanceId) =>
      withRepository(instanceId, (repository) => repository.getByInstanceId(instanceId)),
    saveWasteDataSourceRecord: (record) =>
      withRepository(record.instanceId, (repository) => repository.upsert(record)),
    saveWasteConnectionCheck: (input) =>
      withRepository(input.instanceId, (repository) => repository.updateConnectionCheck(input)),
    checkWasteDataSourceSchema: (instanceId) =>
      withInstanceDb(instanceId, async (client) => {
        const result = await client.query<{ exists: boolean }>(
          "SELECT to_regclass('iam.instance_waste_data_sources') IS NOT NULL AS exists"
        );
        return result.rows[0]?.exists === true;
      }),
  };
};
