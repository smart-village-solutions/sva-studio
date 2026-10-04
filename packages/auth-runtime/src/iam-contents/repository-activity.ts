import {
  resolveIamContentDomainCapabilityForPrimitiveAction,
  type IamContentPrimitiveAction,
  type IamContentOwnerPrincipal,
} from '@sva/core';
import { emitActivityLog, type withInstanceScopedDb } from '../iam-account-management/shared.js';
import { resolveCurrentOwnerPrincipal } from './repository-ownership.js';
import type {
  ContentRow,
  CreateContentInput,
  DeleteContentInput,
  UpdateContentInput,
} from './repository-types.js';

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
    readonly nextAuthorDisplayMode: ContentRow['author_display_mode'];
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
    ...(changedFields.has('authorDisplayMode')
      ? {
          authorDisplayMode: {
            previous: current.author_display_mode,
            next: event.nextAuthorDisplayMode,
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

export const emitExternalContentUpdatedActivity = (
  client: InstanceScopedClient,
  input: CreateContentInput,
  contentId: string,
  changedFields: readonly string[]
): Promise<void> =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.content.updated',
    result: 'success',
    payload: {
      content_id: contentId,
      content_type: input.contentType,
      ...buildContentActionAuditPayload('content.updatePayload'),
      title: input.title,
      changed_fields: changedFields,
      next_status: input.status,
      payload_change: changedFields.includes('payload') ? 'payload_updated' : 'payload_unchanged',
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
    readonly eventType:
      'iam.content.created' | 'iam.content.status_changed' | 'iam.content.updated';
    readonly action: IamContentPrimitiveAction;
    readonly changedFields: readonly string[];
    readonly nextStatus: string;
    readonly nextTitle: string;
    readonly nextOwnerUserId: string | null;
    readonly nextOwnerOrganizationId: string | null;
    readonly nextAuthorDisplayMode: ContentRow['author_display_mode'];
    readonly nextAuthorDisplayName: string;
  }
): Promise<void> => {
  if (input.confirmedExternalOwner) {
    const currentOwner = current.owner_user_id && current.owner_organization_id
      ? undefined
      : resolveCurrentOwnerPrincipal(current);
    const sourcePrincipal = currentOwner?.type === input.confirmedExternalOwner.type &&
      currentOwner.id === input.confirmedExternalOwner.id
      ? undefined
      : currentOwner;
    return emitContentOwnershipTransferredActivity(client, {
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      traceId: input.traceId,
      contentId: input.contentId,
      contentType: current.content_type,
      sourcePrincipal,
      targetPrincipal: input.confirmedExternalOwner,
    });
  }
  return emitActivityLog(client, {
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
      payload_change: event.changedFields.includes('payload')
        ? 'payload_updated'
        : 'payload_unchanged',
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });
};

export const emitContentOwnershipTransferredActivity = (
  client: InstanceScopedClient,
  input: {
    readonly instanceId: string;
    readonly actorAccountId: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly contentId: string;
    readonly contentType: string;
    readonly sourcePrincipal?: IamContentOwnerPrincipal;
    readonly targetPrincipal: IamContentOwnerPrincipal;
  }
): Promise<void> =>
  emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.actorAccountId,
    eventType: 'iam.content.ownership_transferred',
    result: 'success',
    payload: {
      content_id: input.contentId,
      content_type: input.contentType,
      ...buildContentActionAuditPayload('content.transferOwnership'),
      coverage: 'studio_mutations',
      ...(input.sourcePrincipal
        ? {
            source_principal: {
              type: input.sourcePrincipal.type,
              id: input.sourcePrincipal.id,
            },
          }
        : {}),
      target_principal: {
        type: input.targetPrincipal.type,
        id: input.targetPrincipal.id,
      },
      changed_fields: ['ownerUserId', 'ownerOrganizationId', 'organizationId'],
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });
