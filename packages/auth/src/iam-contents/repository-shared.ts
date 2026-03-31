import type {
  ContentJsonValue,
  IamContentHistoryEntry,
  IamContentListItem,
  IamContentStatus,
} from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';

export type ContentRow = {
  id: string;
  content_type: string;
  title: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_display_name: string;
  payload_json: ContentJsonValue;
  status: IamContentStatus;
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
  title: string;
  payload: ContentJsonValue;
  status: IamContentStatus;
  publishedAt?: string;
};

export type UpdateContentInput = {
  instanceId: string;
  actorAccountId: string;
  actorDisplayName: string;
  requestId?: string;
  traceId?: string;
  contentId: string;
  title?: string;
  payload?: ContentJsonValue;
  status?: IamContentStatus;
  publishedAt?: string;
};

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

export const loadCurrentContentRow = async (
  client: InstanceScopedClient,
  instanceId: string,
  contentId: string
): Promise<ContentRow | undefined> => {
  const currentResult = await client.query<ContentRow>(
    `${CONTENT_SELECT}
WHERE content.instance_id = $1
  AND content.id = $2::uuid
LIMIT 1;
`,
    [instanceId, contentId]
  );

  return currentResult.rows[0];
};

export const mapContentListItem = (row: ContentRow): IamContentListItem => ({
  id: row.id,
  contentType: row.content_type,
  title: row.title,
  ...(row.published_at ? { publishedAt: row.published_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: row.author_display_name,
  payload: row.payload_json,
  status: row.status,
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

export const CONTENT_SELECT = `
SELECT
  content.id,
  content.content_type,
  content.title,
  content.published_at::text,
  content.created_at::text,
  content.updated_at::text,
  content.author_display_name,
  content.payload_json,
  content.status
FROM iam.contents content
`;

export const insertContentHistory = async (
  client: InstanceScopedClient,
  input: {
    instanceId: string;
    contentId: string;
    actorAccountId: string;
    actorDisplayName: string;
    action: 'created' | 'updated' | 'status_changed';
    changedFields: readonly string[];
    previousStatus?: IamContentStatus;
    nextStatus?: IamContentStatus;
    summary?: string;
    snapshot: ContentJsonValue;
  }
): Promise<void> => {
  await client.query(
    `
INSERT INTO iam.content_history (
  id,
  instance_id,
  content_id,
  actor_account_id,
  actor_display_name,
  action,
  changed_fields,
  previous_status,
  next_status,
  summary,
  snapshot_json
)
VALUES (
  gen_random_uuid(),
  $1,
  $2::uuid,
  $3::uuid,
  $4,
  $5,
  $6::text[],
  $7,
  $8,
  $9,
  $10::jsonb
);
`,
    [
      input.instanceId,
      input.contentId,
      input.actorAccountId,
      input.actorDisplayName,
      input.action,
      input.changedFields,
      input.previousStatus ?? null,
      input.nextStatus ?? null,
      input.summary ?? null,
      JSON.stringify(input.snapshot),
    ]
  );
};

export const resolveNextContentState = (
  current: ContentRow,
  input: UpdateContentInput
): {
  changedFields: string[];
  nextPayload: ContentJsonValue;
  nextPublishedAt: string | null;
  nextStatus: IamContentStatus;
  nextTitle: string;
} => {
  const nextTitle = input.title ?? current.title;
  const nextPayload = input.payload ?? current.payload_json;
  const nextStatus = input.status ?? current.status;
  const nextPublishedAt = input.publishedAt ?? current.published_at ?? null;

  if (nextStatus === 'published' && !nextPublishedAt) {
    throw new Error('content_published_at_required');
  }

  const changedFields: string[] = [];
  if (nextTitle !== current.title) {
    changedFields.push('title');
  }
  if (JSON.stringify(nextPayload) !== JSON.stringify(current.payload_json)) {
    changedFields.push('payload');
  }
  if (nextStatus !== current.status) {
    changedFields.push('status');
  }
  if ((nextPublishedAt ?? null) !== current.published_at) {
    changedFields.push('publishedAt');
  }

  return {
    changedFields,
    nextPayload,
    nextPublishedAt,
    nextStatus,
    nextTitle,
  };
};

export const resolveContentMutationMetadata = (
  currentStatus: IamContentStatus,
  nextStatus: IamContentStatus
): {
  activityEventType: 'iam.content.created' | 'iam.content.status_changed' | 'iam.content.updated';
  historyAction: 'created' | 'status_changed' | 'updated';
  historySummary: 'Inhalt erstellt' | 'Status geändert' | 'Inhalt aktualisiert';
} => {
  if (currentStatus === nextStatus) {
    return {
      activityEventType: 'iam.content.updated',
      historyAction: 'updated',
      historySummary: 'Inhalt aktualisiert',
    };
  }

  return {
    activityEventType: 'iam.content.status_changed',
    historyAction: 'status_changed',
    historySummary: 'Status geändert',
  };
};
