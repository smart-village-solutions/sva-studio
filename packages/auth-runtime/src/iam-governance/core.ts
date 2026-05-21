import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import {
  createSelfServicePermissionChangeRequest,
  listGovernanceCases,
  MAX_SELF_SERVICE_PERMISSION_CHANGE_REQUEST_NOTE_LENGTH,
} from '@sva/iam-governance';
import {
  createGovernanceWorkflowExecutor,
  type GovernanceActor,
} from '@sva/iam-governance/governance-workflow-executor';
import { buildGovernanceComplianceExport } from '@sva/iam-governance/governance-compliance-export';
import {
  governanceComplianceExportRoles,
  governanceReadRoles,
  governanceWorkflowRoles,
  hasRequiredGovernanceRole,
  readGovernanceCaseType,
  requiresPrivilegedGovernanceWorkflowRole,
} from '@sva/iam-governance/governance-workflow-policy';

import { withAuthenticatedUser } from '../middleware.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { createPoolResolver, jsonResponse, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { buildLogContext } from '../log-context.js';
import { governanceRequestSchema, type GovernanceRequestInput } from '../shared/schemas.js';
import { asApiList, createApiError, readPage } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';

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
  } catch (error) {
    logger.warn('Governance workflow request body could not be parsed', {
      reason_code: 'invalid_json',
      request_id: getWorkspaceContext().requestId,
      trace_id: getWorkspaceContext().traceId,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
    });
    return null;
  }

  const parsed = governanceRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

type SelfServicePermissionChangeBodyParseResult =
  | { ok: true; value: { requestNote: string } }
  | { ok: false; error: 'invalid_request' | 'request_note_too_long' };

const parseSelfServicePermissionChangeBody = async (
  request: Request
): Promise<SelfServicePermissionChangeBodyParseResult> => {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return { ok: false, error: 'invalid_request' };
    }

    const requestNote = readString((body as { requestNote?: unknown }).requestNote)?.trim();
    if (!requestNote) {
      return { ok: false, error: 'invalid_request' };
    }
    if (requestNote.length > MAX_SELF_SERVICE_PERMISSION_CHANGE_REQUEST_NOTE_LENGTH) {
      return { ok: false, error: 'request_note_too_long' };
    }

    return { ok: true, value: { requestNote } };
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
};

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);

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
        const exportResult = await withInstanceScopedDb(instanceId, async (client) =>
          buildGovernanceComplianceExport(client, { instanceId, format, from, to })
        );

        if (exportResult.format === 'csv') {
          return new Response(exportResult.body, {
            status: 200,
            headers: {
              'Content-Type': exportResult.contentType,
            },
          });
        }

        return jsonResponse(200, exportResult.body);
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

export const permissionChangeSelfServiceRequestHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfError) {
        return csrfError;
      }

      const parsed = await parseSelfServicePermissionChangeBody(request);
      if (!parsed.ok) {
        return jsonResponse(400, { error: parsed.error });
      }

      if (!user.instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }

      try {
        const result = await withInstanceScopedDb(user.instanceId, (client) =>
          createSelfServicePermissionChangeRequest(client, {
            instanceId: user.instanceId as string,
            actorKeycloakSubject: user.id,
            requestNote: parsed.value.requestNote,
            requestId: getWorkspaceContext().requestId,
            traceId: getWorkspaceContext().traceId,
          })
        );

        if (!result) {
          return jsonResponse(403, { error: 'forbidden' });
        }

        logger.info('Governance self-service permission change request created', {
          operation: 'permission_change_request',
          workflow_id: result.workflowId,
          request_origin: 'self_service',
          ...buildGovernanceLogContext(user.instanceId),
        });

        return jsonResponse(202, {
          operation: 'request_permission_change',
          status: 'accepted',
          workflowId: result.workflowId,
        });
      } catch (error) {
        logger.error('Governance self-service permission change request failed', {
          operation: 'permission_change_request',
          error: error instanceof Error ? error.message : String(error),
          request_origin: 'self_service',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};
