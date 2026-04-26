import type { ContentJsonValue, IamContentStatus } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { CONTENT_SELECT, type ContentRow } from './repository-types.js';

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
): Promise<string> => {
  const result = await client.query<{ id: string }>(
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
)
RETURNING id;
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
  const historyId = result.rows[0]?.id;
  if (!historyId) {
    throw new Error('content_history_create_failed');
  }
  return historyId;
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
