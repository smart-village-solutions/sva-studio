import {
  authorizeInstancePermissionForUser,
  ensureFeature,
  getFeatureFlags,
  loadMainserverAuthoringDiagnostics,
  withAuthenticatedUser,
  validateCsrf,
} from '@sva/auth-runtime/server';

import {
  createListErrorResponse,
  InvalidContentListQueryError,
  readContentListQuery,
} from './iam-content-list-api.shared.js';
import {
  listProjectedContents,
  refreshProjectedContents,
} from './iam-content-list-projection.server.js';

const handleMainserverAuthoringDiagnostics = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const { createSdkLogger, getWorkspaceContext } = await import('@sva/server-runtime');
    const logger = createSdkLogger({ component: 'iam-content-list-api' });
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
    const { createSdkLogger, getWorkspaceContext } = await import('@sva/server-runtime');
    const logger = createSdkLogger({ component: 'iam-content-list-api' });
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
      if (error instanceof InvalidContentListQueryError) {
        return createListErrorResponse(
          400,
          'invalid_request',
          'Ungültige Sortierparameter.',
          getWorkspaceContext().requestId
        );
      }
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
    const { createSdkLogger, getWorkspaceContext } = await import('@sva/server-runtime');
    const logger = createSdkLogger({ component: 'iam-content-list-api' });
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
      const parsed: unknown = rawBody.length > 0 ? JSON.parse(rawBody) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return createListErrorResponse(
          400,
          'invalid_request',
          'Ungültige Refresh-Anfrage.',
          getWorkspaceContext().requestId
        );
      }
      const payload = parsed as {
        readonly visibleTypes?: unknown;
        readonly force?: unknown;
        readonly recoverCredentials?: unknown;
        readonly originalRequestId?: unknown;
      };

      if (payload.recoverCredentials === true) {
        const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
        if (csrfError) return csrfError;
      }

      const visibleTypes = Array.isArray(payload.visibleTypes)
        ? payload.visibleTypes.filter((value): value is string => typeof value === 'string')
        : [];

      return await refreshProjectedContents(ctx, {
        ...(visibleTypes.length > 0 ? { visibleTypes } : {}),
        ...(payload.force === true ? { force: true } : {}),
        ...(payload.recoverCredentials === true ? { recoverCredentials: true } : {}),
        ...(typeof payload.originalRequestId === 'string' &&
        /^[a-zA-Z0-9-]{1,128}$/.test(payload.originalRequestId)
          ? { originalRequestId: payload.originalRequestId }
          : {}),
      });
    } catch (error) {
      if (error instanceof SyntaxError)
        return createListErrorResponse(
          400,
          'invalid_request',
          'Ungültige Refresh-Anfrage.',
          getWorkspaceContext().requestId
        );
      logger.error('content_projection_refresh_failed', {
        request_id: getWorkspaceContext().requestId,
        instance_id: ctx.user.instanceId,
        error_code: 'database_unavailable',
      });
      return createListErrorResponse(
        503,
        'database_unavailable',
        'Inhalte konnten nicht aktualisiert werden.',
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
