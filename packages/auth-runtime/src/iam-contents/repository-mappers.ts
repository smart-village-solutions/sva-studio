import type { IamContentHistoryEntry, IamContentListItem } from '@sva/core';

import type { ContentHistoryRow, ContentRow } from './repository-types.js';

export const mapContentListItem = (row: ContentRow): IamContentListItem => ({
  id: row.id,
  contentType: row.content_type,
  instanceId: row.instance_id,
  ...(row.organization_id ? { organizationId: row.organization_id } : {}),
  ...(row.owner_subject_id ? { ownerSubjectId: row.owner_subject_id } : {}),
  title: row.title,
  ...(row.published_at ? { publishedAt: row.published_at } : {}),
  ...(row.publish_from ? { publishFrom: row.publish_from } : {}),
  ...(row.publish_until ? { publishUntil: row.publish_until } : {}),
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
  author: row.author_display_name,
  payload: row.payload_json,
  status: row.status,
  validationState: row.validation_state,
  historyRef: row.history_ref,
  ...(row.current_revision_ref ? { currentRevisionRef: row.current_revision_ref } : {}),
  ...(row.last_audit_event_ref ? { lastAuditEventRef: row.last_audit_event_ref } : {}),
});

export const mapContentHistoryItem = (row: ContentHistoryRow): IamContentHistoryEntry => ({
  id: row.id,
  contentId: row.content_id,
  action: row.action,
  actor: row.actor_display_name,
  changedFields: row.changed_fields ?? [],
  ...(row.previous_status ? { fromStatus: row.previous_status } : {}),
  ...(row.next_status ? { toStatus: row.next_status } : {}),
  createdAt: row.created_at,
  ...(row.summary ? { summary: row.summary } : {}),
});
