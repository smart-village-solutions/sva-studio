import type { QueryClient } from '../shared/db-helpers';

// ---------------------------------------------------------------------------
// Gruppen-Events über pg_notify
// Invalidiert Snapshot-Cache aller betroffenen Nutzer (Phase 4 ersetzt dies durch Redis Pub/Sub).
// ---------------------------------------------------------------------------

const INVALIDATION_CHANNEL = 'iam_permission_snapshot_invalidation';

type RolePermissionChangedEvent = {
  event: 'RolePermissionChanged';
  instanceId: string;
  roleId: string;
  requestId?: string;
  traceId?: string;
};

type GroupMembershipChangedEvent = {
  event: 'GroupMembershipChanged';
  instanceId: string;
  groupId: string;
  accountId: string;
  changeType: 'added' | 'removed';
  requestId?: string;
  traceId?: string;
};

export type GroupEvent = RolePermissionChangedEvent | GroupMembershipChangedEvent;

export const publishGroupEvent = async (client: QueryClient, event: GroupEvent): Promise<void> => {
  await client.query('SELECT pg_notify($1, $2);', [
    INVALIDATION_CHANNEL,
    JSON.stringify({
      instanceId: event.instanceId,
      trigger: 'group_event',
      reason: event.event,
      ...(event.event === 'GroupMembershipChanged'
        ? { groupId: event.groupId, accountId: event.accountId, changeType: event.changeType }
        : { roleId: event.roleId }),
      ...(event.requestId ? { requestId: event.requestId } : {}),
      ...(event.traceId ? { traceId: event.traceId } : {}),
    }),
  ]);
};
