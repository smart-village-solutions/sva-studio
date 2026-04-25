import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import {
  createGovernanceWorkflowExecutor,
  type GovernanceActor,
} from '@sva/iam-governance/governance-workflow-executor';
import {
  governanceComplianceExportRoles,
  governanceReadRoles,
  governanceWorkflowRoles,
  hasRequiredGovernanceRole,
  readGovernanceCaseType,
  requiresPrivilegedGovernanceWorkflowRole,
} from '@sva/iam-governance/governance-workflow-policy';

import { withAuthenticatedUser } from '../middleware.server.js';
import { getIamDatabaseUrl } from '../runtime-secrets.server.js';
import { createPoolResolver, jsonResponse, type QueryClient, withInstanceDb } from '../shared/db-helpers.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { buildLogContext } from '../shared/log-context.js';
import { governanceRequestSchema, type GovernanceRequestInput } from '../shared/schemas.js';
import { asApiList, createApiError, readPage } from '../iam-account-management/api-helpers.js';
import { listGovernanceCases } from './read-models.js';

const logger = createSdkLogger({ component: 'iam-governance', level: 'info' });

type GovernanceWorkflowRequest = GovernanceRequestInput;

const resolvePool = createPoolResolver(getIamDatabaseUrl);

const buildGovernanceLogContext = (instanceId?: string) =>
  buildLogContext(instanceId, { includeTraceId: true });
const governanceWorkflowExecutor = createGovernanceWorkflowExecutor({
  isUuid,
  logInfo: (message, fields) => logger.info(message, fields),
  logWarn: (message, fields) => logger.warn(message, fields),
  buildLogContext: buildGovernanceLogContext,
});

const parseWorkflowRequest = async (request: Request): Promise<GovernanceWorkflowRequest | null> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  const parsed = governanceRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withInstanceDb(resolvePool, instanceId, work);

const csvEscape = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return '';
  }
  const raw = String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

type ComplianceRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  request_id: string | null;
  trace_id: string | null;
  created_at: string;
};

const loadComplianceRows = async (
  client: QueryClient,
  input: { instanceId: string; from?: string; to?: string }
): Promise<ComplianceRow[]> => {
  const rows = await client.query<ComplianceRow>(
    `
SELECT
  id,
  event_type,
  payload,
  request_id,
  trace_id,
  created_at
FROM iam.activity_logs
WHERE instance_id = $1
  AND event_type LIKE 'governance_%'
  AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
  AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)
ORDER BY created_at ASC;
`,
    [input.instanceId, input.from ?? null, input.to ?? null]
  );

  return rows.rows;
};

const toExportRows = (rows: readonly ComplianceRow[]) =>
  rows.map((row) => {
    const payload = row.payload ?? {};
    const payloadRecord = typeof payload === 'object' && payload !== null ? payload : {};
    return {
      event_id: readString(payloadRecord.event_id) ?? row.id,
      timestamp: readString(payloadRecord.timestamp) ?? row.created_at,
      instance_id: readString(payloadRecord.instance_id),
      action: readString(payloadRecord.action),
      result: readString(payloadRecord.result),
      actor_pseudonym: readString(payloadRecord.actor_pseudonym),
      target_ref: readString(payloadRecord.target_ref),
      reason_code: readString(payloadRecord.reason_code),
      request_id: readString(payloadRecord.request_id) ?? row.request_id ?? undefined,
      trace_id: readString(payloadRecord.trace_id) ?? row.trace_id ?? undefined,
      event_type: row.event_type,
    };
  });

export const governanceWorkflowHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const parsed = await parseWorkflowRequest(request);
      if (!parsed) {
        return jsonResponse(400, { error: 'invalid_request' });
      }
      if (!readString(parsed.instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== parsed.instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }
      if (
        requiresPrivilegedGovernanceWorkflowRole(parsed.operation) &&
        !hasRequiredGovernanceRole(user.roles, governanceWorkflowRoles)
      ) {
        logger.warn('Governance workflow denied due to missing role', {
          operation: parsed.operation,
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(403, { error: 'forbidden' });
      }

      const actor: GovernanceActor = {
        keycloakSubject: user.id,
        instanceId: parsed.instanceId,
        roles: user.roles,
        requestId: getWorkspaceContext().requestId,
        traceId: getWorkspaceContext().traceId,
      };

      try {
        const result = await withInstanceScopedDb(parsed.instanceId, async (client) => {
          return governanceWorkflowExecutor.executeWorkflow(client, actor, parsed);
        });
        if (result.status === 'error') {
          logger.error('Governance workflow rejected', {
            operation: parsed.operation,
            reason_code: result.reasonCode,
            ...buildGovernanceLogContext(parsed.instanceId),
          });
          return jsonResponse(400, result);
        }
        logger.info('Governance workflow completed', {
          operation: parsed.operation,
          workflow_id: result.workflowId,
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(200, result);
      } catch (error) {
        logger.error('Governance workflow failed', {
          operation: parsed.operation,
          error: error instanceof Error ? error.message : String(error),
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const listGovernanceCasesHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!hasRequiredGovernanceRole(user.roles, governanceReadRoles)) {
        logger.warn('Governance read denied due to missing role', {
          operation: 'list_governance_cases',
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return createApiError(403, 'forbidden', 'Keine Berechtigung für Governance-Transparenz.', getWorkspaceContext().requestId);
      }

      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const type = readGovernanceCaseType(readString(url.searchParams.get('type')));
      const status = readString(url.searchParams.get('status'));
      const search = readString(url.searchParams.get('search'));
      const { page, pageSize } = readPage(request);

      if (!instanceId) {
        return createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getWorkspaceContext().requestId);
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return createApiError(403, 'forbidden', 'Instanzkontext unzulässig.', getWorkspaceContext().requestId);
      }
      if (type === null) {
        return createApiError(400, 'invalid_request', 'Ungültiger Governance-Typfilter.', getWorkspaceContext().requestId);
      }

      try {
        const result = await withInstanceScopedDb(instanceId, (client) =>
          listGovernanceCases(client, {
            instanceId,
            type,
            status: status ?? undefined,
            search: search ?? undefined,
            page,
            pageSize,
          })
        );
        return jsonResponse(200, asApiList(result.items, { page, pageSize, total: result.total }, getWorkspaceContext().requestId));
      } catch (error) {
        logger.error('Governance read failed', {
          operation: 'list_governance_cases',
          error: error instanceof Error ? error.message : String(error),
          ...buildGovernanceLogContext(instanceId),
        });
        return createApiError(503, 'database_unavailable', 'Governance-Datenbankabfrage fehlgeschlagen.', getWorkspaceContext().requestId);
      }
    });
  });
};

export const governanceComplianceExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!hasRequiredGovernanceRole(user.roles, governanceComplianceExportRoles)) {
        logger.warn('Governance compliance export denied due to missing role', {
          operation: 'compliance_export',
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return jsonResponse(403, { error: 'forbidden' });
      }

      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const format = (readString(url.searchParams.get('format')) ?? 'json').toLowerCase();
      const from = readString(url.searchParams.get('from'));
      const to = readString(url.searchParams.get('to'));

      if (!instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }

      try {
        const exportRows = await withInstanceScopedDb(instanceId, async (client) => {
          const rows = await loadComplianceRows(client, { instanceId, from, to });
          return toExportRows(rows);
        });

        if (format === 'csv') {
          const header = [
            'event_id',
            'timestamp',
            'instance_id',
            'action',
            'result',
            'actor_pseudonym',
            'target_ref',
            'reason_code',
            'request_id',
            'trace_id',
            'event_type',
          ];
          const lines = [header.join(',')];
          for (const row of exportRows) {
            lines.push(
              [
                row.event_id,
                row.timestamp,
                row.instance_id,
                row.action,
                row.result,
                row.actor_pseudonym,
                row.target_ref,
                row.reason_code,
                row.request_id,
                row.trace_id,
                row.event_type,
              ]
                .map(csvEscape)
                .join(',')
            );
          }
          return new Response(lines.join('\n'), {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
            },
          });
        }

        if (format === 'siem') {
          const siem = exportRows.map((row) => ({
            '@timestamp': row.timestamp,
            event_id: row.event_id,
            instance_id: row.instance_id,
            action: row.action,
            result: row.result,
            actor_pseudonym: row.actor_pseudonym,
            target_ref: row.target_ref,
            reason_code: row.reason_code,
            request_id: row.request_id,
            trace_id: row.trace_id,
            event_type: row.event_type,
          }));
          return jsonResponse(200, { format: 'siem', rows: siem });
        }

        return jsonResponse(200, { format: 'json', rows: exportRows });
      } catch (error) {
        logger.error('Governance compliance export failed', {
          operation: 'compliance_export',
          error: error instanceof Error ? error.message : String(error),
          format,
          ...buildGovernanceLogContext(instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};

export const resolveImpersonationSubject = async (input: {
  instanceId: string;
  actorKeycloakSubject: string;
  targetKeycloakSubject: string;
}): Promise<{ ok: true } | { ok: false; reasonCode: string }> => {
  return governanceWorkflowExecutor.resolveImpersonationSubject({
    ...input,
    withInstanceScopedDb,
  });
};
