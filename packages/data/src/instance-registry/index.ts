import type {
  InstanceAuditEvent,
  InstanceKeycloakProvisioningRun,
  InstanceKeycloakProvisioningRunStep,
  InstanceProvisioningOperation,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
  InstanceRealmMode,
  InstanceStatus,
} from '@sva/core';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

type InstanceListRow = {
  instance_id: string;
  display_name: string;
  status: InstanceStatus;
  parent_domain: string;
  primary_hostname: string;
  realm_mode: InstanceRealmMode;
  auth_realm: string;
  auth_client_id: string;
  auth_issuer_url: string | null;
  auth_client_secret_ciphertext: string | null;
  tenant_admin_username: string | null;
  tenant_admin_email: string | null;
  tenant_admin_first_name: string | null;
  tenant_admin_last_name: string | null;
  theme_key: string | null;
  feature_flags: Record<string, boolean> | null;
  mainserver_config_ref: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

type ProvisioningRow = {
  id: string;
  instance_id: string;
  operation: InstanceProvisioningOperation;
  status: InstanceStatus;
  step_key: string | null;
  idempotency_key: string;
  error_code: string | null;
  error_message: string | null;
  request_id: string | null;
  actor_id: string | null;
  created_at: string;
  updated_at: string;
};

type AuditRow = {
  id: string;
  instance_id: string;
  event_type: InstanceAuditEvent['eventType'];
  actor_id: string | null;
  request_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type KeycloakProvisioningRunRow = {
  id: string;
  instance_id: string;
  mode: InstanceRealmMode;
  intent: InstanceKeycloakProvisioningRun['intent'];
  overall_status: InstanceKeycloakProvisioningRun['overallStatus'];
  drift_summary: string;
  request_id: string | null;
  actor_id: string | null;
  created_at: string;
  updated_at: string;
};

type KeycloakProvisioningStepRow = {
  id: string;
  run_id: string;
  step_key: string;
  title: string;
  status: InstanceKeycloakProvisioningRunStep['status'];
  started_at: string | null;
  finished_at: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
};

const mapInstance = (row: InstanceListRow): InstanceRegistryRecord => ({
  instanceId: row.instance_id,
  displayName: row.display_name,
  status: row.status,
  parentDomain: row.parent_domain,
  primaryHostname: row.primary_hostname,
  realmMode: row.realm_mode,
  authRealm: row.auth_realm,
  authClientId: row.auth_client_id,
  authIssuerUrl: row.auth_issuer_url ?? undefined,
  authClientSecretConfigured: Boolean(row.auth_client_secret_ciphertext),
  tenantAdminBootstrap: row.tenant_admin_username
    ? {
        username: row.tenant_admin_username,
        email: row.tenant_admin_email ?? undefined,
        firstName: row.tenant_admin_first_name ?? undefined,
        lastName: row.tenant_admin_last_name ?? undefined,
      }
    : undefined,
  themeKey: row.theme_key ?? undefined,
  featureFlags: row.feature_flags ?? {},
  mainserverConfigRef: row.mainserver_config_ref ?? undefined,
  createdAt: row.created_at,
  createdBy: row.created_by ?? undefined,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by ?? undefined,
});

const mapProvisioningRun = (row: ProvisioningRow): InstanceProvisioningRun => ({
  id: row.id,
  instanceId: row.instance_id,
  operation: row.operation,
  status: row.status,
  stepKey: row.step_key ?? undefined,
  idempotencyKey: row.idempotency_key,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  requestId: row.request_id ?? undefined,
  actorId: row.actor_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapAuditEvent = (row: AuditRow): InstanceAuditEvent => ({
  id: row.id,
  instanceId: row.instance_id,
  eventType: row.event_type,
  actorId: row.actor_id ?? undefined,
  requestId: row.request_id ?? undefined,
  details: row.details ?? {},
  createdAt: row.created_at,
});

const mapKeycloakProvisioningRunStep = (row: KeycloakProvisioningStepRow): InstanceKeycloakProvisioningRunStep => ({
  stepKey: row.step_key,
  title: row.title,
  status: row.status,
  startedAt: row.started_at ?? undefined,
  finishedAt: row.finished_at ?? undefined,
  summary: row.summary,
  details: row.details ?? {},
  requestId: row.request_id ?? undefined,
});

const mapKeycloakProvisioningRun = (
  row: KeycloakProvisioningRunRow,
  steps: readonly KeycloakProvisioningStepRow[]
): InstanceKeycloakProvisioningRun => ({
  id: row.id,
  instanceId: row.instance_id,
  mode: row.mode,
  intent: row.intent,
  overallStatus: row.overall_status,
  driftSummary: row.drift_summary,
  requestId: row.request_id ?? undefined,
  actorId: row.actor_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  steps: steps.map(mapKeycloakProvisioningRunStep),
});

export type InstanceRegistryRepository = {
  listInstances(input?: { search?: string; status?: InstanceStatus }): Promise<readonly InstanceRegistryRecord[]>;
  getInstanceById(instanceId: string): Promise<InstanceRegistryRecord | null>;
  getAuthClientSecretCiphertext(instanceId: string): Promise<string | null>;
  resolveHostname(hostname: string): Promise<InstanceRegistryRecord | null>;
  resolvePrimaryHostname(hostname: string): Promise<InstanceRegistryRecord | null>;
  listProvisioningRuns(instanceId: string): Promise<readonly InstanceProvisioningRun[]>;
  listLatestProvisioningRuns(
    instanceIds: readonly string[]
  ): Promise<Readonly<Record<string, InstanceProvisioningRun | undefined>>>;
  listAuditEvents(instanceId: string): Promise<readonly InstanceAuditEvent[]>;
  listKeycloakProvisioningRuns(instanceId: string): Promise<readonly InstanceKeycloakProvisioningRun[]>;
  getKeycloakProvisioningRun(instanceId: string, runId: string): Promise<InstanceKeycloakProvisioningRun | null>;
  claimNextKeycloakProvisioningRun(): Promise<InstanceKeycloakProvisioningRun | null>;
  createInstance(input: {
    instanceId: string;
    displayName: string;
    status: InstanceStatus;
    parentDomain: string;
    primaryHostname: string;
    realmMode: InstanceRealmMode;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecretCiphertext?: string;
    tenantAdminBootstrap?: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    actorId?: string;
    requestId?: string;
    themeKey?: string;
    featureFlags?: Readonly<Record<string, boolean>>;
    mainserverConfigRef?: string;
  }): Promise<InstanceRegistryRecord>;
  updateInstance(input: {
    instanceId: string;
    displayName: string;
    parentDomain: string;
    primaryHostname: string;
    realmMode: InstanceRealmMode;
    authRealm: string;
    authClientId: string;
    authIssuerUrl?: string;
    authClientSecretCiphertext?: string;
    keepExistingAuthClientSecret?: boolean;
    tenantAdminBootstrap?: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    actorId?: string;
    requestId?: string;
    themeKey?: string;
    featureFlags?: Readonly<Record<string, boolean>>;
    mainserverConfigRef?: string;
  }): Promise<InstanceRegistryRecord | null>;
  setInstanceStatus(input: {
    instanceId: string;
    status: InstanceStatus;
    actorId?: string;
    requestId?: string;
  }): Promise<InstanceRegistryRecord | null>;
  createProvisioningRun(input: {
    instanceId: string;
    operation: InstanceProvisioningOperation;
    status: InstanceStatus;
    idempotencyKey: string;
    stepKey?: string;
    actorId?: string;
    requestId?: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<InstanceProvisioningRun>;
  appendAuditEvent(input: {
    instanceId: string;
    eventType: InstanceAuditEvent['eventType'];
    actorId?: string;
    requestId?: string;
    details?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
  createKeycloakProvisioningRun(input: {
    instanceId: string;
    mode: InstanceRealmMode;
    intent: InstanceKeycloakProvisioningRun['intent'];
    overallStatus: InstanceKeycloakProvisioningRun['overallStatus'];
    driftSummary: string;
    actorId?: string;
    requestId?: string;
  }): Promise<InstanceKeycloakProvisioningRun>;
  updateKeycloakProvisioningRun(input: {
    runId: string;
    overallStatus: InstanceKeycloakProvisioningRun['overallStatus'];
    driftSummary?: string;
  }): Promise<InstanceKeycloakProvisioningRun | null>;
  appendKeycloakProvisioningStep(input: {
    runId: string;
    stepKey: string;
    title: string;
    status: InstanceKeycloakProvisioningRunStep['status'];
    startedAt?: string;
    finishedAt?: string;
    summary: string;
    details?: Readonly<Record<string, unknown>>;
    requestId?: string;
  }): Promise<InstanceKeycloakProvisioningRunStep>;
};

const statement = (text: string, values: readonly (string | number | boolean | null)[]): SqlStatement => ({ text, values });

const queryRows = async <TRow>(executor: SqlExecutor, sql: SqlStatement): Promise<readonly TRow[]> => {
  const result: SqlExecutionResult<TRow> = await executor.execute<TRow>(sql);
  return result.rows;
};

const listKeycloakProvisioningStepRows = async (
  executor: SqlExecutor,
  runIds: readonly string[]
): Promise<Readonly<Record<string, readonly KeycloakProvisioningStepRow[]>>> => {
  if (runIds.length === 0) {
    return {};
  }

  const placeholders = runIds.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await queryRows<KeycloakProvisioningStepRow>(
    executor,
    statement(
      `
SELECT
  id::text,
  run_id::text,
  step_key,
  title,
  status,
  started_at::text,
  finished_at::text,
  summary,
  details,
  request_id,
  created_at::text
FROM iam.instance_keycloak_provisioning_steps
WHERE run_id IN (${placeholders})
ORDER BY created_at ASC, id ASC;
`,
      runIds
    )
  );

  return rows.reduce<Readonly<Record<string, readonly KeycloakProvisioningStepRow[]>>>((accumulator, row) => {
    const current = accumulator[row.run_id] ?? [];
    return {
      ...accumulator,
      [row.run_id]: [...current, row],
    };
  }, {});
};

export const createInstanceRegistryRepository = (executor: SqlExecutor): InstanceRegistryRepository => ({
  async listInstances(input = {}) {
    const rows = await queryRows<InstanceListRow>(
      executor,
      statement(
        `
SELECT
  id AS instance_id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  realm_mode,
  auth_realm,
  auth_client_id,
  auth_issuer_url,
  auth_client_secret_ciphertext,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_at,
  created_by,
  updated_at,
  updated_by
FROM iam.instances
WHERE ($1::text IS NULL OR id ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR status = $2)
ORDER BY updated_at DESC, id ASC;
`,
        [input.search?.trim() || null, input.status ?? null]
      )
    );
    return rows.map(mapInstance);
  },

  async getInstanceById(instanceId) {
    const rows = await queryRows<InstanceListRow>(
      executor,
      statement(
        `
SELECT
  id AS instance_id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  realm_mode,
  auth_realm,
  auth_client_id,
  auth_issuer_url,
  auth_client_secret_ciphertext,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_at,
  created_by,
  updated_at,
  updated_by
FROM iam.instances
WHERE id = $1
LIMIT 1;
`,
        [instanceId]
      )
    );
    return rows[0] ? mapInstance(rows[0]) : null;
  },

  async getAuthClientSecretCiphertext(instanceId) {
    const rows = await queryRows<{ auth_client_secret_ciphertext: string | null }>(
      executor,
      statement(
        `
SELECT auth_client_secret_ciphertext
FROM iam.instances
WHERE id = $1
LIMIT 1;
`,
        [instanceId]
      )
    );
    return rows[0]?.auth_client_secret_ciphertext ?? null;
  },

  async resolveHostname(hostname) {
    const rows = await queryRows<InstanceListRow>(
      executor,
      statement(
        `
SELECT
  instance.id AS instance_id,
  instance.display_name,
  instance.status,
  instance.parent_domain,
  instance.primary_hostname,
  instance.realm_mode,
  instance.auth_realm,
  instance.auth_client_id,
  instance.auth_issuer_url,
  instance.auth_client_secret_ciphertext,
  instance.tenant_admin_username,
  instance.tenant_admin_email,
  instance.tenant_admin_first_name,
  instance.tenant_admin_last_name,
  instance.theme_key,
  instance.feature_flags,
  instance.mainserver_config_ref,
  instance.created_at,
  instance.created_by,
  instance.updated_at,
  instance.updated_by
FROM iam.instance_hostnames hostname
JOIN iam.instances instance
  ON instance.id = hostname.instance_id
WHERE hostname.hostname = $1
LIMIT 1;
`,
        [hostname]
      )
    );
    return rows[0] ? mapInstance(rows[0]) : null;
  },

  async resolvePrimaryHostname(hostname) {
    const rows = await queryRows<InstanceListRow>(
      executor,
      statement(
        `
SELECT
  id AS instance_id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  realm_mode,
  auth_realm,
  auth_client_id,
  auth_issuer_url,
  auth_client_secret_ciphertext,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_at,
  created_by,
  updated_at,
  updated_by
FROM iam.instances
WHERE primary_hostname = $1
LIMIT 1;
`,
        [hostname]
      )
    );
    return rows[0] ? mapInstance(rows[0]) : null;
  },

  async listProvisioningRuns(instanceId) {
    const rows = await queryRows<ProvisioningRow>(
      executor,
      statement(
        `
SELECT
  id::text,
  instance_id,
  operation,
  status,
  step_key,
  idempotency_key,
  error_code,
  error_message,
  request_id,
  actor_id,
  created_at::text,
  updated_at::text
FROM iam.instance_provisioning_runs
WHERE instance_id = $1
ORDER BY created_at DESC, id DESC;
`,
        [instanceId]
      )
    );
    return rows.map(mapProvisioningRun);
  },

  async listLatestProvisioningRuns(instanceIds) {
    if (instanceIds.length === 0) {
      return {};
    }

    const values = [...instanceIds];
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const rows = await queryRows<ProvisioningRow>(
      executor,
      statement(
        `
SELECT DISTINCT ON (instance_id)
  id::text,
  instance_id,
  operation,
  status,
  step_key,
  idempotency_key,
  error_code,
  error_message,
  request_id,
  actor_id,
  created_at::text,
  updated_at::text
FROM iam.instance_provisioning_runs
WHERE instance_id IN (${placeholders})
ORDER BY instance_id ASC, created_at DESC, id DESC;
`,
        values
      )
    );

    return Object.fromEntries(
      rows.map((row) => {
        const run = mapProvisioningRun(row);
        return [run.instanceId, run] as const;
      })
    );
  },

  async listAuditEvents(instanceId) {
    const rows = await queryRows<AuditRow>(
      executor,
      statement(
        `
SELECT
  id::text,
  instance_id,
  event_type,
  actor_id,
  request_id,
  details,
  created_at::text
FROM iam.instance_audit_events
WHERE instance_id = $1
ORDER BY created_at DESC, id DESC;
`,
        [instanceId]
      )
    );
    return rows.map(mapAuditEvent);
  },

  async listKeycloakProvisioningRuns(instanceId) {
    const rows = await queryRows<KeycloakProvisioningRunRow>(
      executor,
      statement(
        `
SELECT
  id::text,
  instance_id,
  mode,
  intent,
  overall_status,
  drift_summary,
  request_id,
  actor_id,
  created_at::text,
  updated_at::text
FROM iam.instance_keycloak_provisioning_runs
WHERE instance_id = $1
ORDER BY created_at DESC, id DESC;
`,
        [instanceId]
      )
    );
    const stepsByRunId = await listKeycloakProvisioningStepRows(
      executor,
      rows.map((row) => row.id)
    );
    return rows.map((row) => mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []));
  },

  async getKeycloakProvisioningRun(instanceId, runId) {
    const rows = await queryRows<KeycloakProvisioningRunRow>(
      executor,
      statement(
        `
SELECT
  id::text,
  instance_id,
  mode,
  intent,
  overall_status,
  drift_summary,
  request_id,
  actor_id,
  created_at::text,
  updated_at::text
FROM iam.instance_keycloak_provisioning_runs
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
        [instanceId, runId]
      )
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    const stepsByRunId = await listKeycloakProvisioningStepRows(executor, [row.id]);
    return mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []);
  },

  async claimNextKeycloakProvisioningRun() {
    const rows = await queryRows<KeycloakProvisioningRunRow>(
      executor,
      statement(
        `
WITH next_run AS (
  SELECT id
  FROM iam.instance_keycloak_provisioning_runs
  WHERE overall_status = 'planned'
  ORDER BY created_at ASC, id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE iam.instance_keycloak_provisioning_runs AS runs
SET
  overall_status = 'running',
  updated_at = NOW()
FROM next_run
WHERE runs.id = next_run.id
RETURNING
  runs.id::text AS id,
  runs.instance_id,
  runs.mode,
  runs.intent,
  runs.overall_status,
  runs.drift_summary,
  runs.request_id,
  runs.actor_id,
  runs.created_at::text,
  runs.updated_at::text;
`,
        []
      )
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    const stepsByRunId = await listKeycloakProvisioningStepRows(executor, [row.id]);
    return mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []);
  },

  async createInstance(input) {
    const rows = await queryRows<InstanceListRow>(
      executor,
      {
        text: `
INSERT INTO iam.instances (
  id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  realm_mode,
  auth_realm,
  auth_client_id,
  auth_issuer_url,
  auth_client_secret_ciphertext,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_by,
  updated_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $18)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  parent_domain = EXCLUDED.parent_domain,
  primary_hostname = EXCLUDED.primary_hostname,
  realm_mode = EXCLUDED.realm_mode,
  auth_realm = EXCLUDED.auth_realm,
  auth_client_id = EXCLUDED.auth_client_id,
  auth_issuer_url = EXCLUDED.auth_issuer_url,
  auth_client_secret_ciphertext = EXCLUDED.auth_client_secret_ciphertext,
  tenant_admin_username = EXCLUDED.tenant_admin_username,
  tenant_admin_email = EXCLUDED.tenant_admin_email,
  tenant_admin_first_name = EXCLUDED.tenant_admin_first_name,
  tenant_admin_last_name = EXCLUDED.tenant_admin_last_name,
  theme_key = EXCLUDED.theme_key,
  feature_flags = EXCLUDED.feature_flags,
  mainserver_config_ref = EXCLUDED.mainserver_config_ref,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW()
RETURNING
  id AS instance_id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  realm_mode,
  auth_realm,
  auth_client_id,
  auth_issuer_url,
  auth_client_secret_ciphertext,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_at::text,
  created_by,
  updated_at::text,
  updated_by;
`,
        values: [
          input.instanceId,
          input.displayName,
          input.status,
          input.parentDomain,
          input.primaryHostname,
          input.realmMode,
          input.authRealm,
          input.authClientId,
          input.authIssuerUrl ?? null,
          input.authClientSecretCiphertext ?? null,
          input.tenantAdminBootstrap?.username ?? null,
          input.tenantAdminBootstrap?.email ?? null,
          input.tenantAdminBootstrap?.firstName ?? null,
          input.tenantAdminBootstrap?.lastName ?? null,
          input.themeKey ?? null,
          JSON.stringify(input.featureFlags ?? {}),
          input.mainserverConfigRef ?? null,
          input.actorId ?? 'system',
        ],
      }
    );

    await executor.execute({
      text: `
INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES ($1, $2, true, $3)
ON CONFLICT (hostname) DO UPDATE
SET
  instance_id = EXCLUDED.instance_id,
  is_primary = EXCLUDED.is_primary;
`,
      values: [input.primaryHostname, input.instanceId, input.actorId ?? 'system'],
    });

    return mapInstance(rows[0]);
  },

  async setInstanceStatus(input) {
    const rows = await queryRows<InstanceListRow>(
      executor,
      statement(
        `
UPDATE iam.instances
SET
  status = $2,
  updated_by = $3,
  updated_at = NOW()
WHERE id = $1
RETURNING
  id AS instance_id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  realm_mode,
  auth_realm,
  auth_client_id,
  auth_issuer_url,
  auth_client_secret_ciphertext,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_at::text,
  created_by,
  updated_at::text,
  updated_by;
`,
        [input.instanceId, input.status, input.actorId ?? 'system']
      )
    );
    return rows[0] ? mapInstance(rows[0]) : null;
  },

  async updateInstance(input) {
    const rows = await queryRows<InstanceListRow>(
      executor,
      statement(
        `
UPDATE iam.instances
SET
  display_name = $2,
  parent_domain = $3,
  primary_hostname = $4,
  realm_mode = $5,
  auth_realm = $6,
  auth_client_id = $7,
  auth_issuer_url = $8,
  auth_client_secret_ciphertext = CASE
    WHEN $9::boolean THEN auth_client_secret_ciphertext
    ELSE $10
  END,
  tenant_admin_username = $11,
  tenant_admin_email = $12,
  tenant_admin_first_name = $13,
  tenant_admin_last_name = $14,
  theme_key = $15,
  feature_flags = $16::jsonb,
  mainserver_config_ref = $17,
  updated_by = $18,
  updated_at = NOW()
WHERE id = $1
RETURNING
  id AS instance_id,
  display_name,
  status,
  parent_domain,
  primary_hostname,
  realm_mode,
  auth_realm,
  auth_client_id,
  auth_issuer_url,
  auth_client_secret_ciphertext,
  tenant_admin_username,
  tenant_admin_email,
  tenant_admin_first_name,
  tenant_admin_last_name,
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_at::text,
  created_by,
  updated_at::text,
  updated_by;
`,
        [
          input.instanceId,
          input.displayName,
          input.parentDomain,
          input.primaryHostname,
          input.realmMode,
          input.authRealm,
          input.authClientId,
          input.authIssuerUrl ?? null,
          input.keepExistingAuthClientSecret !== false && typeof input.authClientSecretCiphertext === 'undefined',
          input.authClientSecretCiphertext ?? null,
          input.tenantAdminBootstrap?.username ?? null,
          input.tenantAdminBootstrap?.email ?? null,
          input.tenantAdminBootstrap?.firstName ?? null,
          input.tenantAdminBootstrap?.lastName ?? null,
          input.themeKey ?? null,
          JSON.stringify(input.featureFlags ?? {}),
          input.mainserverConfigRef ?? null,
          input.actorId ?? 'system',
        ]
      )
    );

    if (!rows[0]) {
      return null;
    }

    await executor.execute({
      text: `
INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
VALUES ($1, $2, true, $3)
ON CONFLICT (hostname) DO UPDATE
SET
  instance_id = EXCLUDED.instance_id,
  is_primary = EXCLUDED.is_primary;
`,
      values: [input.primaryHostname, input.instanceId, input.actorId ?? 'system'],
    });

    return mapInstance(rows[0]);
  },

  async createProvisioningRun(input) {
    const rows = await queryRows<ProvisioningRow>(
      executor,
      statement(
        `
INSERT INTO iam.instance_provisioning_runs (
  instance_id,
  operation,
  status,
  step_key,
  idempotency_key,
  error_code,
  error_message,
  request_id,
  actor_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING
  id::text,
  instance_id,
  operation,
  status,
  step_key,
  idempotency_key,
  error_code,
  error_message,
  request_id,
  actor_id,
  created_at::text,
  updated_at::text;
`,
        [
          input.instanceId,
          input.operation,
          input.status,
          input.stepKey ?? null,
          input.idempotencyKey,
          input.errorCode ?? null,
          input.errorMessage ?? null,
          input.requestId ?? null,
          input.actorId ?? null,
        ]
      )
    );
    return mapProvisioningRun(rows[0]);
  },

  async appendAuditEvent(input) {
    await executor.execute({
      text: `
INSERT INTO iam.instance_audit_events (
  instance_id,
  event_type,
  actor_id,
  request_id,
  details
)
VALUES ($1, $2, $3, $4, $5::jsonb);
`,
      values: [
        input.instanceId,
        input.eventType,
        input.actorId ?? null,
        input.requestId ?? null,
        JSON.stringify(input.details ?? {}),
      ],
    });
  },

  async createKeycloakProvisioningRun(input) {
    const rows = await queryRows<KeycloakProvisioningRunRow>(
      executor,
      statement(
        `
INSERT INTO iam.instance_keycloak_provisioning_runs (
  instance_id,
  mode,
  intent,
  overall_status,
  drift_summary,
  request_id,
  actor_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING
  id::text,
  instance_id,
  mode,
  intent,
  overall_status,
  drift_summary,
  request_id,
  actor_id,
  created_at::text,
  updated_at::text;
`,
        [
          input.instanceId,
          input.mode,
          input.intent,
          input.overallStatus,
          input.driftSummary,
          input.requestId ?? null,
          input.actorId ?? null,
        ]
      )
    );
    return mapKeycloakProvisioningRun(rows[0], []);
  },

  async updateKeycloakProvisioningRun(input) {
    const rows = await queryRows<KeycloakProvisioningRunRow>(
      executor,
      statement(
        `
UPDATE iam.instance_keycloak_provisioning_runs
SET
  overall_status = $2,
  drift_summary = COALESCE($3, drift_summary),
  updated_at = NOW()
WHERE id = $1::uuid
RETURNING
  id::text,
  instance_id,
  mode,
  intent,
  overall_status,
  drift_summary,
  request_id,
  actor_id,
  created_at::text,
  updated_at::text;
`,
        [input.runId, input.overallStatus, input.driftSummary ?? null]
      )
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    const stepsByRunId = await listKeycloakProvisioningStepRows(executor, [row.id]);
    return mapKeycloakProvisioningRun(row, stepsByRunId[row.id] ?? []);
  },

  async appendKeycloakProvisioningStep(input) {
    const rows = await queryRows<KeycloakProvisioningStepRow>(
      executor,
      statement(
        `
INSERT INTO iam.instance_keycloak_provisioning_steps (
  run_id,
  step_key,
  title,
  status,
  started_at,
  finished_at,
  summary,
  details,
  request_id
)
VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8::jsonb, $9)
RETURNING
  id::text,
  run_id::text,
  step_key,
  title,
  status,
  started_at::text,
  finished_at::text,
  summary,
  details,
  request_id,
  created_at::text;
`,
        [
          input.runId,
          input.stepKey,
          input.title,
          input.status,
          input.startedAt ?? null,
          input.finishedAt ?? null,
          input.summary,
          JSON.stringify(input.details ?? {}),
          input.requestId ?? null,
        ]
      )
    );
    return mapKeycloakProvisioningRunStep(rows[0]);
  },
});
