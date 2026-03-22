import { createSdkLogger } from '@sva/sdk/server';

import { invalidateRedisPermissionSnapshots } from './redis-permission-snapshot.server.js';

const logger = createSdkLogger({ component: 'iam-snapshot-invalidation', level: 'info' });

export type SnapshotInvalidationEvent =
  | { type: 'instance_scope_changed'; instanceId: string; eventId?: string; reason?: string }
  | { type: 'user_scope_changed'; instanceId: string; keycloakSubject: string; eventId?: string; reason?: string }
  | { type: 'role_permission_changed'; instanceId: string; roleId: string; eventId?: string }
  | {
      type: 'group_membership_changed';
      instanceId: string;
      accountId: string;
      groupId: string;
      keycloakSubject?: string;
      eventId?: string;
    }
  | {
      type: 'group_deleted';
      instanceId: string;
      groupId: string;
      affectedAccountIds: readonly string[];
      affectedKeycloakSubjects?: readonly string[];
      eventId?: string;
    }
  | {
      type: 'delegation_changed';
      instanceId: string;
      delegateeAccountId?: string;
      delegateeKeycloakSubject?: string;
      eventId?: string;
    }
  | {
      type: 'organization_membership_changed';
      instanceId: string;
      accountId?: string;
      keycloakSubject?: string;
      eventId?: string;
    }
  | {
      type: 'account_role_assignment_changed';
      instanceId: string;
      accountId?: string;
      keycloakSubject?: string;
      roleId: string;
      eventId?: string;
    }
  | { type: 'org_hierarchy_changed'; instanceId: string; affectedOrgIds: readonly string[]; eventId?: string }
  | { type: 'geo_assignment_changed'; instanceId: string; affectedGeoIds: readonly string[]; eventId?: string }
  | { type: 'instance_settings_changed'; instanceId: string; eventId?: string };

const processedEvents = new Map<string, number>();
const PROCESSED_EVENT_TTL_MS = 15 * 60 * 1000;

const pruneProcessedEvents = (nowMs: number): void => {
  for (const [eventId, expiresAt] of processedEvents.entries()) {
    if (expiresAt <= nowMs) {
      processedEvents.delete(eventId);
    }
  }
};

const shouldSkipEvent = (eventId: string | undefined): boolean => {
  if (!eventId) {
    return false;
  }

  const nowMs = Date.now();
  pruneProcessedEvents(nowMs);

  if (processedEvents.has(eventId)) {
    return true;
  }

  processedEvents.set(eventId, nowMs + PROCESSED_EVENT_TTL_MS);
  return false;
};

export const processSnapshotInvalidationEvent = async (
  event: SnapshotInvalidationEvent
): Promise<void> => {
  if (shouldSkipEvent(event.eventId)) {
    logger.debug('Skipping duplicate snapshot invalidation event', {
      operation: 'snapshot_invalidation',
      event_type: event.type,
      instance_id: event.instanceId,
      event_id: event.eventId,
    });
    return;
  }

  logger.info('Processing snapshot invalidation event', {
    operation: 'snapshot_invalidation',
    event_type: event.type,
    instance_id: event.instanceId,
    ...(event.eventId ? { event_id: event.eventId } : {}),
  });

  switch (event.type) {
    case 'instance_scope_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId);
      break;

    case 'user_scope_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId, event.keycloakSubject);
      break;

    case 'role_permission_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId);
      break;

    case 'group_membership_changed':
      await invalidateRedisPermissionSnapshots(
        event.instanceId,
        event.keycloakSubject
      );
      break;

    case 'group_deleted':
      if ((event.affectedKeycloakSubjects?.length ?? 0) > 0) {
        for (const keycloakSubject of event.affectedKeycloakSubjects ?? []) {
          await invalidateRedisPermissionSnapshots(event.instanceId, keycloakSubject);
        }
        break;
      }
      await invalidateRedisPermissionSnapshots(event.instanceId);
      break;

    case 'delegation_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId, event.delegateeKeycloakSubject);
      break;

    case 'organization_membership_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId, event.keycloakSubject);
      break;

    case 'account_role_assignment_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId, event.keycloakSubject);
      break;

    case 'org_hierarchy_changed':
    case 'geo_assignment_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId);
      break;

    case 'instance_settings_changed':
      await invalidateRedisPermissionSnapshots(event.instanceId);
      break;

    default: {
      const _exhaustive: never = event;
      logger.warn('Unknown snapshot invalidation event type', {
        operation: 'snapshot_invalidation',
        event: _exhaustive,
      });
    }
  }
};
