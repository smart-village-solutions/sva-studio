import type { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { resolveCreateAuthorDisplay } from './repository-author-display.js';
import { insertContentHistory } from './repository-shared.js';
import type { ContentRow, CreateContentInput, UpdateContentInput } from './repository-types.js';

export {
  resolveCreateAuthorDisplay,
  resolveUpdateAuthorDisplay,
  validatePublicationWindow,
} from './repository-author-display.js';
export {
  emitContentCreatedActivity,
  emitExternalContentUpdatedActivity,
  emitContentDeletedActivity,
  emitContentUpdatedActivity,
  emitContentOwnershipTransferredActivity,
} from './repository-activity.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

export const persistContentUpdateHistory = async (
  client: InstanceScopedClient,
  input: UpdateContentInput,
  current: ContentRow,
  next: {
    readonly changedFields: readonly string[];
    readonly status: ContentRow['status'];
    readonly payload: ContentRow['payload_json'];
    readonly historyAction: 'created' | 'updated' | 'status_changed';
    readonly historySummary: string;
    readonly mutationFinalized: boolean;
  }
): Promise<void> => {
  if (next.mutationFinalized) {
    await client.query(
      `UPDATE iam.content_history
       SET changed_fields = ARRAY(
         SELECT DISTINCT field FROM unnest(changed_fields || $4::text[]) AS field ORDER BY field
       ), summary = 'Inhaber übertragen'
       WHERE instance_id = $1 AND content_id = $2::uuid AND mutation_ref = $3;`,
      [input.instanceId, input.contentId, input.mutationRef, next.changedFields]
    );
    return;
  }
  const historyId = await insertContentHistory(client, {
    instanceId: input.instanceId,
    contentId: input.contentId,
    actorAccountId: input.actorAccountId,
    actorDisplayName: input.actorDisplayName,
    action: next.historyAction,
    changedFields: next.changedFields,
    previousStatus: current.status,
    nextStatus: next.status,
    summary: input.confirmedExternalOwner ? 'Inhaber übertragen' : next.historySummary,
    snapshot: next.payload,
    mutationRef: input.mutationRef,
  });
  await updateContentRevisionRefs(client, input.instanceId, input.contentId, historyId);
};

export const insertContentRow = async (
  client: InstanceScopedClient,
  input: CreateContentInput
): Promise<string> => {
  const authorDisplay = await resolveCreateAuthorDisplay(client, input);
  const insert = await client.query<{ id: string }>(
    `
INSERT INTO iam.contents (
  id, instance_id, content_type, organization_id, owner_user_id, owner_organization_id, title,
  published_at, publish_from, publish_until, author_account_id, author_display_mode, author_display_name,
  creator_account_id, updater_account_id,
  payload_json, status, validation_state, history_ref
)
VALUES (
  gen_random_uuid(), $1, $2, $3::uuid, $4::uuid, $5::uuid, $6,
  COALESCE($7::timestamptz, CASE WHEN $11 = 'published' THEN NOW() ELSE NULL END),
  $8::timestamptz, $9::timestamptz, $10::uuid, $15, $12, $10::uuid, $10::uuid, $13::jsonb, $11, $14,
  gen_random_uuid()::text
)
RETURNING id;
`,
    [
      input.instanceId,
      input.contentType,
      input.organizationId ?? null,
      input.confirmedExternalOwner?.type === 'account'
        ? input.confirmedExternalOwner.id
        : input.organizationId
          ? null
          : input.actorAccountId,
      input.organizationId ?? null,
      input.title,
      input.publishedAt ?? null,
      input.publishFrom ?? null,
      input.publishUntil ?? null,
      input.actorAccountId,
      input.status,
      authorDisplay.authorDisplayName,
      JSON.stringify(input.payload),
      input.validationState ?? 'valid',
      authorDisplay.authorDisplayMode,
    ]
  );
  const contentId = insert.rows[0]?.id;
  if (!contentId) {
    throw new Error('content_create_failed');
  }
  return contentId;
};

export const updateContentRow = async (
  client: InstanceScopedClient,
  input: UpdateContentInput,
  next: {
    readonly organizationId: string | null;
    readonly authorDisplayMode: ContentRow['author_display_mode'];
    readonly authorDisplayName: string;
    readonly title: string;
    readonly payloadJson: string;
    readonly status: string;
    readonly validationState: string;
    readonly publishedAt: string | null;
    readonly publishFrom: string | null;
    readonly publishUntil: string | null;
    readonly ownerUserId: string | null;
    readonly ownerOrganizationId: string | null;
  }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.contents
SET
  organization_id = $3::uuid,
  owner_user_id = CASE WHEN $14::boolean THEN $15::uuid ELSE owner_user_id END,
  owner_organization_id = CASE WHEN $14::boolean THEN $16::uuid ELSE owner_organization_id END,
  author_display_mode = $4,
  author_display_name = $5,
  title = $6,
  payload_json = $7::jsonb,
  status = $8,
  validation_state = $9,
  published_at = COALESCE($10::timestamptz, CASE WHEN $8 = 'published' THEN NOW() ELSE NULL END),
  publish_from = $11::timestamptz,
  publish_until = $12::timestamptz,
  updated_at = NOW(),
  updater_account_id = $13::uuid
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [
      input.instanceId,
      input.contentId,
      next.organizationId,
      next.authorDisplayMode,
      next.authorDisplayName,
      next.title,
      next.payloadJson,
      next.status,
      next.validationState,
      next.publishedAt,
      next.publishFrom,
      next.publishUntil,
      input.actorAccountId,
      Boolean(input.confirmedExternalOwner),
      next.ownerUserId,
      next.ownerOrganizationId,
    ]
  );
};

export const updateContentRevisionRefs = async (
  client: InstanceScopedClient,
  instanceId: string,
  contentId: string,
  historyId: string
): Promise<void> => {
  await client.query(
    `
UPDATE iam.contents
SET history_ref = $3, current_revision_ref = $3
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [instanceId, contentId, historyId]
  );
};
