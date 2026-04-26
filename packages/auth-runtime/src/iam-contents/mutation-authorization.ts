import {
  resolveIamContentCapabilityMapping,
  type IamContentDomainCapability,
  type IamContentListItem,
  type IamContentPrimitiveAction,
} from '@sva/core';

import type { UpdateContentSchemaInput } from './schemas.js';
import type { ResolvedContentActor } from './request-context.js';
import { authorizeContentAction } from './request-context.js';

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
  currentStatus: string,
  nextStatus: string
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
  for (const action of resolveUpdateContentActions(currentContent, data)) {
    const authorizationError = await authorizeContentAction(actor, action.primitiveAction, {
      contentId,
      contentType: currentContent.contentType,
      domainCapability: action.domainCapability,
      organizationId: data.organizationId ?? currentContent.organizationId,
    });
    if (authorizationError) {
      return authorizationError;
    }
  }

  return null;
};
