import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import type { IamDsrCanonicalStatus, IamDsrCaseListItem } from '@sva/core';
import { encryptFieldValue, parseFieldEncryptionConfigFromEnv } from '@sva/core/security';
import { createDsrExportFlows } from '@sva/iam-governance/dsr-export-flows';
import { createDsrExportStatusHandlers } from '@sva/iam-governance/dsr-export-status';
import type { DsrExportAccountSnapshot as AccountSnapshot, DsrExportFormat as ExportFormat } from '@sva/iam-governance/dsr-export-payload';
import { runDsrMaintenance } from '@sva/iam-governance/dsr-maintenance';

import { withAuthenticatedUser } from '../middleware.server.js';
import { getIamDatabaseUrl } from '../runtime-secrets.server.js';
import {
  createPoolResolver,
  jsonResponse,
  textResponse,
  type QueryClient,
  withInstanceDb as withScopedDbTransaction,
} from '../shared/db-helpers.js';
import { isUuid, readBoolean, readNumber, readObject, readString } from '../shared/input-readers.js';
import { buildLogContext } from '../shared/log-context.js';
import { dataSubjectRightsRequestSchema } from '../shared/schemas.js';
import { asApiItem, asApiList, createApiError, readPage, requireIdempotencyKey, toPayloadHash } from '../iam-account-management/api-helpers.js';
import { completeIdempotency, reserveIdempotency } from '../iam-account-management/shared.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { listAdminDsrCases, loadDsrSelfServiceOverview } from './read-models.js';
import { DsrAccountSnapshotNotFoundError } from './read-models.self-service-queries.js';

const logger = createSdkLogger({ component: 'iam-dsr', level: 'info' });
const isExportFormat = (value: string | undefined): value is ExportFormat =>
  value === 'json' || value === 'csv' || value === 'xml';
const dsrExportFlows = createDsrExportFlows({
  reserveIdempotency,
  completeIdempotency,
  toPayloadHash,
  jsonResponse,
  textResponse,
});
const dsrExportStatusHandlers = createDsrExportStatusHandlers({
  jsonResponse,
  textResponse,
  isExportFormat,
});

const ADMIN_ROLES = new Set(['iam_admin', 'support_admin', 'system_admin']);
const ART19_RECIPIENT_CLASSES = ['internal_processor', 'downstream_export', 'analytics_sink'] as const;
const DELETE_SLA_HOURS = 48;
const DEFAULT_DELETE_RETENTION_HOURS = 24;

type DsrRequestType = 'access' | 'deletion' | 'rectification' | 'restriction' | 'objection';

const resolvePool = createPoolResolver(getIamDatabaseUrl);
const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withScopedDbTransaction(resolvePool, instanceId, work);
const buildDsrLogContext = (instanceId?: string) =>
  buildLogContext(instanceId, { includeTraceId: true });

type ExportRequestInput = {
  instanceId?: string;
  format: ExportFormat;
  async: boolean;
};

type AdminExportRequestInput = ExportRequestInput & {
  targetKeycloakSubject: string;
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

const parseExportFormat = (value: unknown): ExportFormat | null => {
  const format = (readString(value) ?? 'json').toLowerCase();
  if (!isExportFormat(format)) {
    return null;
  }
  return format;
};

const parseAsyncMode = (value: unknown): boolean => {
  const booleanValue = readBoolean(value);
  if (typeof booleanValue === 'boolean') {
    return booleanValue;
  }
  const normalizedValue = readString(value)?.toLowerCase();
  if (!normalizedValue) {
    return false;
  }
  return normalizedValue === '1' || normalizedValue === 'true';
};

const parseExportRequestBody = async (
  request: Request
): Promise<{ ok: true; data: ExportRequestInput } | { ok: false; error: string }> => {
  const body = await parseJsonBody(request);
  if (!body) {
    return { ok: false, error: 'invalid_request' };
  }

  const format = parseExportFormat(body.format);
  if (!format) {
    return { ok: false, error: 'invalid_export_format' };
  }

  return {
    ok: true,
    data: {
      instanceId: readString(body.instanceId) ?? undefined,
      format,
      async: parseAsyncMode(body.async),
    },
  };
};

const parseAdminExportRequestBody = async (
  request: Request
): Promise<{ ok: true; data: AdminExportRequestInput } | { ok: false; error: string }> => {
  const body = await parseJsonBody(request);
  if (!body) {
    return { ok: false, error: 'invalid_request' };
  }

  const format = parseExportFormat(body.format);
  const targetKeycloakSubject = readString(body.targetKeycloakSubject);
  if (!targetKeycloakSubject) {
    return { ok: false, error: 'missing_target_keycloak_subject' };
  }
  if (!format) {
    return { ok: false, error: 'invalid_export_format' };
  }

  return {
    ok: true,
    data: {
      instanceId: readString(body.instanceId) ?? undefined,
      targetKeycloakSubject,
      format,
      async: parseAsyncMode(body.async),
    },
  };
};

const resolveInstanceId = (input: { bodyInstanceId?: string; request: Request; fallback?: string }): string | undefined => {
  const fromQuery = readString(new URL(input.request.url).searchParams.get('instanceId'));
  return input.bodyInstanceId ?? fromQuery ?? input.fallback;
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
  const parsed = dataSubjectRightsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
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
      const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfError) {
        return csrfError;
      }

      const exportRequestResult = await parseExportRequestBody(request);
      if (!exportRequestResult.ok) {
        return jsonResponse(400, { error: exportRequestResult.error });
      }
      const exportRequest = exportRequestResult.data;

      const instanceId = resolveInstanceId({
        bodyInstanceId: exportRequest.instanceId,
        request,
        fallback: user.instanceId,
      });
      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      const idempotencyKey = requireIdempotencyKey(request, getWorkspaceContext().requestId);
      if ('error' in idempotencyKey) {
        return idempotencyKey.error;
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          return dsrExportFlows.runSelfExport({
            client,
            instanceId,
            keycloakSubject: user.id,
            exportRequest,
            idempotencyKey: idempotencyKey.key,
          });
        });
      } catch (error) {
        logger.error('DSR self export failed', {
          operation: 'data_export',
          error: error instanceof Error ? error.message : String(error),
          ...buildDsrLogContext(instanceId),
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
      const instanceId = resolveInstanceId({ request, fallback: user.instanceId });
      const jobId = readString(url.searchParams.get('jobId'));
      const downloadFormat = readString(url.searchParams.get('download'))?.toLowerCase();
      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!jobId || !isUuid(jobId)) {
        return jsonResponse(400, { error: 'invalid_job_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          return dsrExportStatusHandlers.getSelfExportStatus({
            client,
            instanceId,
            keycloakSubject: user.id,
            jobId,
            downloadFormat,
          });
        });
      } catch (error) {
        logger.error('DSR export status lookup failed', {
          operation: 'data_export_status',
          error: error instanceof Error ? error.message : String(error),
          ...buildDsrLogContext(instanceId),
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

      const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfError) {
        return csrfError;
      }

      const exportRequestResult = await parseAdminExportRequestBody(request);
      if (!exportRequestResult.ok) {
        return jsonResponse(400, { error: exportRequestResult.error });
      }
      const exportRequest = exportRequestResult.data;

      const instanceId = resolveInstanceId({
        bodyInstanceId: exportRequest.instanceId,
        request,
        fallback: user.instanceId,
      });

      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      const idempotencyKey = requireIdempotencyKey(request, getWorkspaceContext().requestId);
      if ('error' in idempotencyKey) {
        return idempotencyKey.error;
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          return dsrExportFlows.runAdminExport({
            client,
            instanceId,
            actorKeycloakSubject: user.id,
            exportRequest,
            idempotencyKey: idempotencyKey.key,
          });
        });
      } catch (error) {
        logger.error('DSR admin export failed', {
          operation: 'admin_data_export',
          error: error instanceof Error ? error.message : String(error),
          ...buildDsrLogContext(instanceId),
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
      if (!instanceId) {
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
        return await withInstanceScopedDb(instanceId, async (client) => {
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
          ...buildDsrLogContext(instanceId),
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

      if (!instanceId) {
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
        return await withInstanceScopedDb(instanceId, async (client) => {
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
          ...buildDsrLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const getMyDataSubjectRightsHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = resolveInstanceId({ request, fallback: user.instanceId });
      if (!instanceId) {
        return createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getWorkspaceContext().requestId);
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return createApiError(403, 'forbidden', 'Instanzkontext unzulässig.', getWorkspaceContext().requestId);
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const requesterAccountId = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!requesterAccountId) {
            return createApiError(404, 'not_found', 'Konto nicht gefunden.', getWorkspaceContext().requestId);
          }

          const overview = await loadDsrSelfServiceOverview(client, {
            instanceId,
            accountId: requesterAccountId,
          });
          return jsonResponse(200, asApiItem(overview, getWorkspaceContext().requestId));
        });
      } catch (error) {
        if (error instanceof DsrAccountSnapshotNotFoundError) {
          return createApiError(404, 'not_found', 'Konto nicht gefunden.', getWorkspaceContext().requestId);
        }
        logger.error('DSR self overview failed', {
          operation: 'self_overview',
          error: error instanceof Error ? error.message : String(error),
          ...buildDsrLogContext(instanceId),
        });
        return createApiError(503, 'database_unavailable', 'DSR-Daten konnten nicht geladen werden.', getWorkspaceContext().requestId);
      }
    });
  });
};

export const optionalProcessingExecuteHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = resolveInstanceId({ request, fallback: user.instanceId });
      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
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
          ...buildDsrLogContext(instanceId),
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

      if (!instanceId) {
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
        return await withInstanceScopedDb(instanceId, async (client) => {
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
          ...buildDsrLogContext(instanceId),
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

      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!targetSubject) {
        return jsonResponse(400, { error: 'missing_target_keycloak_subject' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
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
          ...buildDsrLogContext(instanceId),
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

      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const result = await runDsrMaintenance(client, { instanceId, dryRun });
          return jsonResponse(200, result);
        });
      } catch (error) {
        logger.error('DSR maintenance run failed', {
          operation: 'maintenance',
          error: error instanceof Error ? error.message : String(error),
          ...buildDsrLogContext(instanceId),
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
      const instanceId = resolveInstanceId({ request, fallback: user.instanceId });
      const jobId = readString(url.searchParams.get('jobId'));
      const downloadFormat = readString(url.searchParams.get('download'))?.toLowerCase();
      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (!jobId || !isUuid(jobId)) {
        return jsonResponse(400, { error: 'invalid_job_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          return dsrExportStatusHandlers.getAdminExportStatus({
            client,
            instanceId,
            jobId,
            downloadFormat,
          });
        });
      } catch (error) {
        logger.error('DSR admin export status lookup failed', {
          operation: 'admin_data_export_status',
          error: error instanceof Error ? error.message : String(error),
          ...buildDsrLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const listAdminDataSubjectRightsCasesHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!isAdminRole(user.roles)) {
        return createApiError(403, 'forbidden', 'Keine Berechtigung für DSR-Transparenz.', getWorkspaceContext().requestId);
      }

      const url = new URL(request.url);
      const instanceId = resolveInstanceId({ request, fallback: user.instanceId });
      const type = readString(url.searchParams.get('type')) as IamDsrCaseListItem['type'] | undefined;
      const status = readString(url.searchParams.get('status')) as IamDsrCanonicalStatus | undefined;
      const search = readString(url.searchParams.get('search'));
      const { page, pageSize } = readPage(request);

      if (!instanceId) {
        return createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getWorkspaceContext().requestId);
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return createApiError(403, 'forbidden', 'Instanzkontext unzulässig.', getWorkspaceContext().requestId);
      }

      try {
        const result = await withInstanceScopedDb(instanceId, (client) =>
          listAdminDsrCases(client, {
            instanceId,
            page,
            pageSize,
            search: search ?? undefined,
            type,
            status,
          })
        );
        return jsonResponse(200, asApiList(result.items, { page, pageSize, total: result.total }, getWorkspaceContext().requestId));
      } catch (error) {
        logger.error('DSR admin case list failed', {
          operation: 'admin_case_list',
          error: error instanceof Error ? error.message : String(error),
          ...buildDsrLogContext(instanceId),
        });
        return createApiError(503, 'database_unavailable', 'DSR-Fälle konnten nicht geladen werden.', getWorkspaceContext().requestId);
      }
    });
  });
};
