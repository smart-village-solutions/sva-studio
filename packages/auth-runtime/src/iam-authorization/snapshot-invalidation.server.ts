import { createSdkLogger } from '@sva/server-runtime';

import { invalidateRedisPermissionSnapshots } from './redis-permission-snapshot.server.js';

const logger = createSdkLogger({ component: 'iam-snapshot-invalidation', level: 'info' });

export type SnapshotInvalidationDeps = Readonly<{
  invalidateSnapshots: (instanceId: string, keycloakSubject?: string) => Promise<number>;
}>;

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

const defaultSnapshotInvalidationDeps: SnapshotInvalidationDeps = {
  invalidateSnapshots: invalidateRedisPermissionSnapshots,
};

const invalidateInstanceSnapshots = async (
  deps: SnapshotInvalidationDeps,
  instanceId: string
): Promise<void> => {
  await deps.invalidateSnapshots(instanceId);
};

const invalidateUserSnapshots = async (
  deps: SnapshotInvalidationDeps,
  instanceId: string,
  keycloakSubject?: string
): Promise<void> => {
  await deps.invalidateSnapshots(instanceId, keycloakSubject);
};

const handleGroupDeletedEvent = async (
  event: Extract<SnapshotInvalidationEvent, { type: 'group_deleted' }>,
  deps: SnapshotInvalidationDeps
): Promise<void> => {
  const affectedKeycloakSubjects = event.affectedKeycloakSubjects ?? [];
  if (affectedKeycloakSubjects.length === 0) {
    await invalidateInstanceSnapshots(deps, event.instanceId);
    return;
  }

  for (const keycloakSubject of affectedKeycloakSubjects) {
    await invalidateUserSnapshots(deps, event.instanceId, keycloakSubject);
  }
};

const snapshotInvalidationHandlers = {
  instance_scope_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'instance_scope_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateInstanceSnapshots(deps, event.instanceId),
  user_scope_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'user_scope_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateUserSnapshots(deps, event.instanceId, event.keycloakSubject),
  role_permission_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'role_permission_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateInstanceSnapshots(deps, event.instanceId),
  group_membership_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'group_membership_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateUserSnapshots(deps, event.instanceId, event.keycloakSubject),
  group_deleted: handleGroupDeletedEvent,
  delegation_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'delegation_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateUserSnapshots(deps, event.instanceId, event.delegateeKeycloakSubject),
  organization_membership_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'organization_membership_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateUserSnapshots(deps, event.instanceId, event.keycloakSubject),
  account_role_assignment_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'account_role_assignment_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateUserSnapshots(deps, event.instanceId, event.keycloakSubject),
  org_hierarchy_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'org_hierarchy_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateInstanceSnapshots(deps, event.instanceId),
  geo_assignment_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'geo_assignment_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateInstanceSnapshots(deps, event.instanceId),
  instance_settings_changed: async (
    event: Extract<SnapshotInvalidationEvent, { type: 'instance_settings_changed' }>,
    deps: SnapshotInvalidationDeps
  ) => invalidateInstanceSnapshots(deps, event.instanceId),
} satisfies {
  [Type in SnapshotInvalidationEvent['type']]: (
    event: Extract<SnapshotInvalidationEvent, { type: Type }>,
    deps: SnapshotInvalidationDeps
  ) => Promise<void>;
};

const dispatchSnapshotInvalidationEvent = async (
  event: SnapshotInvalidationEvent,
  deps: SnapshotInvalidationDeps
): Promise<void> => {
  switch (event.type) {
    case 'instance_scope_changed':
      return snapshotInvalidationHandlers.instance_scope_changed(event, deps);
    case 'user_scope_changed':
      return snapshotInvalidationHandlers.user_scope_changed(event, deps);
    case 'role_permission_changed':
      return snapshotInvalidationHandlers.role_permission_changed(event, deps);
    case 'group_membership_changed':
      return snapshotInvalidationHandlers.group_membership_changed(event, deps);
    case 'group_deleted':
      return snapshotInvalidationHandlers.group_deleted(event, deps);
    case 'delegation_changed':
      return snapshotInvalidationHandlers.delegation_changed(event, deps);
    case 'organization_membership_changed':
      return snapshotInvalidationHandlers.organization_membership_changed(event, deps);
    case 'account_role_assignment_changed':
      return snapshotInvalidationHandlers.account_role_assignment_changed(event, deps);
    case 'org_hierarchy_changed':
      return snapshotInvalidationHandlers.org_hierarchy_changed(event, deps);
    case 'geo_assignment_changed':
      return snapshotInvalidationHandlers.geo_assignment_changed(event, deps);
    case 'instance_settings_changed':
      return snapshotInvalidationHandlers.instance_settings_changed(event, deps);
    default: {
      const _exhaustive: never = event;
      logger.warn('Unknown snapshot invalidation event type', {
        operation: 'snapshot_invalidation',
        event: _exhaustive,
      });
    }
  }
};

export const processSnapshotInvalidationEventWithDeps = async (
  event: SnapshotInvalidationEvent,
  deps: SnapshotInvalidationDeps
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

  await dispatchSnapshotInvalidationEvent(event, deps);
};

export const processSnapshotInvalidationEvent = async (
  event: SnapshotInvalidationEvent
): Promise<void> => processSnapshotInvalidationEventWithDeps(event, defaultSnapshotInvalidationDeps);
