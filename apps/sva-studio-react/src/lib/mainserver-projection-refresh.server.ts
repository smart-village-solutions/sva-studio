import {
  resolveActorAccountId,
  withAuthenticatedUser,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';

import { refreshProjectedContentsForMainserverMutation } from './iam-content-list-projection.server.js';

type MainserverProjectionContentType =
  | 'news.article'
  | 'events.event-record'
  | 'poi.point-of-interest'
  | 'surveys.survey';

const shouldRefreshProjectionForRequest = (request: Request, response: Response): boolean =>
  response.ok &&
  request.method !== 'GET' &&
  request.method !== 'HEAD' &&
  request.method !== 'OPTIONS';

export const refreshProjectionAfterMainserverMutation = async (
  request: Request,
  response: Response,
  contentType: MainserverProjectionContentType
): Promise<void> => {
  if (!shouldRefreshProjectionForRequest(request, response)) {
    return;
  }

  await withAuthenticatedUser(request, async (ctx) => {
    if (!ctx.user.instanceId) {
      return response;
    }
    const actorAccountId = await withInstanceScopedDb(ctx.user.instanceId, async (client) =>
      resolveActorAccountId(client, {
        instanceId: ctx.user.instanceId!,
        keycloakSubject: ctx.user.id,
      })
    );

    await refreshProjectedContentsForMainserverMutation({
      instanceId: ctx.user.instanceId,
      keycloakSubject: ctx.user.id,
      contentType,
      ...(actorAccountId ? { actorAccountId } : {}),
      ...(ctx.activeOrganizationId ? { organizationId: ctx.activeOrganizationId } : {}),
    });

    return response;
  });
};
