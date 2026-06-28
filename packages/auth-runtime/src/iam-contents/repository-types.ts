import type {
  ContentJsonValue,
  IamContentListQuery,
  IamContentAuthorDisplayMode,
  IamContentStatus,
  IamContentValidationState,
} from '@sva/core';

export type ContentRow = {
  id: string;
  content_type: string;
  instance_id: string;
  organization_id: string | null;
  owner_subject_id: string | null;
  owner_user_id: string | null;
  owner_organization_id: string | null;
  title: string;
  published_at: string | null;
  publish_from: string | null;
  publish_until: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  author_display_mode: IamContentAuthorDisplayMode;
  author_display_name: string;
  payload_json: ContentJsonValue;
  status: IamContentStatus;
  validation_state: IamContentValidationState;
  history_ref: string;
  current_revision_ref: string | null;
  last_audit_event_ref: string | null;
};

export type ContentHistoryRow = {
  id: string;
  content_id: string;
  action: 'created' | 'updated' | 'status_changed';
  actor_display_name: string;
  changed_fields: string[] | null;
  previous_status: IamContentStatus | null;
  next_status: IamContentStatus | null;
  created_at: string;
  summary: string | null;
};

export type CreateContentInput = {
  instanceId: string;
  actorAccountId: string;
  actorDisplayName: string;
  requestId?: string;
  traceId?: string;
  contentType: string;
  organizationId?: string;
  authorDisplayMode?: IamContentAuthorDisplayMode;
  title: string;
  payload: ContentJsonValue;
  status: IamContentStatus;
  validationState?: IamContentValidationState;
  publishedAt?: string;
  publishFrom?: string;
  publishUntil?: string;
};

export type UpdateContentInput = {
  instanceId: string;
  actorAccountId: string;
  actorDisplayName: string;
  requestId?: string;
  traceId?: string;
  contentId: string;
  organizationId?: string;
  ownerUserId?: string;
  ownerOrganizationId?: string;
  authorDisplayMode?: IamContentAuthorDisplayMode;
  authorDisplayName?: string;
  title?: string;
  payload?: ContentJsonValue;
  status?: IamContentStatus;
  validationState?: IamContentValidationState;
  publishedAt?: string;
  publishFrom?: string;
  publishUntil?: string;
};

export type DeleteContentInput = {
  instanceId: string;
  actorAccountId: string;
  actorDisplayName: string;
  requestId?: string;
  traceId?: string;
  contentId: string;
  currentContent?: ContentRow;
};

export type LoadContentListItemsInput = Pick<
  IamContentListQuery,
  'page' | 'pageSize' | 'q' | 'sortBy' | 'sortDirection' | 'status' | 'type' | 'visibleTypes'
>;

export type LoadContentListAuthorizationInput = {
  readonly allowGlobal: boolean;
  readonly allowOwn: boolean;
  readonly allowedOrganizationIds: readonly string[];
  readonly actorAccountId?: string;
};

export const CONTENT_SELECT = `
SELECT
  content.id,
  content.content_type,
  content.instance_id,
  content.organization_id::text,
  content.owner_subject_id,
  content.owner_user_id::text,
  content.owner_organization_id::text,
  content.title,
  content.published_at::text,
  content.publish_from::text,
  content.publish_until::text,
  content.created_at::text,
  content.creator_account_id::text AS created_by,
  content.updated_at::text,
  content.updater_account_id::text AS updated_by,
  content.author_display_mode,
  content.author_display_name,
  content.payload_json,
  content.status,
  content.validation_state,
  content.history_ref,
  content.current_revision_ref,
  content.last_audit_event_ref
FROM iam.contents content
`;
