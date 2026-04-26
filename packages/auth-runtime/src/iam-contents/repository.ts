import type { IamContentDetail, IamContentHistoryEntry, IamContentListItem, IamContentPrimitiveAction } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  insertContentHistory,
  loadCurrentContentRow,
  resolveContentMutationMetadata,
} from './repository-shared.js';
import { mapContentHistoryItem, mapContentListItem } from './repository-mappers.js';
import { resolveNextContentState } from './repository-state.js';
import {
  CONTENT_SELECT,
  type ContentHistoryRow,
  type ContentRow,
  type CreateContentInput,
  type DeleteContentInput,
  type UpdateContentInput,
} from './repository-types.js';
import {
  emitContentCreatedActivity,
  emitContentDeletedActivity,
  emitContentUpdatedActivity,
  insertContentRow,
  updateContentRevisionRefs,
  updateContentRow,
  validatePublicationWindow,
} from './repository-write-helpers.js';

const resolveAuditAction = (input: {
  readonly changedFields: readonly string[];
  readonly previousStatus: string;
  readonly nextStatus: string;
}): IamContentPrimitiveAction => {
  if (input.previousStatus !== input.nextStatus) {
    if (input.nextStatus === 'published') {
      return 'content.publish';
    }
    if (input.nextStatus === 'archived') {
      return 'content.archive';
    }
    if (input.previousStatus === 'archived') {
      return 'content.restore';
    }
    return 'content.changeStatus';
  }
  return input.changedFields.includes('payload') ? 'content.updatePayload' : 'content.updateMetadata';
};

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
    validatePublicationWindow(input);
    const contentId = await insertContentRow(client, input);
    const historyId = await insertContentHistory(client, {
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
    await updateContentRevisionRefs(client, input.instanceId, contentId, historyId);
    await emitContentCreatedActivity(client, input, contentId);
    return contentId;
  });

export const updateContent = async (input: UpdateContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }
    const {
      changedFields,
      nextOrganizationId,
      nextOwnerSubjectId,
      nextPayload,
      nextPublishedAt,
      nextPublishFrom,
      nextPublishUntil,
      nextStatus,
      nextTitle,
      nextValidationState,
    } = resolveNextContentState(current, input);
    await updateContentRow(client, input, {
      organizationId: nextOrganizationId,
      ownerSubjectId: nextOwnerSubjectId,
      title: nextTitle,
      payloadJson: JSON.stringify(nextPayload),
      status: nextStatus,
      validationState: nextValidationState,
      publishedAt: nextPublishedAt,
      publishFrom: nextPublishFrom,
      publishUntil: nextPublishUntil,
    });
    const { activityEventType, historyAction, historySummary } = resolveContentMutationMetadata(
      current.status,
      nextStatus
    );
    const historyId = await insertContentHistory(client, {
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
    await updateContentRevisionRefs(client, input.instanceId, input.contentId, historyId);
    await emitContentUpdatedActivity(client, input, current, {
      eventType: activityEventType,
      action: resolveAuditAction({ changedFields, previousStatus: current.status, nextStatus }),
      changedFields,
      nextStatus,
      nextTitle,
    });
    return input.contentId;
  });

export const deleteContent = async (input: DeleteContentInput): Promise<string | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const current = await loadCurrentContentRow(client, input.instanceId, input.contentId);
    if (!current) {
      return undefined;
    }
    await emitContentDeletedActivity(client, input, current);
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
