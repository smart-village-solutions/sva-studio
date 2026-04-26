import type { IamContentListItem, IamContentPrimitiveAction } from '@sva/core';

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

const resolveStatusAction = (
  currentStatus: string,
  nextStatus: string
): IamContentPrimitiveAction | undefined => {
  if (currentStatus === nextStatus) {
    return undefined;
  }
  if (nextStatus === 'published') {
    return 'content.publish';
  }
  if (nextStatus === 'archived') {
    return 'content.archive';
  }
  return currentStatus === 'archived' ? 'content.restore' : 'content.changeStatus';
};

export const resolveUpdateContentActions = (
  currentContent: IamContentListItem,
  data: UpdateContentSchemaInput
): readonly IamContentPrimitiveAction[] => {
  const requiredActions = new Set<IamContentPrimitiveAction>();
  if (metadataFields.some((field) => data[field] !== undefined)) {
    requiredActions.add('content.updateMetadata');
  }
  if (data.payload !== undefined) {
    requiredActions.add('content.updatePayload');
  }

  const statusAction = data.status ? resolveStatusAction(currentContent.status, data.status) : undefined;
  if (statusAction) {
    requiredActions.add(statusAction);
  }

  return [...requiredActions];
};

export const authorizeUpdateContentActions = async (
  actor: ResolvedContentActor['actor'],
  contentId: string,
  currentContent: IamContentListItem,
  data: UpdateContentSchemaInput
): Promise<Response | null> => {
  for (const action of resolveUpdateContentActions(currentContent, data)) {
    const authorizationError = await authorizeContentAction(actor, action, {
      contentId,
      contentType: currentContent.contentType,
      organizationId: data.organizationId ?? currentContent.organizationId,
    });
    if (authorizationError) {
      return authorizationError;
    }
  }

  return null;
};
