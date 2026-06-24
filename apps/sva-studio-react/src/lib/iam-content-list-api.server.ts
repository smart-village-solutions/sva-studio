import { withAuthenticatedUser } from '@sva/auth-runtime/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import { createListErrorResponse, readContentListQuery } from './iam-content-list-api.shared.js';
import { listProjectedContents, refreshProjectedContents } from './iam-content-list-projection.server.js';

const handleProjectedContentList = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      return await listProjectedContents(ctx, readContentListQuery(request));
    } catch (error) {
      return createListErrorResponse(
        503,
        'database_unavailable',
        error instanceof Error ? error.message : 'Inhalte konnten nicht geladen werden.',
        getWorkspaceContext().requestId
      );
    }
  });

const handleProjectedContentRefresh = async (request: Request): Promise<Response> =>
  withAuthenticatedUser(request, async (ctx) => {
    try {
      const payload = (await request.json()) as {
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
        error instanceof Error ? error.message : 'Ungültige Refresh-Anfrage.',
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
