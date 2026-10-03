import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import { createDsrExportStatusHandlers } from '@sva/iam-governance/dsr-export-status';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse, textResponse } from '../db.js';
import { isUuid, readString } from '../shared/input-readers.js';
import {
  DSR_EXPORT_ACTION,
  authorizeDsrJsonAction,
  handleJsonDatabaseError,
  jsonError,
  resolveJsonScopedInstance,
  withInstanceScopedDb,
} from './shared.js';
import { isExportFormat } from './export-request.js';

const dsrExportStatusHandlers = createDsrExportStatusHandlers({
  jsonResponse,
  textResponse,
  isExportFormat,
});
export const dataExportStatusHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const url = new URL(request.url);
      const instanceScope = resolveJsonScopedInstance({
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      const jobId = readString(url.searchParams.get('jobId'));
      const downloadFormat = readString(url.searchParams.get('download'))?.toLowerCase();
      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;
      if (!jobId || !isUuid(jobId)) {
        return jsonError(400, 'invalid_job_id');
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
        return handleJsonDatabaseError(
          'DSR export status lookup failed',
          'data_export_status',
          instanceId,
          error
        );
      }
    });
  });
};
export const adminDataExportStatusHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await authorizeDsrJsonAction(ctx, DSR_EXPORT_ACTION);
      if (authorizationError) {
        return authorizationError;
      }
      const { user } = ctx;

      const url = new URL(request.url);
      const instanceScope = resolveJsonScopedInstance({
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      const jobId = readString(url.searchParams.get('jobId'));
      const downloadFormat = readString(url.searchParams.get('download'))?.toLowerCase();
      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;
      if (!jobId || !isUuid(jobId)) {
        return jsonError(400, 'invalid_job_id');
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
        return handleJsonDatabaseError(
          'DSR admin export status lookup failed',
          'admin_data_export_status',
          instanceId,
          error
        );
      }
    });
  });
};
