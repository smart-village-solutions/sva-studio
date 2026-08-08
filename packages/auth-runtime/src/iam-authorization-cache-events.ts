import type { SnapshotInvalidationEvent } from './iam-authorization/snapshot-invalidation.server.js';

export interface CacheInvalidationEvent {
  readonly instanceId: string;
  readonly keycloakSubject?: string;
  readonly trigger: 'pg_notify' | 'ttl' | 'recompute';
  readonly eventId?: string;
  readonly revision?: Readonly<{
    scope: 'instance' | 'user';
    value: number;
  }>;
  readonly event: SnapshotInvalidationEvent;
}

type ParsedInvalidationPayload = {
  instanceId: string;
  trigger: CacheInvalidationEvent['trigger'];
  eventId?: string;
  keycloakSubject?: string;
  eventName?: string;
  raw: Record<string, unknown>;
};

const parsePositiveSafeInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;

const parsePermissionRevisionChanged = (
  payload: ParsedInvalidationPayload
): CacheInvalidationEvent | null => {
  if (payload.eventName !== 'PermissionRevisionChanged') {
    return null;
  }

  const revisionScope = payload.raw.revisionScope;
  const newRevision = parsePositiveSafeInteger(payload.raw.newRevision);
  if ((revisionScope !== 'instance' && revisionScope !== 'user') || !newRevision) {
    return null;
  }
  if (revisionScope === 'user' && !payload.keycloakSubject) {
    return null;
  }

  return {
    instanceId: payload.instanceId,
    ...(payload.keycloakSubject ? { keycloakSubject: payload.keycloakSubject } : {}),
    trigger: payload.trigger,
    eventId: payload.eventId,
    revision: { scope: revisionScope, value: newRevision },
    event:
      revisionScope === 'user'
        ? {
            type: 'user_scope_changed',
            instanceId: payload.instanceId,
            keycloakSubject: payload.keycloakSubject!,
            eventId: payload.eventId,
            reason: 'permission_revision_changed',
          }
        : {
            type: 'instance_scope_changed',
            instanceId: payload.instanceId,
            eventId: payload.eventId,
            reason: 'permission_revision_changed',
          },
  };
};

const parsePayloadRecord = (payloadRaw: string): ParsedInvalidationPayload | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadRaw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const raw = parsed as Record<string, unknown>;
  if (typeof raw.instanceId !== 'string' || raw.instanceId.trim().length === 0) {
    return null;
  }

  return {
    instanceId: raw.instanceId,
    trigger: raw.trigger === 'ttl' || raw.trigger === 'recompute' ? raw.trigger : 'pg_notify',
    eventId: typeof raw.eventId === 'string' ? raw.eventId : undefined,
    keycloakSubject: typeof raw.keycloakSubject === 'string' ? raw.keycloakSubject : undefined,
    eventName: typeof raw.event === 'string' ? raw.event : undefined,
    raw,
  };
};

const parseRolePermissionChanged = (payload: ParsedInvalidationPayload): CacheInvalidationEvent | null =>
  payload.eventName === 'RolePermissionChanged' && typeof payload.raw.roleId === 'string'
    ? {
        instanceId: payload.instanceId,
        trigger: payload.trigger,
        eventId: payload.eventId,
        event: {
          type: 'role_permission_changed',
          instanceId: payload.instanceId,
          roleId: payload.raw.roleId,
          eventId: payload.eventId,
        },
      }
    : null;

const parseGroupMembershipChanged = (payload: ParsedInvalidationPayload): CacheInvalidationEvent | null =>
  payload.eventName === 'GroupMembershipChanged' &&
  typeof payload.raw.groupId === 'string' &&
  typeof payload.raw.accountId === 'string'
    ? {
        instanceId: payload.instanceId,
        keycloakSubject: payload.keycloakSubject,
        trigger: payload.trigger,
        eventId: payload.eventId,
        event: {
          type: 'group_membership_changed',
          instanceId: payload.instanceId,
          groupId: payload.raw.groupId,
          accountId: payload.raw.accountId,
          ...(payload.keycloakSubject ? { keycloakSubject: payload.keycloakSubject } : {}),
          eventId: payload.eventId,
        },
      }
    : null;

const parseGroupDeleted = (payload: ParsedInvalidationPayload): CacheInvalidationEvent | null => {
  if (payload.eventName !== 'GroupDeleted' || typeof payload.raw.groupId !== 'string' || !Array.isArray(payload.raw.affectedAccountIds)) {
    return null;
  }

  const affectedKeycloakSubjects = Array.isArray(payload.raw.affectedKeycloakSubjects)
    ? payload.raw.affectedKeycloakSubjects.filter((value): value is string => typeof value === 'string')
    : undefined;
  return {
    instanceId: payload.instanceId,
    keycloakSubject: payload.keycloakSubject,
    trigger: payload.trigger,
    eventId: payload.eventId,
    event: {
      type: 'group_deleted',
      instanceId: payload.instanceId,
      groupId: payload.raw.groupId,
      affectedAccountIds: payload.raw.affectedAccountIds.filter((value): value is string => typeof value === 'string'),
      ...(affectedKeycloakSubjects ? { affectedKeycloakSubjects } : {}),
      eventId: payload.eventId,
    },
  };
};

const parseDefaultEvent = (payload: ParsedInvalidationPayload): CacheInvalidationEvent => ({
  instanceId: payload.instanceId,
  keycloakSubject: payload.keycloakSubject,
  trigger: payload.trigger,
  eventId: payload.eventId,
  event: payload.keycloakSubject
    ? {
        type: 'user_scope_changed',
        instanceId: payload.instanceId,
        keycloakSubject: payload.keycloakSubject,
        eventId: payload.eventId,
        ...(typeof payload.raw.reason === 'string' ? { reason: payload.raw.reason } : {}),
      }
    : {
        type: 'instance_scope_changed',
        instanceId: payload.instanceId,
        eventId: payload.eventId,
        ...(typeof payload.raw.reason === 'string' ? { reason: payload.raw.reason } : {}),
      },
});

export const parseInvalidationEvent = (payloadRaw: string): CacheInvalidationEvent | null => {
  const payload = parsePayloadRecord(payloadRaw);
  if (!payload) {
    return null;
  }

  if (payload.eventName === 'PermissionRevisionChanged') {
    return parsePermissionRevisionChanged(payload);
  }

  return (
    parseRolePermissionChanged(payload) ??
    parseGroupMembershipChanged(payload) ??
    parseGroupDeleted(payload) ??
    parseDefaultEvent(payload)
  );
};
