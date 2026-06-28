import type { ContentJsonValue, IamContentStatus, IamContentValidationState } from '@sva/core';

import type { ContentRow, UpdateContentInput } from './repository-types.js';

export type NextContentStateValues = {
  nextPayload: ContentJsonValue;
  nextPublishedAt: string | null;
  nextPublishFrom: string | null;
  nextPublishUntil: string | null;
  nextStatus: IamContentStatus;
  nextValidationState: IamContentValidationState;
  nextTitle: string;
  nextOrganizationId: string | null;
  nextOwnerUserId: string | null;
  nextOwnerOrganizationId: string | null;
  nextAuthorDisplayMode: ContentRow['author_display_mode'];
  nextAuthorDisplayName: string;
};

export const resolveNextContentStateValues = (
  current: ContentRow,
  input: UpdateContentInput
): NextContentStateValues => {
  const nextOwnerOrganizationId = input.ownerOrganizationId ?? current.owner_organization_id ?? null;
  const clearOwnerUserOnOrganizationOwnerTransfer =
    input.ownerUserId === undefined &&
    input.ownerOrganizationId !== undefined &&
    nextOwnerOrganizationId !== current.owner_organization_id;

  return {
    nextTitle: input.title ?? current.title,
    nextPayload: input.payload ?? current.payload_json,
    nextStatus: input.status ?? current.status,
    nextValidationState: input.validationState ?? current.validation_state,
    nextPublishedAt: input.publishedAt ?? current.published_at ?? null,
    nextPublishFrom: input.publishFrom ?? current.publish_from ?? null,
    nextPublishUntil: input.publishUntil ?? current.publish_until ?? null,
    nextOrganizationId: input.organizationId ?? current.organization_id ?? null,
    nextOwnerUserId: clearOwnerUserOnOrganizationOwnerTransfer
      ? null
      : input.ownerUserId ?? current.owner_user_id ?? null,
    nextOwnerOrganizationId,
    nextAuthorDisplayMode: input.authorDisplayMode ?? current.author_display_mode,
    nextAuthorDisplayName: input.authorDisplayName ?? current.author_display_name,
  };
};
