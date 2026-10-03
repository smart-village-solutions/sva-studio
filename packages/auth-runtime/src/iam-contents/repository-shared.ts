import type { ContentJsonValue, IamContentStatus } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { ContentOwnershipTransferError } from './repository-ownership.js';
import { CONTENT_SELECT, type ContentRow, type UpdateContentInput } from './repository-types.js';

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

export const isContentMutationFinalized = async (
  client: InstanceScopedClient,
  input: { readonly instanceId: string; readonly contentId: string; readonly mutationRef: string }
): Promise<boolean> => {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
    input.instanceId,
    `${input.contentId}:${input.mutationRef}`,
  ]);
  const result = await client.query<{ id: string }>(
    `SELECT id::text
     FROM iam.content_history
     WHERE instance_id = $1
       AND content_id = $2::uuid
       AND mutation_ref = $3
     LIMIT 1;`,
    [input.instanceId, input.contentId, input.mutationRef]
  );
  return result.rows.length > 0;
};

export const resolveContentUpdateReplay = async (
  client: InstanceScopedClient,
  input: UpdateContentInput
): Promise<{ readonly mutationFinalized: boolean; readonly skip: boolean }> => {
  const mutationFinalized = input.mutationRef
    ? await isContentMutationFinalized(client, {
        instanceId: input.instanceId,
        contentId: input.contentId,
        mutationRef: input.mutationRef,
      })
    : false;
  if (mutationFinalized && !input.confirmedExternalOwner) {
    return { mutationFinalized, skip: true };
  }
  if (!input.confirmedExternalOwner || !input.mutationRef) {
    return { mutationFinalized, skip: false };
  }
  const journal = await client.query<{ succeeded: boolean; unresolved: boolean }>(
    `SELECT
       COALESCE(bool_or(newer.provider_outcome = 'succeeded'), false) AS succeeded,
       COALESCE(bool_or(newer.provider_outcome IN ('pending', 'unknown')), false) AS unresolved
     FROM iam.mainserver_mutation_journal AS operation
     LEFT JOIN iam.mainserver_mutation_journal AS newer
       ON newer.instance_id = operation.instance_id
         AND newer.action_id = 'content.transferOwnership'
         AND newer.content_type = operation.content_type
         AND COALESCE(newer.preimage->>'id', newer.content_id) =
             COALESCE(operation.preimage->>'id', operation.content_id)
         AND (newer.created_at, newer.operation_external_id) >
             (operation.created_at, operation.operation_external_id)
         AND newer.provider_outcome <> 'failed'
     WHERE operation.instance_id = $1 AND operation.operation_external_id = $2
       AND operation.action_id = 'content.transferOwnership' LIMIT 1;`,
    [input.instanceId, input.mutationRef]
  );
  if (journal.rows[0]?.unresolved || (journal.rows[0]?.succeeded && !mutationFinalized)) {
    throw new ContentOwnershipTransferError('ownership_source_changed');
  }
  return { mutationFinalized, skip: journal.rows[0]?.succeeded === true };
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
    mutationRef?: string;
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
  snapshot_json,
  origin,
  coverage,
  mutation_ref
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
  $10::jsonb,
  'studio',
  'studio_mutations',
  $11
)
ON CONFLICT (instance_id, content_id, mutation_ref) WHERE mutation_ref IS NOT NULL
DO NOTHING
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
      input.mutationRef ?? null,
    ]
  );
  const historyId = result.rows[0]?.id;
  if (!historyId && input.mutationRef) {
    const existing = await client.query<{ id: string }>(
      `SELECT id::text
       FROM iam.content_history
       WHERE instance_id = $1
         AND content_id = $2::uuid
         AND mutation_ref = $3
       LIMIT 1;`,
      [input.instanceId, input.contentId, input.mutationRef]
    );
    const existingId = existing.rows[0]?.id;
    if (existingId) {
      return existingId;
    }
  }
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
