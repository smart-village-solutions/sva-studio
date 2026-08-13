import type { IamContentDomainCapability, IamContentPrimitiveAction } from '@sva/core';
import type { AuthorizeRequest } from '@sva/iam-core';

import type { ResolvedContentActor } from './request-context.js';

export type ContentReadAction =
  | 'content.read'
  | 'news.read'
  | 'events.read'
  | 'poi.read'
  | 'generic-items.read'
  | 'faq.read'
  | 'cockpit-cards.read'
  | 'projects.read'
  | 'surveys.read';
export type ContentAuthorizationAction = IamContentPrimitiveAction | ContentReadAction;

export type ContentAuthorizationResource = {
  readonly contentId?: string;
  readonly contentType?: string;
  readonly domainCapability?: IamContentDomainCapability;
  readonly organizationId?: string;
  readonly ownerUserId?: string;
  readonly ownerOrganizationId?: string;
};

const deriveAuthorizeResourceType = (
  action: ContentAuthorizationAction
): AuthorizeRequest['resource']['type'] => {
  return action === 'content.read' || !action.endsWith('.read')
    ? 'content'
    : action.slice(0, -'.read'.length);
};

export const buildContentAuthorizeRequest = (
  actor: ResolvedContentActor['actor'],
  action: ContentAuthorizationAction,
  resource: ContentAuthorizationResource
): AuthorizeRequest => {
  const organizationId = resource.organizationId ?? actor.activeOrganizationId;
  return {
    instanceId: actor.instanceId,
    action,
    resource: {
      type: deriveAuthorizeResourceType(action),
      ...(resource.contentId ? { id: resource.contentId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(resource.contentType ||
      resource.ownerUserId ||
      resource.ownerOrganizationId ||
      organizationId
        ? {
            attributes: {
              ...(resource.contentType ? { contentType: resource.contentType } : {}),
              ...(resource.ownerUserId ? { ownerUserId: resource.ownerUserId } : {}),
              ...(resource.ownerOrganizationId
                ? { ownerOrganizationId: resource.ownerOrganizationId }
                : {}),
              ...(organizationId ? { organizationId } : {}),
            },
          }
        : {}),
    },
    context: {
      ...(organizationId ? { organizationId } : {}),
      ...(actor.requestId ? { requestId: actor.requestId } : {}),
      ...(actor.traceId ? { traceId: actor.traceId } : {}),
      attributes: {
        ...(resource.contentType ? { contentType: resource.contentType } : {}),
        ...(actor.actorAccountId ? { actorAccountId: actor.actorAccountId } : {}),
      },
    },
  };
};
