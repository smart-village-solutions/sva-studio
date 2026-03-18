import { createSdkLogger } from '@sva/sdk/server';

import { invalidateRedisPermissionSnapshots } from './redis-permission-snapshot.server';

const logger = createSdkLogger({ component: 'iam-snapshot-invalidation', level: 'info' });

export type SnapshotInvalidationEvent =
  | { type: 'role_permission_changed'; instanceId: string; roleId: string }
  | { type: 'group_membership_changed'; instanceId: string; accountId: string; groupId: string }
  | { type: 'delegation_changed'; instanceId: string; delegateeAccountId: string }
  | { type: 'organization_membership_changed'; instanceId: string; accountId: string }
  | { type: 'account_role_assignment_changed'; instanceId: string; accountId: string; roleId: string }
  | { type: 'instance_settings_changed'; instanceId: string };

export const processSnapshotInvalidationEvent = async (
  event: SnapshotInvalidationEvent
): Promise<void> => {
  logger.info('Processing snapshot invalidation event', {
    operation: 'snapshot_invalidation',
    event_type: event.type,
    instance_id: event.instanceId,
  });

  switch (event.type) {
    case 'role_permission_changed':
      // A role's permissions changed — invalidate ALL snapshots for this instance
      // (we can't know which users have this role without a DB lookup)
      await invalidateRedisPermissionSnapshots(event.instanceId);
      break;

    case 'group_membership_changed':
      // A specific user's group membership changed — only invalidate that user
      await invalidateRedisPermissionSnapshots(event.instanceId, event.accountId);
      break;

    case 'delegation_changed':
      // A delegation change affects the delegatee's effective permissions
      await invalidateRedisPermissionSnapshots(event.instanceId, event.delegateeAccountId);
      break;

    case 'organization_membership_changed':
      // A user's org membership changed — invalidate their snapshots
      await invalidateRedisPermissionSnapshots(event.instanceId, event.accountId);
      break;

    case 'account_role_assignment_changed':
      // A direct role assignment changed for a specific user
      await invalidateRedisPermissionSnapshots(event.instanceId, event.accountId);
      break;

    case 'instance_settings_changed':
      // Instance-wide settings changed — invalidate all snapshots for the instance
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
