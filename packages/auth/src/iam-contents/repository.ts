import type { IamContentDetail, IamContentHistoryEntry, IamContentListItem } from '@sva/core';

import { emitActivityLog, withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  CONTENT_SELECT,
  type ContentHistoryRow,
  type ContentRow,
  type CreateContentInput,
  type DeleteContentInput,
  type UpdateContentInput,
  insertContentHistory,
  loadCurrentContentRow,
  mapContentHistoryItem,
  mapContentListItem,
  resolveContentMutationMetadata,
  resolveNextContentState,
} from './repository-shared.js';

export const loadContentListItems = async (instanceId: string): Promise<readonly IamContentListItem[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<ContentRow>(
      `${CONTENT_SELECT}
WHERE content.instance_id = $1
ORDER BY content.updated_at DESC, content.created_at DESC;
`,
      [instanceId]
    );

    return result.rows.map(mapContentListItem);
  });

export const loadContentById = async (
  instanceId: string,
  contentId: string
): Promise<IamContentListItem | undefined> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<ContentRow>(
      `${CONTENT_SELECT}
WHERE content.instance_id = $1
  AND content.id = $2::uuid
LIMIT 1;
`,
      [instanceId, contentId]
    );

    const row = result.rows[0];
    return row ? mapContentListItem(row) : undefined;
  });

export const loadContentHistory = async (
  instanceId: string,
  contentId: string
): Promise<readonly IamContentHistoryEntry[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<ContentHistoryRow>(
      `
SELECT
  history.id,
  history.content_id,
  history.action,
  history.actor_display_name,
  history.changed_fields,
  history.previous_status,
  history.next_status,
  history.created_at::text,
  history.summary
FROM iam.content_history history
WHERE history.instance_id = $1
  AND history.content_id = $2::uuid
ORDER BY history.created_at DESC, history.id DESC;
`,
      [instanceId, contentId]
    );

    return result.rows.map(mapContentHistoryItem);
  });

export const loadContentDetail = async (
  instanceId: string,
  contentId: string
): Promise<IamContentDetail | undefined> => {
  const item = await loadContentById(instanceId, contentId);
  if (!item) {
    return undefined;
  }

  const history = await loadContentHistory(instanceId, contentId);
  return { ...item, history };
};

export const createContent = async (input: CreateContentInput): Promise<string> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const insert = await client.query<{ id: string }>(
      `
INSERT INTO iam.contents (
  id,
  instance_id,
  content_type,
  title,
  published_at,
  author_account_id,
  author_display_name,
  payload_json,
  status
)
VALUES (
  gen_random_uuid(),
  $1,
  $2,
  $3,
  COALESCE($4::timestamptz, CASE WHEN $6 = 'published' THEN NOW() ELSE NULL END),
  $5::uuid,
  $7,
  $8::jsonb,
  $6
)
RETURNING id;
`,
      [
        input.instanceId,
        input.contentType,
        input.title,
        input.publishedAt ?? null,
        input.actorAccountId,
        input.status,
        input.actorDisplayName,
        JSON.stringify(input.payload),
      ]
    );

    const contentId = insert.rows[0]?.id;
    if (!contentId) {
      throw new Error('content_create_failed');
    }

    await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: 'created',
      changedFields: ['contentType', 'title', 'payload', 'status', ...(input.publishedAt ? ['publishedAt'] : [])],
      nextStatus: input.status,
      summary: 'Inhalt erstellt',
      snapshot: input.payload,
    });

    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: 'iam.content.created',
      result: 'success',
      payload: {
        content_id: contentId,
        content_type: input.contentType,
        title: input.title,
        status: input.status,
      },
      requestId: input.requestId,
      traceId: input.traceId,
    });

    return contentId;
  });

export const updateContent = async (input: UpdateContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }

    const { changedFields, nextPayload, nextPublishedAt, nextStatus, nextTitle } =
      resolveNextContentState(current, input);

    await client.query(
      `
UPDATE iam.contents
SET
  title = $3,
  payload_json = $4::jsonb,
  status = $5,
  published_at = COALESCE($6::timestamptz, CASE WHEN $5 = 'published' THEN NOW() ELSE NULL END),
  updated_at = NOW(),
  author_account_id = $7::uuid,
  author_display_name = $8
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [
        input.instanceId,
        input.contentId,
        nextTitle,
        JSON.stringify(nextPayload),
        nextStatus,
        nextPublishedAt,
        input.actorAccountId,
        input.actorDisplayName,
      ]
    );

    const { activityEventType, historyAction, historySummary } = resolveContentMutationMetadata(
      current.status,
      nextStatus
    );

    await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId: input.contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: historyAction,
      changedFields,
      previousStatus: current.status,
      nextStatus,
      summary: historySummary,
      snapshot: nextPayload,
    });

    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: activityEventType,
      result: 'success',
      payload: {
        content_id: input.contentId,
        content_type: current.content_type,
        title: nextTitle,
        changed_fields: changedFields,
        previous_status: current.status,
        next_status: nextStatus,
      },
      requestId: input.requestId,
      traceId: input.traceId,
    });

    return input.contentId;
  });

export const deleteContent = async (input: DeleteContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }

    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: 'iam.content.deleted',
      result: 'success',
      payload: {
        content_id: input.contentId,
        content_type: current.content_type,
        title: current.title,
      },
      requestId: input.requestId,
      traceId: input.traceId,
    });

    await client.query(
      `
DELETE FROM iam.contents
WHERE instance_id = $1
  AND id = $2::uuid;
`,
      [input.instanceId, input.contentId]
    );

    return input.contentId;
  });
