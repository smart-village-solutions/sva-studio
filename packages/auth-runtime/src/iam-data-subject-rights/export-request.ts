import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import { createDsrExportFlows } from '@sva/iam-governance/dsr-export-flows';
import type { DsrExportFormat as ExportFormat } from '@sva/iam-governance/dsr-export-payload';
import { createAndQueueDsrExportStudioJob } from './export-worker.js';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse, textResponse } from '../db.js';
import { readBoolean, readString } from '../shared/input-readers.js';
import { requireIdempotencyKey, toPayloadHash } from '../iam-account-management/api-helpers.js';
import { completeIdempotency, reserveIdempotency } from '../iam-account-management/shared.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import {
  DSR_EXPORT_ACTION,
  authorizeDsrJsonAction,
  handleJsonDatabaseError,
  parseJsonBody,
  resolveJsonScopedInstance,
  withInstanceScopedDb,
} from './shared.js';

export const isExportFormat = (value: string | undefined): value is ExportFormat =>
  value === 'json' || value === 'csv' || value === 'xml';
const dsrExportFlows = createDsrExportFlows({
  reserveIdempotency,
  completeIdempotency,
  toPayloadHash,
  createAsyncStudioJob: createAndQueueDsrExportStudioJob,
  jsonResponse,
  textResponse,
});
type ExportRequestInput = {
  instanceId?: string;
  format: ExportFormat;
  async: boolean;
};

type AdminExportRequestInput = ExportRequestInput & {
  targetKeycloakSubject: string;
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

      const instanceScope = resolveJsonScopedInstance({
        bodyInstanceId: exportRequest.instanceId,
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;

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
        return handleJsonDatabaseError('DSR self export failed', 'data_export', instanceId, error);
      }
    });
  });
};
export const adminDataExportHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await authorizeDsrJsonAction(ctx, DSR_EXPORT_ACTION);
      if (authorizationError) {
        return authorizationError;
      }
      const { user } = ctx;

      const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfError) {
        return csrfError;
      }

      const exportRequestResult = await parseAdminExportRequestBody(request);
      if (!exportRequestResult.ok) {
        return jsonResponse(400, { error: exportRequestResult.error });
      }
      const exportRequest = exportRequestResult.data;

      const instanceScope = resolveJsonScopedInstance({
        bodyInstanceId: exportRequest.instanceId,
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;

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
        return handleJsonDatabaseError(
          'DSR admin export failed',
          'admin_data_export',
          instanceId,
          error
        );
      }
    });
  });
};
