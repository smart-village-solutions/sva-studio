import { resolveIamContentDomainCapabilityForPrimitiveAction, type IamContentPrimitiveAction } from '@sva/core';
import { emitActivityLog, type withInstanceScopedDb } from '../iam-account-management/shared.js';
import { resolveContentPublicationInvariant } from './content-publication-invariants.js';
import { ContentStateValidationError } from './repository-state-validation.js';
import type { ContentRow, CreateContentInput, DeleteContentInput, UpdateContentInput } from './repository-types.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

const buildContentActionAuditPayload = (primitiveAction: IamContentPrimitiveAction) => ({
  action: primitiveAction,
  domain_capability: resolveIamContentDomainCapabilityForPrimitiveAction(primitiveAction) ?? null,
  primitive_action: primitiveAction,
});

const buildContentFieldChanges = (
  current: ContentRow,
  event: {
    readonly changedFields: readonly string[];
    readonly nextOwnerUserId: string | null;
    readonly nextOwnerOrganizationId: string | null;
    readonly nextAuthorDisplayName: string;
  }
) => {
  const changedFields = new Set(event.changedFields);
  return {
    ...(changedFields.has('ownerUserId')
      ? {
          ownerUserId: {
            previous: current.owner_user_id,
            next: event.nextOwnerUserId,
          },
        }
      : {}),
    ...(changedFields.has('ownerOrganizationId')
      ? {
          ownerOrganizationId: {
            previous: current.owner_organization_id,
            next: event.nextOwnerOrganizationId,
          },
        }
      : {}),
    ...(changedFields.has('authorDisplayName')
      ? {
          authorDisplayName: {
            previous: current.author_display_name,
            next: event.nextAuthorDisplayName,
          },
        }
      : {}),
  };
};

const resolveCreateAuthorDisplayName = async (
  client: InstanceScopedClient,
  input: CreateContentInput
): Promise<string> => {
  if (!input.organizationId) {
    return input.actorDisplayName;
  }

  const result = await client.query<{ display_name: string }>(
    `
SELECT display_name
FROM iam.organizations
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.organizationId]
  );

  return result.rows[0]?.display_name ?? input.actorDisplayName;
};

export const validatePublicationWindow = (input: { publishFrom?: string; publishUntil?: string }) => {
  if (
    resolveContentPublicationInvariant({
      publishFrom: input.publishFrom,
      publishUntil: input.publishUntil,
    }) === 'content_publication_window_invalid'
  ) {
    throw new ContentStateValidationError('content_publication_window_invalid');
  }
};

export const insertContentRow = async (
  client: InstanceScopedClient,
  input: CreateContentInput
): Promise<string> => {
  const authorDisplayName = await resolveCreateAuthorDisplayName(client, input);
  const insert = await client.query<{ id: string }>(
    `
INSERT INTO iam.contents (
  id, instance_id, content_type, organization_id, owner_user_id, owner_organization_id, title,
  published_at, publish_from, publish_until, author_account_id, author_display_name,
  creator_account_id, updater_account_id,
  payload_json, status, validation_state, history_ref
)
VALUES (
  gen_random_uuid(), $1, $2, $3::uuid, $4::uuid, $5::uuid, $6,
  COALESCE($7::timestamptz, CASE WHEN $11 = 'published' THEN NOW() ELSE NULL END),
  $8::timestamptz, $9::timestamptz, $10::uuid, $12, $10::uuid, $10::uuid, $13::jsonb, $11, $14,
  gen_random_uuid()::text
)
RETURNING id;
`,
    [
      input.instanceId,
      input.contentType,
      input.organizationId ?? null,
      input.actorAccountId,
      input.organizationId ?? null,
      input.title,
      input.publishedAt ?? null,
      input.publishFrom ?? null,
      input.publishUntil ?? null,
      input.actorAccountId,
      input.status,
      authorDisplayName,
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
    readonly ownerUserId: string | null;
    readonly ownerOrganizationId: string | null;
    readonly authorDisplayName: string;
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
  owner_user_id = $4::uuid,
  owner_organization_id = $5::uuid,
  author_display_name = $6,
  title = $7,
  payload_json = $8::jsonb,
  status = $9,
  validation_state = $10,
  published_at = COALESCE($11::timestamptz, CASE WHEN $9 = 'published' THEN NOW() ELSE NULL END),
  publish_from = $12::timestamptz,
  publish_until = $13::timestamptz,
  updated_at = NOW(),
  updater_account_id = $14::uuid
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [
      input.instanceId,
      input.contentId,
      next.organizationId,
      next.ownerUserId,
      next.ownerOrganizationId,
      next.authorDisplayName,
      next.title,
      next.payloadJson,
      next.status,
      next.validationState,
      next.publishedAt,
      next.publishFrom,
      next.publishUntil,
      input.actorAccountId,
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
    readonly nextOwnerUserId: string | null;
    readonly nextOwnerOrganizationId: string | null;
    readonly nextAuthorDisplayName: string;
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
      field_changes: buildContentFieldChanges(current, event),
      payload_change: event.changedFields.includes('payload') ? 'payload_updated' : 'payload_unchanged',
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });
