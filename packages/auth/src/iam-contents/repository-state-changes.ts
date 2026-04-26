import type { ContentRow } from './repository-types.js';
import type { NextContentStateValues } from './repository-state-values.js';

const collectChangedFields = (checks: readonly (readonly [string, unknown, unknown])[]): string[] =>
  checks.flatMap(([field, nextValue, currentValue]) => (nextValue === currentValue ? [] : [field]));

export const resolveContentChangedFields = (
  current: ContentRow,
  next: NextContentStateValues
): string[] =>
  collectChangedFields([
    ['title', next.nextTitle, current.title],
    ['payload', JSON.stringify(next.nextPayload), JSON.stringify(current.payload_json)],
    ['status', next.nextStatus, current.status],
    ['publishedAt', next.nextPublishedAt, current.published_at],
    ['publishFrom', next.nextPublishFrom, current.publish_from],
    ['publishUntil', next.nextPublishUntil, current.publish_until],
    ['validationState', next.nextValidationState, current.validation_state],
    ['organizationId', next.nextOrganizationId, current.organization_id],
    ['ownerSubjectId', next.nextOwnerSubjectId, current.owner_subject_id],
  ]);
