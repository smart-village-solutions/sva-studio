import type { ContentJsonValue, IamContentDetail, IamContentHistoryEntry, IamContentListItem, IamContentStatus } from '@sva/core';

import { emitActivityLog, withInstanceScopedDb } from '../iam-account-management/shared.js';

type ContentRow = {
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

type ContentHistoryRow = {
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

type CreateContentInput = {
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

type UpdateContentInput = {
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

const mapContentListItem = (row: ContentRow): IamContentListItem => ({
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

const mapContentHistoryItem = (row: ContentHistoryRow): IamContentHistoryEntry => ({
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

const CONTENT_SELECT = `
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

const insertContentHistory = async (
  client: Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0],
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
) => {
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
    const currentResult = await client.query<ContentRow>(
      `${CONTENT_SELECT}
WHERE content.instance_id = $1
  AND content.id = $2::uuid
LIMIT 1;
`,
      [input.instanceId, input.contentId]
    );

    const current = currentResult.rows[0];
    if (!current) {
      return undefined;
    }

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

    await insertContentHistory(client, {
      instanceId: input.instanceId,
      contentId: input.contentId,
      actorAccountId: input.actorAccountId,
      actorDisplayName: input.actorDisplayName,
      action: nextStatus !== current.status ? 'status_changed' : 'updated',
      changedFields,
      previousStatus: current.status,
      nextStatus,
      summary: nextStatus !== current.status ? 'Status geändert' : 'Inhalt aktualisiert',
      snapshot: nextPayload,
    });

    await emitActivityLog(client, {
      instanceId: input.instanceId,
      accountId: input.actorAccountId,
      eventType: nextStatus !== current.status ? 'iam.content.status_changed' : 'iam.content.updated',
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
