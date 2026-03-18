import { randomUUID } from 'node:crypto';

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
  eventId?: string;
  requestId?: string;
  traceId?: string;
};

type GroupMembershipChangedEvent = {
  event: 'GroupMembershipChanged';
  instanceId: string;
  groupId: string;
  accountId: string;
  keycloakSubject?: string;
  changeType: 'added' | 'removed';
  eventId?: string;
  requestId?: string;
  traceId?: string;
};

type GroupDeletedEvent = {
  event: 'GroupDeleted';
  instanceId: string;
  groupId: string;
  affectedAccountIds: readonly string[];
  affectedKeycloakSubjects?: readonly string[];
  eventId?: string;
  requestId?: string;
  traceId?: string;
};

export type GroupEvent = RolePermissionChangedEvent | GroupMembershipChangedEvent | GroupDeletedEvent;

export const publishGroupEvent = async (client: QueryClient, event: GroupEvent): Promise<void> => {
  const eventId = event.eventId ?? randomUUID();
  await client.query('SELECT pg_notify($1, $2);', [
    INVALIDATION_CHANNEL,
    JSON.stringify({
      eventId,
      event: event.event,
      instanceId: event.instanceId,
      trigger: 'pg_notify',
      ...(event.event === 'GroupMembershipChanged'
        ? {
            groupId: event.groupId,
            accountId: event.accountId,
            ...(event.keycloakSubject ? { keycloakSubject: event.keycloakSubject } : {}),
            changeType: event.changeType,
          }
        : event.event === 'GroupDeleted'
          ? {
              groupId: event.groupId,
              affectedAccountIds: event.affectedAccountIds,
              ...(event.affectedKeycloakSubjects
                ? { affectedKeycloakSubjects: event.affectedKeycloakSubjects }
                : {}),
            }
          : { roleId: event.roleId }),
      ...(event.requestId ? { requestId: event.requestId } : {}),
      ...(event.traceId ? { traceId: event.traceId } : {}),
    }),
  ]);
};
