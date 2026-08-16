import { createHash } from 'node:crypto';
import { getWorkspaceContext } from '@sva/server-runtime';

import { resolveActorInfo } from '../iam-account-management/shared.js';
import { authorizeInstancePermissionForUser, toInstancePermissionApiErrorCode } from '../instance-permission-authorization.js';
import { withAuthenticatedUser } from '../middleware.js';
import { readPluginOperationArtifact } from '../plugin-operation-artifacts.server.js';
import { isUuid } from '../shared/input-readers.js';
import { createApiError, readPathSegment } from '../shared/request-helpers.js';
import { requireActorInstanceId, requireMonitoringAccess } from './core.monitoring.js';
import { withStudioJobRepository } from './repository.js';

const MONITORING_READ_ACTION = 'iam.monitoring.read';
const getRequestId = (): string | undefined => getWorkspaceContext().requestId;
const safeArtifactFileName = (value: string): string =>
  value.replaceAll(/[^A-Za-z0-9._-]/g, '_').slice(0, 160) || 'export.bin';

const readArtifactIds = (request: Request): { jobId: string; artifactId: string } | Response => {
  const jobId = readPathSegment(request, 4);
  const artifactId = readPathSegment(request, 6);
  return jobId && isUuid(jobId) && artifactId && isUuid(artifactId)
    ? { jobId, artifactId }
    : createApiError(400, 'invalid_request', 'Job- oder Artefakt-ID ist ungültig.', getRequestId());
};

export const downloadPluginOperationArtifactHandler = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const instanceId = requireActorInstanceId(ctx.user.instanceId);
    if (instanceId instanceof Response) return instanceId;
    const ids = readArtifactIds(request);
    if (ids instanceof Response) return ids;

    const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
    if ('error' in actorResolution) return actorResolution.error;
    try {
      const job = await withStudioJobRepository(instanceId, (repository) =>
        repository.getJobDetail(instanceId, ids.jobId)
      );
      if (!job || job.status !== 'succeeded') {
        return createApiError(404, 'not_found', 'Exportartefakt wurde nicht gefunden.', getRequestId());
      }
      if (!actorResolution.actor.actorAccountId || job.actorAccountId !== actorResolution.actor.actorAccountId) {
        return createApiError(403, 'forbidden', 'Exportartefakt gehört einem anderen Akteur.', getRequestId());
      }
      if (job.pluginId === 'waste-management') {
        const authorization = await authorizeInstancePermissionForUser({ ctx, action: 'waste-management.export.execute' });
        if (!authorization.ok) {
          return createApiError(authorization.status, toInstancePermissionApiErrorCode(authorization.error), 'Keine Berechtigung zum Herunterladen des Waste-Exports.', getRequestId(), authorization.permissionDenial);
        }
      } else {
        const monitoringError = await requireMonitoringAccess(ctx, MONITORING_READ_ACTION);
        if (monitoringError) return monitoringError;
      }
      const artifact = job.resultPayload?.artifacts?.find((entry) => entry.artifactId === ids.artifactId);
      const expiresAt = artifact ? Date.parse(artifact.expiresAt) : Number.NaN;
      if (!artifact || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return createApiError(404, 'not_found', 'Exportartefakt ist nicht mehr verfügbar.', getRequestId());
      }
      const stored = await readPluginOperationArtifact({ instanceId, artifactId: ids.artifactId });
      const checksum = createHash('sha256').update(stored.body).digest('hex');
      if (checksum !== artifact.sha256 || stored.body.byteLength !== artifact.sizeBytes) {
        return createApiError(409, 'conflict', 'Exportartefakt ist beschädigt.', getRequestId());
      }
      return new Response(stored.body as BodyInit, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="${safeArtifactFileName(artifact.fileName)}"`,
          'Content-Type': artifact.contentType,
        },
      });
    } catch {
      return createApiError(503, 'database_unavailable', 'Exportartefakt konnte nicht geladen werden.', getRequestId());
    }
  });
