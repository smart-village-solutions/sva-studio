import {
  ensureFeature,
  getFeatureFlags,
  withAuthenticatedUser,
} from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { createListErrorResponse, readContentListQuery } from './iam-content-list-api.shared.js';
import { listProjectedContents, refreshProjectedContents } from './iam-content-list-projection.server.js';

const logger = createSdkLogger({ component: 'iam-content-list-api' });

const handleProjectedContentList = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', getWorkspaceContext().requestId);
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
    const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', getWorkspaceContext().requestId);
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

  return null;
};
