import type {
  InstanceAuditEvent,
  InstanceProvisioningOperation,
  InstanceProvisioningRun,
  InstanceRegistryRecord,
  InstanceStatus,
} from '@sva/core';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types';

type InstanceListRow = {
  instance_id: string;
  display_name: string;
  status: InstanceStatus;
  parent_domain: string;
  primary_hostname: string;
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

const mapInstance = (row: InstanceListRow): InstanceRegistryRecord => ({
  instanceId: row.instance_id,
  displayName: row.display_name,
  status: row.status,
  parentDomain: row.parent_domain,
  primaryHostname: row.primary_hostname,
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

export type InstanceRegistryRepository = {
  listInstances(input?: { search?: string; status?: InstanceStatus }): Promise<readonly InstanceRegistryRecord[]>;
  getInstanceById(instanceId: string): Promise<InstanceRegistryRecord | null>;
  resolveHostname(hostname: string): Promise<InstanceRegistryRecord | null>;
  listProvisioningRuns(instanceId: string): Promise<readonly InstanceProvisioningRun[]>;
  listLatestProvisioningRuns(
    instanceIds: readonly string[]
  ): Promise<Readonly<Record<string, InstanceProvisioningRun | undefined>>>;
  listAuditEvents(instanceId: string): Promise<readonly InstanceAuditEvent[]>;
  createInstance(input: {
    instanceId: string;
    displayName: string;
    status: InstanceStatus;
    parentDomain: string;
    primaryHostname: string;
    actorId?: string;
    requestId?: string;
    themeKey?: string;
    featureFlags?: Readonly<Record<string, boolean>>;
    mainserverConfigRef?: string;
  }): Promise<InstanceRegistryRecord>;
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
};

const statement = (text: string, values: readonly (string | number | boolean | null)[]): SqlStatement => ({ text, values });

const queryRows = async <TRow>(executor: SqlExecutor, sql: SqlStatement): Promise<readonly TRow[]> => {
  const result: SqlExecutionResult<TRow> = await executor.execute<TRow>(sql);
  return result.rows;
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
  theme_key,
  feature_flags,
  mainserver_config_ref,
  created_by,
  updated_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $9)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  parent_domain = EXCLUDED.parent_domain,
  primary_hostname = EXCLUDED.primary_hostname,
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
});
