import type { IamContentListQuery } from '@sva/core';

import { authorizeContentAction, type ContentReadAction, type ResolvedContentActor } from './request-context.js';

const buildReadActionForContentType = (contentType: string | undefined): ContentReadAction => {
  switch (contentType) {
    case 'news.article':
      return 'news.read';
    case 'events.event-record':
      return 'events.read';
    case 'poi.point-of-interest':
      return 'poi.read';
    default:
      return 'content.read';
  }
};

export const isServerAuthorizationError = (response: Response): boolean => response.status >= 500;

export const collectListReadActions = (query: IamContentListQuery): readonly ContentReadAction[] => {
  const requestedContentTypes =
    query.type && query.type.trim().length > 0
      ? [query.type]
      : (query.visibleTypes ?? []);

  const actions = requestedContentTypes.map((contentType) => buildReadActionForContentType(contentType));
  return actions.length > 0 ? [...new Set(actions)] : ['content.read'];
};

export const authorizeReadableContentItem = (
  actor: ResolvedContentActor['actor'],
  item: {
    readonly id: string;
    readonly contentType: string;
    readonly organizationId?: string;
    readonly createdBy?: string;
  }
) =>
  authorizeContentAction(actor, buildReadActionForContentType(item.contentType), {
    contentId: item.id,
    contentType: item.contentType,
    organizationId: item.organizationId,
    createdByAccountId: item.createdBy,
  });

export const resolveReadableContentScopes = async (
  actor: ResolvedContentActor['actor'],
  scopes: readonly (string | null)[],
  query: IamContentListQuery
): Promise<{ readonly allowedOrganizationIds: readonly string[]; readonly includeUnscopedContent: boolean } | Response> => {
  const allowedOrganizationIds: string[] = [];
  let includeUnscopedContent = false;
  const readActions = collectListReadActions(query);

  for (const scope of scopes) {
    let scopeAllowed = false;
    for (const action of readActions) {
      const authorizationError = await authorizeContentAction(actor, action, {
        ...(scope ? { organizationId: scope } : {}),
        ...(actor.actorAccountId ? { createdByAccountId: actor.actorAccountId } : {}),
      });

      if (!authorizationError) {
        scopeAllowed = true;
        if (scope) {
          allowedOrganizationIds.push(scope);
        } else {
          includeUnscopedContent = true;
        }
        break;
      }

      if (isServerAuthorizationError(authorizationError)) {
        return authorizationError;
      }
    }

    if (scopeAllowed) {
      continue;
    }
  }

  return {
    allowedOrganizationIds,
    includeUnscopedContent,
  };
};
