import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/sdk/server';
import { decryptFieldValue, encryptFieldValue, parseFieldEncryptionConfigFromEnv } from '@sva/core/security';

import { withAuthenticatedUser } from './middleware.server';

const logger = createSdkLogger({ component: 'iam-dsr', level: 'info' });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPORT_FORMATS = new Set(['json', 'csv', 'xml']);
const ADMIN_ROLES = new Set(['iam_admin', 'support_admin', 'system_admin']);
const ART19_RECIPIENT_CLASSES = ['internal_processor', 'downstream_export', 'analytics_sink'] as const;
const DELETE_SLA_HOURS = 48;
const DEFAULT_DELETE_RETENTION_HOURS = 24;

type QueryResult<TRow> = {
  rowCount: number;
  rows: TRow[];
};

type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
};

type ExportFormat = 'json' | 'csv' | 'xml';
type DsrRequestType = 'access' | 'deletion' | 'rectification' | 'restriction' | 'objection';

type AccountSnapshot = {
  id: string;
  keycloak_subject: string;
  email_ciphertext: string | null;
  display_name_ciphertext: string | null;
  is_blocked: boolean;
  soft_deleted_at: string | null;
  delete_after: string | null;
  permanently_deleted_at: string | null;
  processing_restricted_at: string | null;
  processing_restriction_reason: string | null;
  non_essential_processing_opt_out_at: string | null;
  created_at: string;
  updated_at: string;
};

type ExportPayload = {
  meta: {
    generatedAt: string;
    instanceId: string;
    format: ExportFormat;
    subject: string;
  };
  account: {
    id: string;
    keycloakSubject: string;
    email?: string;
    displayName?: string;
    encryptedEmail?: string | null;
    encryptedDisplayName?: string | null;
    isBlocked: boolean;
    softDeletedAt?: string | null;
    deleteAfter?: string | null;
    permanentlyDeletedAt?: string | null;
    processingRestrictedAt?: string | null;
    processingRestrictionReason?: string | null;
    nonEssentialProcessingOptOutAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  organizations: Array<{ id: string; organizationKey: string; displayName: string }>;
  roles: Array<{ id: string; roleName: string; description: string | null }>;
  legalHolds: Array<{ id: string; active: boolean; holdReason: string; holdUntil: string | null; createdAt: string }>;
  dsrRequests: Array<{ id: string; requestType: string; status: string; requestAcceptedAt: string; completedAt: string | null }>;
  consents: {
    nonEssentialProcessingAllowed: boolean;
  };
};

let dsrPool: Pool | null = null;

const resolvePool = (): Pool | null => {
  const databaseUrl = process.env.IAM_DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  if (!dsrPool) {
    dsrPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }

  return dsrPool;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readBoolean = (value: unknown): boolean | undefined => {
  if (typeof value !== 'boolean') {
    return undefined;
  }
  return value;
};

const readObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

const isUuid = (value: string) => UUID_PATTERN.test(value);

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const textResponse = (status: number, body: string, contentType: string) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  });

const buildLogContext = (instanceId?: string) => {
  const context = getWorkspaceContext();
  return {
    workspace_id: instanceId ?? context.workspaceId ?? 'default',
    request_id: context.requestId,
    trace_id: context.traceId,
  };
};

const withInstanceDb = async <T>(instanceId: string, work: (client: QueryClient) => Promise<T>): Promise<T> => {
  const pool = resolvePool();
  if (!pool) {
    throw new Error('IAM database not configured');
  }

  const client = (await pool.connect()) as PoolClient & QueryClient;
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', instanceId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const isAdminRole = (roles: readonly string[]): boolean => roles.some((role) => ADMIN_ROLES.has(role));

const resolveAccountBySubject = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<AccountSnapshot | undefined> => {
  const query = await client.query<AccountSnapshot>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.email_ciphertext,
  a.display_name_ciphertext,
  a.is_blocked,
  a.soft_deleted_at,
  a.delete_after,
  a.permanently_deleted_at,
  a.processing_restricted_at,
  a.processing_restriction_reason,
  a.non_essential_processing_opt_out_at,
  a.created_at,
  a.updated_at
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );

  if (query.rowCount <= 0) {
    return undefined;
  }
  return query.rows[0];
};

const resolveAccountById = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<AccountSnapshot | undefined> => {
  const query = await client.query<AccountSnapshot>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.email_ciphertext,
  a.display_name_ciphertext,
  a.is_blocked,
  a.soft_deleted_at,
  a.delete_after,
  a.permanently_deleted_at,
  a.processing_restricted_at,
  a.processing_restriction_reason,
  a.non_essential_processing_opt_out_at,
  a.created_at,
  a.updated_at
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

  if (query.rowCount <= 0) {
    return undefined;
  }
  return query.rows[0];
};

const hashPseudonym = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

const maybeDecryptField = (value: string | null | undefined, aad: string): string | undefined => {
  if (!value || !value.startsWith('enc:v1:')) {
    return undefined;
  }
  const config = parseFieldEncryptionConfigFromEnv(process.env);
  if (!config) {
    return undefined;
  }
  try {
    return decryptFieldValue(value, config.keyring, aad);
  } catch {
    return undefined;
  }
};

const escapeCsv = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const flattenToCsvRows = (value: unknown, path = ''): Array<{ key: string; value: string }> => {
  if (value === null || value === undefined) {
    return [{ key: path, value: '' }];
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ key: path, value: String(value) }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenToCsvRows(entry, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      flattenToCsvRows(nested, path ? `${path}.${key}` : key)
    );
  }
  return [{ key: path, value: String(value) }];
};

const toCsv = (payload: ExportPayload): string => {
  const rows = flattenToCsvRows(payload);
  const body = rows.map((row) => `${escapeCsv(row.key)},${escapeCsv(row.value)}`).join('\n');
  return `field,value\n${body}`;
};

const toXmlNode = (name: string, value: unknown): string => {
  if (value === null || value === undefined) {
    return `<${name}/>`;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const escaped = String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    return `<${name}>${escaped}</${name}>`;
  }
  if (Array.isArray(value)) {
    return `<${name}>${value.map((entry) => toXmlNode('item', entry)).join('')}</${name}>`;
  }
  const objectValue = value as Record<string, unknown>;
  const children = Object.entries(objectValue)
    .map(([key, nested]) => toXmlNode(key, nested))
    .join('');
  return `<${name}>${children}</${name}>`;
};

const toXml = (payload: ExportPayload): string => `<?xml version="1.0" encoding="UTF-8"?>${toXmlNode('dataExport', payload)}`;

const parseExportFormat = (request: Request): ExportFormat | null => {
  const url = new URL(request.url);
  const format = (readString(url.searchParams.get('format')) ?? 'json').toLowerCase();
  if (!EXPORT_FORMATS.has(format)) {
    return null;
  }
  return format as ExportFormat;
};

const parseAsyncMode = (request: Request): boolean => {
  const value = readString(new URL(request.url).searchParams.get('async'))?.toLowerCase();
  return value === '1' || value === 'true';
};

const resolveInstanceId = (request: Request, fallback?: string): string | undefined => {
  return readString(new URL(request.url).searchParams.get('instanceId')) ?? fallback;
};

const resolveRetentionHours = () => {
  const parsed = Number(process.env.IAM_DSR_DELETE_RETENTION_HOURS ?? DEFAULT_DELETE_RETENTION_HOURS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DELETE_RETENTION_HOURS;
  }
  return Math.floor(parsed);
};

const isLegalHoldActive = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<boolean> => {
  const result = await client.query<{ id: string }>(
    `
SELECT id
FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND active = true
  AND (hold_until IS NULL OR hold_until > NOW())
LIMIT 1;
`,
    [input.instanceId, input.accountId]
  );

  return result.rowCount > 0;
};

const emitDsrAuditEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    eventType: string;
    payload: Record<string, unknown>;
  }
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.activity_logs (instance_id, account_id, event_type, payload, request_id, trace_id)
VALUES ($1, $2::uuid, $3, $4::jsonb, $5, $6);
`,
    [
      input.instanceId,
      input.accountId ?? null,
      input.eventType,
      JSON.stringify(input.payload),
      getWorkspaceContext().requestId ?? null,
      getWorkspaceContext().traceId ?? null,
    ]
  );
};

const createDsrRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requestType: DsrRequestType;
    status: 'accepted' | 'processing' | 'blocked_legal_hold' | 'completed' | 'failed' | 'escalated';
    requesterAccountId?: string;
    targetAccountId: string;
    payload?: Record<string, unknown>;
    legalHoldBlocked?: boolean;
    slaDeadlineAt?: string;
    completedAt?: string;
  }
): Promise<string> => {
  const created = await client.query<{ id: string }>(
    `
INSERT INTO iam.data_subject_requests (
  instance_id,
  request_type,
  status,
  requester_account_id,
  target_account_id,
  legal_hold_blocked,
  payload,
  sla_deadline_at,
  completed_at
)
VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6, $7::jsonb, $8::timestamptz, $9::timestamptz)
RETURNING id;
`,
    [
      input.instanceId,
      input.requestType,
      input.status,
      input.requesterAccountId ?? null,
      input.targetAccountId,
      input.legalHoldBlocked ?? false,
      JSON.stringify(input.payload ?? {}),
      input.slaDeadlineAt ?? null,
      input.completedAt ?? null,
    ]
  );

  return created.rows[0]!.id;
};

const appendDsrRequestEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requestId: string;
    actorAccountId?: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.data_subject_request_events (instance_id, request_id, actor_account_id, event_type, event_payload)
VALUES ($1, $2::uuid, $3::uuid, $4, $5::jsonb);
`,
    [
      input.instanceId,
      input.requestId,
      input.actorAccountId ?? null,
      input.eventType,
      JSON.stringify(input.payload ?? {}),
    ]
  );
};

const ensureArt19RecipientRows = async (
  client: QueryClient,
  input: { instanceId: string; requestId: string }
): Promise<void> => {
  for (const recipientClass of ART19_RECIPIENT_CLASSES) {
    await client.query(
      `
INSERT INTO iam.data_subject_recipient_notifications (
  instance_id,
  request_id,
  recipient_class,
  notification_status
)
VALUES ($1, $2::uuid, $3, 'pending')
ON CONFLICT (instance_id, request_id, recipient_class) DO NOTHING;
`,
      [input.instanceId, input.requestId, recipientClass]
    );
  }
};

const collectExportPayload = async (
  client: QueryClient,
  input: { instanceId: string; account: AccountSnapshot; format: ExportFormat }
): Promise<ExportPayload> => {
  const orgRows = await client.query<{ id: string; organization_key: string; display_name: string }>(
    `
SELECT o.id, o.organization_key, o.display_name
FROM iam.account_organizations ao
JOIN iam.organizations o
  ON o.instance_id = ao.instance_id
 AND o.id = ao.organization_id
WHERE ao.instance_id = $1
  AND ao.account_id = $2::uuid
ORDER BY o.display_name ASC;
`,
    [input.instanceId, input.account.id]
  );

  const roleRows = await client.query<{ id: string; role_name: string; description: string | null }>(
    `
SELECT r.id, r.role_name, r.description
FROM iam.account_roles ar
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE ar.instance_id = $1
  AND ar.account_id = $2::uuid
ORDER BY r.role_name ASC;
`,
    [input.instanceId, input.account.id]
  );

  const holdRows = await client.query<{ id: string; active: boolean; hold_reason: string; hold_until: string | null; created_at: string }>(
    `
SELECT id, active, hold_reason, hold_until, created_at
FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
ORDER BY created_at DESC
LIMIT 20;
`,
    [input.instanceId, input.account.id]
  );

  const requestRows = await client.query<{
    id: string;
    request_type: string;
    status: string;
    request_accepted_at: string;
    completed_at: string | null;
  }>(
    `
SELECT id, request_type, status, request_accepted_at, completed_at
FROM iam.data_subject_requests
WHERE instance_id = $1
  AND target_account_id = $2::uuid
ORDER BY request_accepted_at DESC
LIMIT 50;
`,
    [input.instanceId, input.account.id]
  );

  const emailDecrypted = maybeDecryptField(
    input.account.email_ciphertext,
    `iam.accounts.email:${input.account.keycloak_subject}`
  );
  const displayNameDecrypted = maybeDecryptField(
    input.account.display_name_ciphertext,
    `iam.accounts.display_name:${input.account.keycloak_subject}`
  );

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      instanceId: input.instanceId,
      format: input.format,
      subject: input.account.keycloak_subject,
    },
    account: {
      id: input.account.id,
      keycloakSubject: input.account.keycloak_subject,
      email: emailDecrypted,
      displayName: displayNameDecrypted,
      encryptedEmail: input.account.email_ciphertext,
      encryptedDisplayName: input.account.display_name_ciphertext,
      isBlocked: input.account.is_blocked,
      softDeletedAt: input.account.soft_deleted_at,
      deleteAfter: input.account.delete_after,
      permanentlyDeletedAt: input.account.permanently_deleted_at,
      processingRestrictedAt: input.account.processing_restricted_at,
      processingRestrictionReason: input.account.processing_restriction_reason,
      nonEssentialProcessingOptOutAt: input.account.non_essential_processing_opt_out_at,
      createdAt: input.account.created_at,
      updatedAt: input.account.updated_at,
    },
    organizations: orgRows.rows.map((row) => ({
      id: row.id,
      organizationKey: row.organization_key,
      displayName: row.display_name,
    })),
    roles: roleRows.rows.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      description: row.description,
    })),
    legalHolds: holdRows.rows.map((row) => ({
      id: row.id,
      active: row.active,
      holdReason: row.hold_reason,
      holdUntil: row.hold_until,
      createdAt: row.created_at,
    })),
    dsrRequests: requestRows.rows.map((row) => ({
      id: row.id,
      requestType: row.request_type,
      status: row.status,
      requestAcceptedAt: row.request_accepted_at,
      completedAt: row.completed_at,
    })),
    consents: {
      nonEssentialProcessingAllowed: !Boolean(input.account.non_essential_processing_opt_out_at),
    },
  };
};

const serializeExportPayload = (format: ExportFormat, payload: ExportPayload): string => {
  if (format === 'csv') {
    return toCsv(payload);
  }
  if (format === 'xml') {
    return toXml(payload);
  }
  return JSON.stringify(payload, null, 2);
};

const createAsyncExportJob = async (
  client: QueryClient,
  input: {
    instanceId: string;
    targetAccountId: string;
    requestedByAccountId: string;
    format: ExportFormat;
  }
): Promise<{ id: string; status: string }> => {
  const created = await client.query<{ id: string; status: string }>(
    `
INSERT INTO iam.data_subject_export_jobs (
  instance_id,
  target_account_id,
  requested_by_account_id,
  format,
  status
)
VALUES ($1, $2::uuid, $3::uuid, $4, 'queued')
RETURNING id, status;
`,
    [input.instanceId, input.targetAccountId, input.requestedByAccountId, input.format]
  );

  return created.rows[0]!;
};

const processQueuedExportJobs = async (
  client: QueryClient,
  input: { instanceId: string; dryRun: boolean }
): Promise<number> => {
  const queued = await client.query<{
    id: string;
    target_account_id: string;
    format: ExportFormat;
  }>(
    `
SELECT id, target_account_id, format
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND status = 'queued'
ORDER BY created_at ASC
LIMIT 20;
`,
    [input.instanceId]
  );

  if (input.dryRun || queued.rowCount <= 0) {
    return queued.rowCount;
  }

  for (const job of queued.rows) {
    await client.query(
      `
UPDATE iam.data_subject_export_jobs
SET status = 'processing', started_at = NOW(), error_message = NULL
WHERE id = $1::uuid;
`,
      [job.id]
    );

    try {
      const account = await resolveAccountById(client, {
        instanceId: input.instanceId,
        accountId: job.target_account_id,
      });
      if (!account) {
        throw new Error('target_account_not_found');
      }

      const payload = await collectExportPayload(client, {
        instanceId: input.instanceId,
        account,
        format: job.format,
      });

      const payloadJson = JSON.stringify(payload);
      const payloadCsv = serializeExportPayload('csv', payload);
      const payloadXml = serializeExportPayload('xml', payload);

      await client.query(
        `
UPDATE iam.data_subject_export_jobs
SET
  status = 'completed',
  completed_at = NOW(),
  payload_json = $2::jsonb,
  payload_csv = $3,
  payload_xml = $4,
  error_message = NULL
WHERE id = $1::uuid;
`,
        [job.id, payloadJson, payloadCsv, payloadXml]
      );
    } catch (error) {
      await client.query(
        `
UPDATE iam.data_subject_export_jobs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = $2
WHERE id = $1::uuid;
`,
        [job.id, error instanceof Error ? error.message : String(error)]
      );
    }
  }

  return queued.rowCount;
};

const escalateOverdueDeleteRequests = async (
  client: QueryClient,
  input: { instanceId: string; dryRun: boolean }
): Promise<number> => {
  const overdue = await client.query<{ id: string; target_account_id: string }>(
    `
SELECT id, target_account_id
FROM iam.data_subject_requests
WHERE instance_id = $1
  AND request_type = 'deletion'
  AND status IN ('accepted', 'processing')
  AND sla_deadline_at IS NOT NULL
  AND sla_deadline_at < NOW()
  AND escalated_at IS NULL
ORDER BY request_accepted_at ASC;
`,
    [input.instanceId]
  );

  if (input.dryRun || overdue.rowCount <= 0) {
    return overdue.rowCount;
  }

  for (const entry of overdue.rows) {
    await client.query(
      `
UPDATE iam.data_subject_requests
SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
WHERE id = $1::uuid;
`,
      [entry.id]
    );

    await appendDsrRequestEvent(client, {
      instanceId: input.instanceId,
      requestId: entry.id,
      eventType: 'sla_escalated',
      payload: {
        reason: 'soft_delete_not_completed_in_time',
      },
    });

    await emitDsrAuditEvent(client, {
      instanceId: input.instanceId,
      accountId: entry.target_account_id,
      eventType: 'dsr_deletion_sla_escalated',
      payload: {
        request_id: entry.id,
        result: 'failure',
      },
    });
  }

  return overdue.rowCount;
};

const finalizeEligibleDeletions = async (
  client: QueryClient,
  input: { instanceId: string; dryRun: boolean }
): Promise<number> => {
  const candidates = await client.query<{ id: string; keycloak_subject: string }>(
    `
SELECT id, keycloak_subject
FROM iam.accounts
WHERE soft_deleted_at IS NOT NULL
  AND permanently_deleted_at IS NULL
  AND delete_after IS NOT NULL
  AND delete_after <= NOW();
`,
    []
  );

  if (input.dryRun || candidates.rowCount <= 0) {
    return candidates.rowCount;
  }

  for (const account of candidates.rows) {
    const holdActive = await isLegalHoldActive(client, {
      instanceId: input.instanceId,
      accountId: account.id,
    });

    if (holdActive) {
      await client.query(
        `
UPDATE iam.data_subject_requests
SET
  status = 'blocked_legal_hold',
  legal_hold_blocked = true,
  updated_at = NOW()
WHERE instance_id = $1
  AND target_account_id = $2::uuid
  AND request_type = 'deletion'
  AND status IN ('accepted', 'processing', 'escalated');
`,
        [input.instanceId, account.id]
      );
      continue;
    }

    const pseudonym = `deleted:${hashPseudonym(`${input.instanceId}:${account.id}`)}`;

    await client.query(
      `
UPDATE iam.activity_logs
SET
  account_id = NULL,
  payload =
    (payload - 'actor_user_id' - 'actor_email' - 'actor_display_name') ||
    jsonb_build_object('subject_pseudonym', $2, 'deleted_account', true)
WHERE instance_id = $1
  AND account_id = $3::uuid;
`,
      [input.instanceId, pseudonym, account.id]
    );

    await client.query(
      `
DELETE FROM iam.account_roles
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
      [input.instanceId, account.id]
    );

    await client.query(
      `
DELETE FROM iam.account_organizations
WHERE instance_id = $1
  AND account_id = $2::uuid;
`,
      [input.instanceId, account.id]
    );

    await client.query(
      `
UPDATE iam.accounts
SET
  keycloak_subject = $3,
  email_ciphertext = NULL,
  display_name_ciphertext = NULL,
  permanently_deleted_at = NOW(),
  delete_after = NULL,
  processing_restricted_at = NULL,
  processing_restriction_reason = NULL,
  non_essential_processing_opt_out_at = NULL,
  updated_at = NOW()
WHERE id = $2::uuid;
`,
      [input.instanceId, account.id, pseudonym]
    );

    await client.query(
      `
UPDATE iam.data_subject_requests
SET status = 'completed', completed_at = NOW(), updated_at = NOW(), legal_hold_blocked = false
WHERE instance_id = $1
  AND target_account_id = $2::uuid
  AND request_type = 'deletion'
  AND status IN ('accepted', 'processing', 'escalated', 'blocked_legal_hold');
`,
      [input.instanceId, account.id]
    );

    await emitDsrAuditEvent(client, {
      instanceId: input.instanceId,
      eventType: 'dsr_deletion_finalized',
      payload: {
        subject_pseudonym: pseudonym,
        result: 'success',
      },
    });
  }

  return candidates.rowCount;
};

const processArt19Notifications = async (
  client: QueryClient,
  input: { instanceId: string; dryRun: boolean }
): Promise<number> => {
  const pending = await client.query<{ id: string }>(
    `
SELECT n.id
FROM iam.data_subject_recipient_notifications n
JOIN iam.data_subject_requests r
  ON r.id = n.request_id
 AND r.instance_id = n.instance_id
WHERE n.instance_id = $1
  AND n.notification_status = 'pending'
  AND r.request_type IN ('rectification', 'restriction', 'deletion')
  AND r.status IN ('completed', 'processing', 'blocked_legal_hold', 'escalated')
ORDER BY n.created_at ASC
LIMIT 200;
`,
    [input.instanceId]
  );

  if (input.dryRun || pending.rowCount <= 0) {
    return pending.rowCount;
  }

  for (const row of pending.rows) {
    await client.query(
      `
UPDATE iam.data_subject_recipient_notifications
SET
  notification_status = 'sent',
  notification_result = 'documented_by_system',
  notified_at = NOW()
WHERE id = $1::uuid;
`,
      [row.id]
    );
  }

  return pending.rowCount;
};

const resolveRequesterAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const account = await resolveAccountBySubject(client, input);
  return account?.id;
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object') {
    return null;
  }
  return body as Record<string, unknown>;
};

const parseDsrRequestType = (raw: unknown): DsrRequestType | null => {
  const type = readString(raw)?.toLowerCase();
  if (!type) {
    return null;
  }
  if (type === 'access' || type === 'deletion' || type === 'rectification' || type === 'restriction' || type === 'objection') {
    return type;
  }
  return null;
};

export const dataExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = resolveInstanceId(request, user.instanceId);
      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      const format = parseExportFormat(request);
      if (!format) {
        return jsonResponse(400, { error: 'invalid_export_format' });
      }

      const useAsync = parseAsyncMode(request);

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const account = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!account) {
            return jsonResponse(404, { error: 'account_not_found' });
          }

          if (useAsync) {
            const job = await createAsyncExportJob(client, {
              instanceId,
              targetAccountId: account.id,
              requestedByAccountId: account.id,
              format,
            });

            const requestId = await createDsrRequest(client, {
              instanceId,
              requestType: 'access',
              status: 'accepted',
              requesterAccountId: account.id,
              targetAccountId: account.id,
              payload: { format, mode: 'async', exportJobId: job.id },
            });

            await appendDsrRequestEvent(client, {
              instanceId,
              requestId,
              actorAccountId: account.id,
              eventType: 'export_job_queued',
              payload: { exportJobId: job.id, format },
            });

            await emitDsrAuditEvent(client, {
              instanceId,
              accountId: account.id,
              eventType: 'dsr_export_requested',
              payload: {
                request_id: requestId,
                export_job_id: job.id,
                format,
                mode: 'async',
              },
            });

            return jsonResponse(202, {
              exportJobId: job.id,
              status: job.status,
              format,
            });
          }

          const payload = await collectExportPayload(client, {
            instanceId,
            account,
            format,
          });

          const requestId = await createDsrRequest(client, {
            instanceId,
            requestType: 'access',
            status: 'completed',
            requesterAccountId: account.id,
            targetAccountId: account.id,
            payload: { format, mode: 'sync' },
            completedAt: new Date().toISOString(),
          });

          await appendDsrRequestEvent(client, {
            instanceId,
            requestId,
            actorAccountId: account.id,
            eventType: 'export_delivered',
            payload: { format, mode: 'sync' },
          });

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: account.id,
            eventType: 'dsr_export_delivered',
            payload: {
              request_id: requestId,
              format,
              mode: 'sync',
              result: 'success',
            },
          });

          if (format === 'json') {
            return textResponse(200, JSON.stringify(payload, null, 2), 'application/json');
          }
          if (format === 'csv') {
            return textResponse(200, serializeExportPayload(format, payload), 'text/csv; charset=utf-8');
          }
          return textResponse(200, serializeExportPayload(format, payload), 'application/xml; charset=utf-8');
        });
      } catch (error) {
        logger.error('DSR self export failed', {
          operation: 'data_export',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const dataExportStatusHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const url = new URL(request.url);
      const instanceId = resolveInstanceId(request, user.instanceId);
      const jobId = readString(url.searchParams.get('jobId'));
      const downloadFormat = readString(url.searchParams.get('download'))?.toLowerCase() as ExportFormat | undefined;
      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!jobId || !isUuid(jobId)) {
        return jsonResponse(400, { error: 'invalid_job_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const requester = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!requester) {
            return jsonResponse(404, { error: 'account_not_found' });
          }

          const result = await client.query<{
            id: string;
            format: ExportFormat;
            status: string;
            error_message: string | null;
            payload_json: Record<string, unknown> | null;
            payload_csv: string | null;
            payload_xml: string | null;
            created_at: string;
            completed_at: string | null;
          }>(
            `
SELECT id, format, status, error_message, payload_json, payload_csv, payload_xml, created_at, completed_at
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND id = $2::uuid
  AND requested_by_account_id = $3::uuid
LIMIT 1;
`,
            [instanceId, jobId, requester]
          );

          if (result.rowCount <= 0) {
            return jsonResponse(404, { error: 'export_job_not_found' });
          }

          const job = result.rows[0]!;
          if (job.status === 'completed' && downloadFormat && EXPORT_FORMATS.has(downloadFormat)) {
            if (downloadFormat === 'json') {
              return textResponse(200, JSON.stringify(job.payload_json ?? {}, null, 2), 'application/json');
            }
            if (downloadFormat === 'csv') {
              return textResponse(200, job.payload_csv ?? '', 'text/csv; charset=utf-8');
            }
            return textResponse(200, job.payload_xml ?? '', 'application/xml; charset=utf-8');
          }

          return jsonResponse(200, {
            id: job.id,
            format: job.format,
            status: job.status,
            createdAt: job.created_at,
            completedAt: job.completed_at,
            errorMessage: job.error_message,
          });
        });
      } catch (error) {
        logger.error('DSR export status lookup failed', {
          operation: 'data_export_status',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const adminDataExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!isAdminRole(user.roles)) {
        return jsonResponse(403, { error: 'forbidden' });
      }

      const url = new URL(request.url);
      const instanceId = resolveInstanceId(request, user.instanceId);
      const targetSubject = readString(url.searchParams.get('targetKeycloakSubject'));
      const format = parseExportFormat(request);
      const useAsync = parseAsyncMode(request);

      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!targetSubject) {
        return jsonResponse(400, { error: 'missing_target_keycloak_subject' });
      }
      if (!format) {
        return jsonResponse(400, { error: 'invalid_export_format' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const actor = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          const target = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: targetSubject,
          });
          if (!target) {
            return jsonResponse(404, { error: 'target_account_not_found' });
          }

          if (useAsync) {
            const job = await createAsyncExportJob(client, {
              instanceId,
              targetAccountId: target.id,
              requestedByAccountId: actor ?? target.id,
              format,
            });
            await emitDsrAuditEvent(client, {
              instanceId,
              accountId: actor,
              eventType: 'dsr_admin_export_requested',
              payload: {
                target_subject: targetSubject,
                export_job_id: job.id,
                format,
                mode: 'async',
              },
            });
            return jsonResponse(202, {
              exportJobId: job.id,
              status: job.status,
              format,
              target: targetSubject,
            });
          }

          const payload = await collectExportPayload(client, {
            instanceId,
            account: target,
            format,
          });

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: actor,
            eventType: 'dsr_admin_export_delivered',
            payload: {
              target_subject: targetSubject,
              format,
              mode: 'sync',
              result: 'success',
            },
          });

          if (format === 'json') {
            return textResponse(200, JSON.stringify(payload, null, 2), 'application/json');
          }
          if (format === 'csv') {
            return textResponse(200, serializeExportPayload(format, payload), 'text/csv; charset=utf-8');
          }
          return textResponse(200, serializeExportPayload(format, payload), 'application/xml; charset=utf-8');
        });
      } catch (error) {
        logger.error('DSR admin export failed', {
          operation: 'admin_data_export',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const profileCorrectionHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const body = await parseJsonBody(request);
      if (!body) {
        return jsonResponse(400, { error: 'invalid_request' });
      }

      const instanceId = readString(body.instanceId) ?? user.instanceId;
      const nextEmail = readString(body.email);
      const nextDisplayName = readString(body.displayName);
      const correctionReason = readString(body.reason);
      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!nextEmail && !nextDisplayName) {
        return jsonResponse(400, { error: 'missing_profile_fields' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      const encryptionConfig = parseFieldEncryptionConfigFromEnv(process.env);
      if (!encryptionConfig) {
        return jsonResponse(503, { error: 'encryption_not_configured' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const account = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!account) {
            return jsonResponse(404, { error: 'account_not_found' });
          }

          const emailCiphertext = nextEmail
            ? (() => {
                try {
                  return encryptFieldValue(nextEmail, encryptionConfig, `iam.accounts.email:${user.id}`);
                } catch {
                  return null;
                }
              })()
            : null;

          const displayNameCiphertext = nextDisplayName
            ? (() => {
                try {
                  return encryptFieldValue(nextDisplayName, encryptionConfig, `iam.accounts.display_name:${user.id}`);
                } catch {
                  return null;
                }
              })()
            : null;

          if ((nextEmail && !emailCiphertext) || (nextDisplayName && !displayNameCiphertext)) {
            return jsonResponse(500, { error: 'encryption_failed' });
          }

          await client.query(
            `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  updated_at = NOW()
WHERE id = $2::uuid;
`,
            [instanceId, account.id, emailCiphertext, displayNameCiphertext]
          );

          await client.query(
            `
INSERT INTO iam.account_profile_corrections (
  instance_id,
  account_id,
  actor_account_id,
  previous_email_ciphertext,
  previous_display_name_ciphertext,
  next_email_ciphertext,
  next_display_name_ciphertext,
  correction_reason
)
VALUES ($1, $2::uuid, $2::uuid, $3, $4, $5, $6, $7);
`,
            [
              instanceId,
              account.id,
              account.email_ciphertext,
              account.display_name_ciphertext,
              emailCiphertext,
              displayNameCiphertext,
              correctionReason ?? null,
            ]
          );

          const requestId = await createDsrRequest(client, {
            instanceId,
            requestType: 'rectification',
            status: 'completed',
            requesterAccountId: account.id,
            targetAccountId: account.id,
            payload: {
              changed_fields: {
                email: Boolean(nextEmail),
                displayName: Boolean(nextDisplayName),
              },
            },
            completedAt: new Date().toISOString(),
          });

          await ensureArt19RecipientRows(client, { instanceId, requestId });
          await appendDsrRequestEvent(client, {
            instanceId,
            requestId,
            actorAccountId: account.id,
            eventType: 'profile_rectified',
            payload: {
              has_email_update: Boolean(nextEmail),
              has_display_name_update: Boolean(nextDisplayName),
            },
          });

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: account.id,
            eventType: 'dsr_profile_rectified',
            payload: {
              request_id: requestId,
              result: 'success',
            },
          });

          return jsonResponse(200, {
            status: 'ok',
            requestId,
          });
        });
      } catch (error) {
        logger.error('DSR profile correction failed', {
          operation: 'profile_correction',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

const performDeletionRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requesterAccountId: string;
    targetAccountId: string;
    payload: Record<string, unknown>;
  }
): Promise<{ requestId: string; status: string }> => {
  const hasLegalHold = await isLegalHoldActive(client, {
    instanceId: input.instanceId,
    accountId: input.targetAccountId,
  });

  if (hasLegalHold) {
    const blockedRequestId = await createDsrRequest(client, {
      instanceId: input.instanceId,
      requestType: 'deletion',
      status: 'blocked_legal_hold',
      requesterAccountId: input.requesterAccountId,
      targetAccountId: input.targetAccountId,
      payload: input.payload,
      legalHoldBlocked: true,
      slaDeadlineAt: new Date(Date.now() + DELETE_SLA_HOURS * 60 * 60 * 1000).toISOString(),
    });

    await appendDsrRequestEvent(client, {
      instanceId: input.instanceId,
      requestId: blockedRequestId,
      actorAccountId: input.requesterAccountId,
      eventType: 'deletion_blocked_legal_hold',
      payload: {},
    });

    return {
      requestId: blockedRequestId,
      status: 'blocked_legal_hold',
    };
  }

  const retentionHours = resolveRetentionHours();
  await client.query(
    `
UPDATE iam.accounts
SET
  is_blocked = true,
  soft_deleted_at = NOW(),
  delete_after = NOW() + ($3::int * INTERVAL '1 hour'),
  updated_at = NOW()
WHERE id = $2::uuid;
`,
    [input.instanceId, input.targetAccountId, retentionHours]
  );

  const requestId = await createDsrRequest(client, {
    instanceId: input.instanceId,
    requestType: 'deletion',
    status: 'processing',
    requesterAccountId: input.requesterAccountId,
    targetAccountId: input.targetAccountId,
    payload: {
      ...input.payload,
      retentionHours,
    },
    slaDeadlineAt: new Date(Date.now() + DELETE_SLA_HOURS * 60 * 60 * 1000).toISOString(),
  });

  await appendDsrRequestEvent(client, {
    instanceId: input.instanceId,
    requestId,
    actorAccountId: input.requesterAccountId,
    eventType: 'soft_deleted',
    payload: {
      retentionHours,
      slaHours: DELETE_SLA_HOURS,
    },
  });

  return { requestId, status: 'processing' };
};

const performRestrictionRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requesterAccountId: string;
    targetAccountId: string;
    payload: Record<string, unknown>;
  }
): Promise<{ requestId: string; status: string }> => {
  const reason = readString(input.payload.reason) ?? 'restriction_requested';
  await client.query(
    `
UPDATE iam.accounts
SET
  processing_restricted_at = NOW(),
  processing_restriction_reason = $3,
  updated_at = NOW()
WHERE id = $2::uuid;
`,
    [input.instanceId, input.targetAccountId, reason]
  );

  const requestId = await createDsrRequest(client, {
    instanceId: input.instanceId,
    requestType: 'restriction',
    status: 'completed',
    requesterAccountId: input.requesterAccountId,
    targetAccountId: input.targetAccountId,
    payload: {
      reason,
    },
    completedAt: new Date().toISOString(),
  });

  await ensureArt19RecipientRows(client, { instanceId: input.instanceId, requestId });

  await appendDsrRequestEvent(client, {
    instanceId: input.instanceId,
    requestId,
    actorAccountId: input.requesterAccountId,
    eventType: 'processing_restricted',
    payload: {
      reason,
    },
  });

  return { requestId, status: 'completed' };
};

const performObjectionRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    requesterAccountId: string;
    targetAccountId: string;
    payload: Record<string, unknown>;
  }
): Promise<{ requestId: string; status: string }> => {
  await client.query(
    `
UPDATE iam.accounts
SET
  non_essential_processing_opt_out_at = NOW(),
  updated_at = NOW()
WHERE id = $2::uuid;
`,
    [input.instanceId, input.targetAccountId]
  );

  const requestId = await createDsrRequest(client, {
    instanceId: input.instanceId,
    requestType: 'objection',
    status: 'completed',
    requesterAccountId: input.requesterAccountId,
    targetAccountId: input.targetAccountId,
    payload: input.payload,
    completedAt: new Date().toISOString(),
  });

  await appendDsrRequestEvent(client, {
    instanceId: input.instanceId,
    requestId,
    actorAccountId: input.requesterAccountId,
    eventType: 'non_essential_processing_opt_out',
    payload: input.payload,
  });

  return { requestId, status: 'completed' };
};

export const dataSubjectRequestHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const body = await parseJsonBody(request);
      if (!body) {
        return jsonResponse(400, { error: 'invalid_request' });
      }

      const instanceId = readString(body.instanceId) ?? user.instanceId;
      const requestType = parseDsrRequestType(body.type);
      const payload = readObject(body.payload) ?? {};

      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!requestType) {
        return jsonResponse(400, { error: 'invalid_request_type' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }
      if (requestType === 'rectification') {
        return jsonResponse(400, { error: 'use_profile_correction_endpoint' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const requesterAccountId = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!requesterAccountId) {
            return jsonResponse(404, { error: 'account_not_found' });
          }

          let result: { requestId: string; status: string };

          if (requestType === 'deletion') {
            result = await performDeletionRequest(client, {
              instanceId,
              requesterAccountId,
              targetAccountId: requesterAccountId,
              payload,
            });
          } else if (requestType === 'restriction') {
            result = await performRestrictionRequest(client, {
              instanceId,
              requesterAccountId,
              targetAccountId: requesterAccountId,
              payload,
            });
          } else if (requestType === 'objection') {
            result = await performObjectionRequest(client, {
              instanceId,
              requesterAccountId,
              targetAccountId: requesterAccountId,
              payload,
            });
          } else {
            const requestId = await createDsrRequest(client, {
              instanceId,
              requestType,
              status: 'accepted',
              requesterAccountId,
              targetAccountId: requesterAccountId,
              payload,
            });
            result = { requestId, status: 'accepted' };
          }

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: requesterAccountId,
            eventType: `dsr_${requestType}_requested`,
            payload: {
              request_id: result.requestId,
              status: result.status,
              result: result.status === 'blocked_legal_hold' ? 'failure' : 'success',
            },
          });

          return jsonResponse(200, {
            requestId: result.requestId,
            status: result.status,
          });
        });
      } catch (error) {
        logger.error('DSR self request failed', {
          operation: 'self_request',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const optionalProcessingExecuteHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = resolveInstanceId(request, user.instanceId);
      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const account = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!account) {
            return jsonResponse(404, { error: 'account_not_found' });
          }

          const blockedByRestriction = Boolean(account.processing_restricted_at);
          const blockedByObjection = Boolean(account.non_essential_processing_opt_out_at);
          if (blockedByRestriction || blockedByObjection) {
            return jsonResponse(423, {
              error: 'processing_restricted',
              blockedByRestriction,
              blockedByObjection,
            });
          }

          return jsonResponse(200, {
            status: 'ok',
            executed: true,
          });
        });
      } catch (error) {
        logger.error('Optional processing execution check failed', {
          operation: 'optional_processing_execute',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const legalHoldApplyHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!isAdminRole(user.roles)) {
        return jsonResponse(403, { error: 'forbidden' });
      }

      const body = await parseJsonBody(request);
      if (!body) {
        return jsonResponse(400, { error: 'invalid_request' });
      }

      const instanceId = readString(body.instanceId) ?? user.instanceId;
      const targetSubject = readString(body.targetKeycloakSubject);
      const holdReason = readString(body.holdReason) ?? 'legal_hold';
      const holdUntil = readString(body.holdUntil);

      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!targetSubject) {
        return jsonResponse(400, { error: 'missing_target_keycloak_subject' });
      }
      if (holdUntil && Number.isNaN(Date.parse(holdUntil))) {
        return jsonResponse(400, { error: 'invalid_hold_until' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const target = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: targetSubject,
          });
          if (!target) {
            return jsonResponse(404, { error: 'target_account_not_found' });
          }

          const actor = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });

          const inserted = await client.query<{ id: string }>(
            `
INSERT INTO iam.legal_holds (
  instance_id,
  account_id,
  active,
  hold_reason,
  hold_until,
  created_by_account_id
)
VALUES ($1, $2::uuid, true, $3, $4::timestamptz, $5::uuid)
RETURNING id;
`,
            [instanceId, target.id, holdReason, holdUntil ?? null, actor ?? null]
          );

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: actor,
            eventType: 'dsr_legal_hold_applied',
            payload: {
              target_subject: targetSubject,
              legal_hold_id: inserted.rows[0]!.id,
              hold_until: holdUntil ?? null,
              result: 'success',
            },
          });

          return jsonResponse(200, {
            legalHoldId: inserted.rows[0]!.id,
            status: 'active',
          });
        });
      } catch (error) {
        logger.error('Legal hold apply failed', {
          operation: 'legal_hold_apply',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const legalHoldReleaseHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!isAdminRole(user.roles)) {
        return jsonResponse(403, { error: 'forbidden' });
      }

      const body = await parseJsonBody(request);
      if (!body) {
        return jsonResponse(400, { error: 'invalid_request' });
      }

      const instanceId = readString(body.instanceId) ?? user.instanceId;
      const targetSubject = readString(body.targetKeycloakSubject);
      const releaseReason = readString(body.releaseReason) ?? 'hold_released';

      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!targetSubject) {
        return jsonResponse(400, { error: 'missing_target_keycloak_subject' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const target = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: targetSubject,
          });
          if (!target) {
            return jsonResponse(404, { error: 'target_account_not_found' });
          }

          const actor = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });

          const released = await client.query<{ id: string }>(
            `
UPDATE iam.legal_holds
SET
  active = false,
  lifted_reason = $3,
  lifted_by_account_id = $4::uuid,
  lifted_at = NOW()
WHERE instance_id = $1
  AND account_id = $2::uuid
  AND active = true
RETURNING id;
`,
            [instanceId, target.id, releaseReason, actor ?? null]
          );

          await emitDsrAuditEvent(client, {
            instanceId,
            accountId: actor,
            eventType: 'dsr_legal_hold_released',
            payload: {
              target_subject: targetSubject,
              released_count: released.rowCount,
              result: 'success',
            },
          });

          return jsonResponse(200, {
            releasedCount: released.rowCount,
          });
        });
      } catch (error) {
        logger.error('Legal hold release failed', {
          operation: 'legal_hold_release',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const dataSubjectMaintenanceHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!isAdminRole(user.roles)) {
        return jsonResponse(403, { error: 'forbidden' });
      }

      const body = await parseJsonBody(request);
      if (!body) {
        return jsonResponse(400, { error: 'invalid_request' });
      }

      const instanceId = readString(body.instanceId) ?? user.instanceId;
      const dryRun = readBoolean(body.dryRun) ?? false;
      const limit = readNumber(body.limit);
      void limit;

      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const queuedExports = await processQueuedExportJobs(client, { instanceId, dryRun });
          const escalated = await escalateOverdueDeleteRequests(client, { instanceId, dryRun });
          const finalizedDeletions = await finalizeEligibleDeletions(client, { instanceId, dryRun });
          const recipientNotifications = await processArt19Notifications(client, { instanceId, dryRun });

          await emitDsrAuditEvent(client, {
            instanceId,
            eventType: 'dsr_maintenance_executed',
            payload: {
              dry_run: dryRun,
              queued_exports_processed: queuedExports,
              escalated_requests: escalated,
              finalized_deletions: finalizedDeletions,
              recipient_notifications_processed: recipientNotifications,
              result: 'success',
            },
          });

          return jsonResponse(200, {
            dryRun,
            queuedExports,
            escalated,
            finalizedDeletions,
            recipientNotifications,
          });
        });
      } catch (error) {
        logger.error('DSR maintenance run failed', {
          operation: 'maintenance',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const adminDataExportStatusHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!isAdminRole(user.roles)) {
        return jsonResponse(403, { error: 'forbidden' });
      }

      const url = new URL(request.url);
      const instanceId = resolveInstanceId(request, user.instanceId);
      const jobId = readString(url.searchParams.get('jobId'));
      const downloadFormat = readString(url.searchParams.get('download'))?.toLowerCase() as ExportFormat | undefined;
      if (!instanceId || !isUuid(instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!jobId || !isUuid(jobId)) {
        return jsonResponse(400, { error: 'invalid_job_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceDb(instanceId, async (client) => {
          const result = await client.query<{
            id: string;
            format: ExportFormat;
            status: string;
            error_message: string | null;
            payload_json: Record<string, unknown> | null;
            payload_csv: string | null;
            payload_xml: string | null;
            created_at: string;
            completed_at: string | null;
          }>(
            `
SELECT id, format, status, error_message, payload_json, payload_csv, payload_xml, created_at, completed_at
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
            [instanceId, jobId]
          );

          if (result.rowCount <= 0) {
            return jsonResponse(404, { error: 'export_job_not_found' });
          }

          const job = result.rows[0]!;
          if (job.status === 'completed' && downloadFormat && EXPORT_FORMATS.has(downloadFormat)) {
            if (downloadFormat === 'json') {
              return textResponse(200, JSON.stringify(job.payload_json ?? {}, null, 2), 'application/json');
            }
            if (downloadFormat === 'csv') {
              return textResponse(200, job.payload_csv ?? '', 'text/csv; charset=utf-8');
            }
            return textResponse(200, job.payload_xml ?? '', 'application/xml; charset=utf-8');
          }

          return jsonResponse(200, {
            id: job.id,
            format: job.format,
            status: job.status,
            createdAt: job.created_at,
            completedAt: job.completed_at,
            errorMessage: job.error_message,
          });
        });
      } catch (error) {
        logger.error('DSR admin export status lookup failed', {
          operation: 'admin_data_export_status',
          error: error instanceof Error ? error.message : String(error),
          ...buildLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};
