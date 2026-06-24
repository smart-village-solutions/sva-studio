import { withAuthenticatedUser } from '@sva/auth-runtime/server';
import { getWorkspaceContext } from '@sva/server-runtime';

import { createListErrorResponse, readContentListQuery } from './iam-content-list-api.shared.js';
import { listProjectedContents } from './iam-content-list-projection.server.js';

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

export const dispatchAggregatedContentListRequest = async (
  request: Request
): Promise<Response | null> => {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/api/v1/iam/contents') {
    return null;
  }

  return handleProjectedContentList(request);
};
