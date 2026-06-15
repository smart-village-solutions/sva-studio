import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

export const instanceRow = {
  instance_id: 'tenant-a',
  display_name: 'Tenant A',
  status: 'active',
  parent_domain: 'example.test',
  primary_hostname: 'tenant-a.example.test',
  realm_mode: 'shared',
  auth_realm: 'sva',
  auth_client_id: 'studio',
  auth_issuer_url: null,
  auth_client_secret_ciphertext: 'secret-cipher',
  tenant_admin_client_id: 'tenant-admin',
  tenant_admin_client_secret_ciphertext: null,
  tenant_admin_username: 'admin',
  tenant_admin_email: null,
  tenant_admin_first_name: 'Ada',
  tenant_admin_last_name: null,
  theme_key: null,
  assigned_module_ids: ['news', 'events'],
  feature_flags: null,
  mainserver_config_ref: null,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: null,
  updated_at: '2026-01-02T00:00:00.000Z',
  updated_by: 'actor-1',
};

export const provisioningRow = {
  id: 'run-1',
  instance_id: 'tenant-a',
  operation: 'create',
  status: 'pending',
  step_key: null,
  idempotency_key: 'idem-1',
  error_code: null,
  error_message: null,
  request_id: 'request-1',
  actor_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:01.000Z',
};

export const keycloakRunRow = {
  id: 'kc-run-1',
  instance_id: 'tenant-a',
  mutation: 'executeKeycloakProvisioning',
  idempotency_key: 'idem-kc-1',
  payload_fingerprint: 'fingerprint-1',
  mode: 'shared',
  intent: 'reconcile',
  overall_status: 'planned',
  drift_summary: 'No drift',
  request_id: null,
  actor_id: 'actor-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:01.000Z',
  created: true,
};

export const stepRow = {
  id: 'step-id',
  run_id: 'kc-run-1',
  step_key: 'realm',
  title: 'Realm',
  status: 'success',
  started_at: null,
  finished_at: '2026-01-01T00:00:02.000Z',
  summary: 'Done',
  details: null,
  request_id: 'request-1',
  created_at: '2026-01-01T00:00:00.000Z',
};

export const createQueuedExecutor = (queuedRows: readonly (readonly Record<string, unknown>[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};
