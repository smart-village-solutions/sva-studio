import { resolveIamContentDomainCapabilityForPrimitiveAction, type IamContentPrimitiveAction } from '@sva/core';
import { emitActivityLog, type withInstanceScopedDb } from '../iam-account-management/shared.js';
import type { ContentRow, CreateContentInput, DeleteContentInput, UpdateContentInput } from './repository-types.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

const buildContentActionAuditPayload = (primitiveAction: IamContentPrimitiveAction) => ({
  action: primitiveAction,
  domain_capability: resolveIamContentDomainCapabilityForPrimitiveAction(primitiveAction) ?? null,
  primitive_action: primitiveAction,
});

export const validatePublicationWindow = (input: { publishFrom?: string; publishUntil?: string }) => {
  if (
    input.publishFrom &&
    input.publishUntil &&
    new Date(input.publishFrom).getTime() > new Date(input.publishUntil).getTime()
  ) {
    throw new Error('content_publication_window_invalid');
  }
};

export const insertContentRow = async (
  client: InstanceScopedClient,
  input: CreateContentInput
): Promise<string> => {
  const insert = await client.query<{ id: string }>(
    `
INSERT INTO iam.contents (
  id, instance_id, content_type, organization_id, owner_subject_id, title,
  published_at, publish_from, publish_until, author_account_id, author_display_name,
  payload_json, status, validation_state, history_ref
)
VALUES (
  gen_random_uuid(), $1, $2, $3::uuid, $4, $5,
  COALESCE($6::timestamptz, CASE WHEN $10 = 'published' THEN NOW() ELSE NULL END),
  $7::timestamptz, $8::timestamptz, $9::uuid, $11, $12::jsonb, $10, $13,
  gen_random_uuid()::text
)
RETURNING id;
`,
    [
      input.instanceId,
      input.contentType,
      input.organizationId ?? null,
      input.ownerSubjectId ?? null,
      input.title,
      input.publishedAt ?? null,
      input.publishFrom ?? null,
      input.publishUntil ?? null,
      input.actorAccountId,
      input.status,
      input.actorDisplayName,
      JSON.stringify(input.payload),
      input.validationState ?? 'valid',
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
    readonly ownerSubjectId: string | null;
    readonly title: string;
    readonly payloadJson: string;
    readonly status: string;
    readonly validationState: string;
    readonly publishedAt: string | null;
    readonly publishFrom: string | null;
    readonly publishUntil: string | null;
  }
): Promise<void> => {
  await client.query(
    `
UPDATE iam.contents
SET
  organization_id = $3::uuid,
  owner_subject_id = $4,
  title = $5,
  payload_json = $6::jsonb,
  status = $7,
  validation_state = $8,
  published_at = COALESCE($9::timestamptz, CASE WHEN $7 = 'published' THEN NOW() ELSE NULL END),
  publish_from = $10::timestamptz,
  publish_until = $11::timestamptz,
  updated_at = NOW(),
  author_account_id = $12::uuid,
  author_display_name = $13
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [
      input.instanceId,
      input.contentId,
      next.organizationId,
      next.ownerSubjectId,
      next.title,
      next.payloadJson,
      next.status,
      next.validationState,
      next.publishedAt,
      next.publishFrom,
      next.publishUntil,
      input.actorAccountId,
      input.actorDisplayName,
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

export const emitContentCreatedActivity = (
  client: InstanceScopedClient,
  input: CreateContentInput,
  contentId: string
): Promise<void> =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.content.created',
    result: 'success',
    payload: {
      content_id: contentId,
      content_type: input.contentType,
      ...buildContentActionAuditPayload('content.create'),
      title: input.title,
      status: input.status,
      payload_change: 'payload_created',
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });

export const emitContentDeletedActivity = (
  client: InstanceScopedClient,
  input: DeleteContentInput,
  current: ContentRow
): Promise<void> =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.content.deleted',
    result: 'success',
    payload: {
      content_id: input.contentId,
      content_type: current.content_type,
      ...buildContentActionAuditPayload('content.delete'),
      title: current.title,
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });

export const emitContentUpdatedActivity = (
  client: InstanceScopedClient,
  input: UpdateContentInput,
  current: ContentRow,
  event: {
    readonly eventType: 'iam.content.created' | 'iam.content.status_changed' | 'iam.content.updated';
    readonly action: IamContentPrimitiveAction;
    readonly changedFields: readonly string[];
    readonly nextStatus: string;
    readonly nextTitle: string;
  }
): Promise<void> =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: event.eventType,
    result: 'success',
    payload: {
      content_id: input.contentId,
      content_type: current.content_type,
      ...buildContentActionAuditPayload(event.action),
      title: event.nextTitle,
      changed_fields: event.changedFields,
      previous_status: current.status,
      next_status: event.nextStatus,
      payload_change: event.changedFields.includes('payload') ? 'payload_updated' : 'payload_unchanged',
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });
