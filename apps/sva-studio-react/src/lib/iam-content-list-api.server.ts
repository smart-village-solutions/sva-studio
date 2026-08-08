import {
  authorizeInstancePermissionForUser,
  ensureFeature,
  getFeatureFlags,
  loadMainserverAuthoringDiagnostics,
  withAuthenticatedUser,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { createListErrorResponse, readContentListQuery } from './iam-content-list-api.shared.js';
import {
  listProjectedContents,
  refreshProjectedContents,
} from './iam-content-list-projection.server.js';

const logger = createSdkLogger({ component: 'iam-content-list-api' });

const handleMainserverAuthoringDiagnostics = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const featureCheck = ensureFeature(
      getFeatureFlags(),
      'iam_admin',
      getWorkspaceContext().requestId
    );
    if (featureCheck) {
      return featureCheck;
    }

    const authorization = await authorizeInstancePermissionForUser({
      ctx,
      action: 'iam.monitoring.read',
    });
    if (!authorization.ok) {
      const code =
        authorization.error === 'missing_instance'
          ? 'invalid_instance_id'
          : authorization.error === 'invalid_action'
            ? 'invalid_request'
            : authorization.error;
      return createListErrorResponse(
        authorization.status,
        code,
        authorization.message,
        getWorkspaceContext().requestId
      );
    }

    try {
      const data = await loadMainserverAuthoringDiagnostics(authorization.actor.instanceId);
      return Response.json({ data });
    } catch (error) {
      logger.error('Failed to load Mainserver authoring diagnostics', {
        request_id: getWorkspaceContext().requestId ?? null,
        instance_id: authorization.actor.instanceId,
        route: '/api/v1/iam/contents/mainserver-diagnostics',
        error_message: error instanceof Error ? error.message : String(error),
      });
      return createListErrorResponse(
        503,
        'database_unavailable',
        'Mainserver-Autorendiagnose konnte nicht geladen werden.',
        getWorkspaceContext().requestId
      );
    }
  });

const handleProjectedContentList = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const featureCheck = ensureFeature(
      getFeatureFlags(),
      'iam_admin',
      getWorkspaceContext().requestId
    );
    if (featureCheck) {
      return featureCheck;
    }

    try {
      return await listProjectedContents(ctx, readContentListQuery(request));
    } catch (error) {
      logger.error('Failed to load aggregated content list', {
        request_id: getWorkspaceContext().requestId ?? null,
        instance_id: ctx.user.instanceId ?? null,
        route: '/api/v1/iam/contents',
        error_message: error instanceof Error ? error.message : String(error),
      });
      return createListErrorResponse(
        503,
        'database_unavailable',
        'Inhalte konnten nicht geladen werden.',
        getWorkspaceContext().requestId
      );
    }
  });

const handleProjectedContentRefresh = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const featureCheck = ensureFeature(
      getFeatureFlags(),
      'iam_admin',
      getWorkspaceContext().requestId
    );
    if (featureCheck) {
      return featureCheck;
    }

    try {
      const rawBody = await request.text();
      const payload = (rawBody.length > 0 ? JSON.parse(rawBody) : {}) as {
        readonly visibleTypes?: unknown;
        readonly force?: unknown;
      };

      const visibleTypes = Array.isArray(payload.visibleTypes)
        ? payload.visibleTypes.filter((value): value is string => typeof value === 'string')
        : [];

      return await refreshProjectedContents(ctx, {
        ...(visibleTypes.length > 0 ? { visibleTypes } : {}),
        ...(payload.force === true ? { force: true } : {}),
      });
    } catch (error) {
      return createListErrorResponse(
        400,
        'invalid_request',
        'Ungültige Refresh-Anfrage.',
        getWorkspaceContext().requestId
      );
    }
  });

export const dispatchAggregatedContentListRequest = async (
  request: Request
): Promise<Response | null> => {
  const url = new URL(request.url);
  if (url.pathname === '/api/v1/iam/contents') {
    if (request.method === 'GET') {
      return handleProjectedContentList(request);
    }

    return null;
  }

  if (url.pathname === '/api/v1/iam/contents/refresh') {
    if (request.method === 'POST') {
      return handleProjectedContentRefresh(request);
    }

    return null;
  }

  if (url.pathname === '/api/v1/iam/contents/mainserver-diagnostics') {
    if (request.method === 'GET') {
      return handleMainserverAuthoringDiagnostics(request);
    }

    return null;
  }

  return null;
};
