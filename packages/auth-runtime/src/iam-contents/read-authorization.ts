import type { EffectivePermission, IamContentListQuery } from '@sva/core';

import {
  authorizeContentAction,
  resolveContentAuthorizationPermissions,
  type ContentReadAction,
  type ResolvedContentActor,
} from './request-context.js';
import type { LoadContentListAuthorizationInput } from './repository-types.js';

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

export const collectListReadActions = (
  query: IamContentListQuery
): readonly ContentReadAction[] => {
  const requestedContentTypes =
    query.type && query.type.trim().length > 0 ? [query.type] : (query.visibleTypes ?? []);

  const actions = requestedContentTypes.map((contentType) =>
    buildReadActionForContentType(contentType)
  );
  return actions.length > 0 ? [...new Set(actions)] : ['content.read'];
};

export const authorizeReadableContentItem = (
  actor: ResolvedContentActor['actor'],
  item: {
    readonly id: string;
    readonly contentType: string;
    readonly organizationId?: string;
    readonly createdBy?: string;
    readonly ownerUserId?: string;
    readonly ownerOrganizationId?: string;
  }
) =>
  authorizeContentAction(actor, buildReadActionForContentType(item.contentType), {
    contentId: item.id,
    contentType: item.contentType,
    organizationId: item.organizationId,
    ownerUserId: item.ownerUserId,
    ownerOrganizationId: item.ownerOrganizationId,
  });

export const resolveReadableContentScopes = async (
  actor: ResolvedContentActor['actor'],
  _scopes: readonly (string | null)[],
  query: IamContentListQuery
): Promise<LoadContentListAuthorizationInput | Response> => {
  const sourcePermissions = await resolveContentAuthorizationPermissions(actor);
  if ('error' in sourcePermissions) {
    return sourcePermissions.error;
  }

  return resolveReadableContentAuthorization(actor, sourcePermissions.permissions, query);
};

const readResourceTypeForAction = (action: ContentReadAction): string =>
  action.split('.')[0] || 'content';

const isMatchingReadPermission = (
  permission: EffectivePermission,
  action: ContentReadAction
): boolean =>
  permission.action === action &&
  permission.resourceType === readResourceTypeForAction(action) &&
  !permission.resourceId;

const applyReadablePermission = (
  permission: EffectivePermission,
  state: {
    allowGlobal: boolean;
    allowOwn: boolean;
    allowedOrganizationIds: Set<string>;
  }
): void => {
  if (permission.organizationId) {
    state.allowOwn = true;
    state.allowedOrganizationIds.add(permission.organizationId);
    return;
  }

  if (!permission.accessScope || permission.accessScope === 'all') {
    state.allowGlobal = true;
    return;
  }

  if (permission.accessScope === 'own') {
    state.allowOwn = true;
    return;
  }

  if (permission.accessScope === 'organization') {
    state.allowOwn = true;
  }
};

const resolveReadableContentAuthorization = (
  actor: ResolvedContentActor['actor'],
  permissions: readonly EffectivePermission[],
  query: IamContentListQuery
): LoadContentListAuthorizationInput => {
  const state = {
    allowGlobal: false,
    allowOwn: false,
    allowedOrganizationIds: new Set<string>(),
  };
  const readActions = collectListReadActions(query);

  for (const action of readActions) {
    for (const permission of permissions) {
      if (isMatchingReadPermission(permission, action)) {
        applyReadablePermission(permission, state);
      }
    }
  }

  return {
    allowGlobal: state.allowGlobal,
    allowOwn: state.allowOwn,
    allowedOrganizationIds: [...state.allowedOrganizationIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    ...(actor.actorAccountId ? { actorAccountId: actor.actorAccountId } : {}),
  };
};
