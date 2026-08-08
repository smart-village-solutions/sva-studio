import type { QueryClient } from '../db.js';
import { bumpPermissionRevisionWithClient } from '../iam-authorization/permission-revision-store.js';

// ---------------------------------------------------------------------------
// Gruppen-Events über pg_notify
// Invalidiert Snapshot-Cache aller betroffenen Nutzer (Phase 4 ersetzt dies durch Redis Pub/Sub).
// ---------------------------------------------------------------------------

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
  await bumpPermissionRevisionWithClient(
    client,
    event.event === 'GroupMembershipChanged' && event.keycloakSubject
      ? {
          kind: 'user',
          instanceId: event.instanceId,
          keycloakSubject: event.keycloakSubject,
        }
      : { kind: 'instance', instanceId: event.instanceId }
  );
};
