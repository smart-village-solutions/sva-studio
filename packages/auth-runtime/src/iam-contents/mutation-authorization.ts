import {
  resolveIamContentCapabilityMapping,
  type IamContentDomainCapability,
  type IamContentListItem,
  type IamContentPrimitiveAction,
  type IamContentStatus,
} from '@sva/core';

import type { UpdateContentSchemaInput } from './schemas.js';
import type { ResolvedContentActor } from './request-context.js';
import { authorizeContentAction, resolveContentAuthorizationPermissions } from './request-context.js';

const metadataFields = [
  'title',
  'publishedAt',
  'publishFrom',
  'publishUntil',
  'organizationId',
  'ownerSubjectId',
  'validationState',
] as const;

export type ResolvedContentAuthorizationAction = {
  readonly domainCapability: IamContentDomainCapability;
  readonly primitiveAction: IamContentPrimitiveAction;
};

const resolveContentAuthorizationAction = (
  domainCapability: IamContentDomainCapability
): ResolvedContentAuthorizationAction => {
  const mapping = resolveIamContentCapabilityMapping(domainCapability);
  if (!mapping.ok) {
    throw new Error(mapping.reasonCode);
  }
  return {
    domainCapability: mapping.domainCapability,
    primitiveAction: mapping.primitiveAction,
  };
};

const resolveStatusCapability = (
  currentStatus: IamContentStatus,
  nextStatus: IamContentStatus
): IamContentDomainCapability | undefined => {
  if (currentStatus === nextStatus) {
    return undefined;
  }
  if (nextStatus === 'published') {
    return 'content.publish';
  }
  if (nextStatus === 'archived') {
    return 'content.archive';
  }
  return currentStatus === 'archived' ? 'content.restore' : 'content.change_status';
};

export const resolveUpdateContentActions = (
  currentContent: IamContentListItem,
  data: UpdateContentSchemaInput
): readonly ResolvedContentAuthorizationAction[] => {
  const requiredCapabilities = new Set<IamContentDomainCapability>();
  if (metadataFields.some((field) => data[field] !== undefined)) {
    requiredCapabilities.add('content.update_metadata');
  }
  if (data.payload !== undefined) {
    requiredCapabilities.add('content.update_payload');
  }

  const statusCapability = data.status ? resolveStatusCapability(currentContent.status, data.status) : undefined;
  if (statusCapability) {
    requiredCapabilities.add(statusCapability);
  }

  return [...requiredCapabilities].map(resolveContentAuthorizationAction);
};

export const authorizeUpdateContentActions = async (
  actor: ResolvedContentActor['actor'],
  contentId: string,
  currentContent: IamContentListItem,
  data: UpdateContentSchemaInput
): Promise<Response | null> => {
  const actions = resolveUpdateContentActions(currentContent, data);
  const sourcePermissions = await resolveContentAuthorizationPermissions(actor, currentContent.organizationId);

  if ('error' in sourcePermissions) {
    return sourcePermissions.error;
  }

  for (const action of actions) {
    const authorizationError = await authorizeContentAction(actor, action.primitiveAction, {
      contentId,
      contentType: currentContent.contentType,
      domainCapability: action.domainCapability,
      organizationId: currentContent.organizationId,
    }, { permissions: sourcePermissions.permissions });
    if (authorizationError) {
      return authorizationError;
    }
  }

  if (data.organizationId && data.organizationId !== currentContent.organizationId) {
    const destinationPermissions = await resolveContentAuthorizationPermissions(actor, data.organizationId);

    if ('error' in destinationPermissions) {
      return destinationPermissions.error;
    }

    for (const action of actions) {
      const destinationAuthorizationError = await authorizeContentAction(actor, action.primitiveAction, {
        contentId,
        contentType: currentContent.contentType,
        domainCapability: action.domainCapability,
        organizationId: data.organizationId,
      }, { permissions: destinationPermissions.permissions });
      if (destinationAuthorizationError) {
        return destinationAuthorizationError;
      }
    }
  }

  return null;
};
