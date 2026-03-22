import type { EffectivePermission } from '@sva/core';
import type { SnapshotInvalidationEvent } from './iam-authorization/snapshot-invalidation.server.js';

export interface PermissionSnapshotKey {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly organizationId?: string;
  readonly version: number;
}

export interface PermissionSnapshot {
  readonly permissions: readonly EffectivePermission[];
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly version: number;
  readonly snapshotVersion?: string;
}

export interface CacheLookupResult {
  readonly status: 'hit' | 'miss' | 'stale';
  readonly snapshot?: PermissionSnapshot;
  readonly ttlRemainingSeconds?: number;
  readonly ageSeconds?: number;
}

const formatSnapshotKey = (key: PermissionSnapshotKey): string => {
  return [
    'iam',
    'permission-snapshot',
    key.instanceId,
    key.keycloakSubject,
    key.organizationId ?? 'global',
    `v${key.version}`,
  ].join(':');
};

const userScopeKey = (instanceId: string, keycloakSubject: string): string => `${instanceId}:${keycloakSubject}`;

export class PermissionSnapshotCache {
  private readonly snapshots = new Map<string, PermissionSnapshot>();
  private readonly versions = new Map<string, number>();
  private readonly defaultVersion = 1;

  public constructor(
    private readonly ttlMs = 300_000,
    private readonly maxStaleMs = 300_000
  ) {}

  public getVersion(instanceId: string, keycloakSubject: string): number {
    return this.versions.get(userScopeKey(instanceId, keycloakSubject)) ?? this.defaultVersion;
  }

  public bumpVersion(instanceId: string, keycloakSubject: string): number {
    const key = userScopeKey(instanceId, keycloakSubject);
    const next = (this.versions.get(key) ?? this.defaultVersion) + 1;
    this.versions.set(key, next);
    this.deleteByScope(instanceId, keycloakSubject);
    return next;
  }

  public set(
    key: Omit<PermissionSnapshotKey, 'version'>,
    permissions: readonly EffectivePermission[],
    nowMs = Date.now(),
    snapshotVersion?: string
  ): PermissionSnapshot {
    const version = this.getVersion(key.instanceId, key.keycloakSubject);
    const snapshot: PermissionSnapshot = {
      permissions,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + this.ttlMs,
      version,
      snapshotVersion,
    };
    this.snapshots.set(
      formatSnapshotKey({
        ...key,
        version,
      }),
      snapshot
    );
    return snapshot;
  }

  public get(key: Omit<PermissionSnapshotKey, 'version'>, nowMs = Date.now()): CacheLookupResult {
    const version = this.getVersion(key.instanceId, key.keycloakSubject);
    const snapshot = this.snapshots.get(formatSnapshotKey({ ...key, version }));
    if (!snapshot) {
      return { status: 'miss' };
    }

    const ttlRemainingMs = snapshot.expiresAtMs - nowMs;
    if (ttlRemainingMs > 0) {
      return {
        status: 'hit',
        snapshot,
        ttlRemainingSeconds: Math.ceil(ttlRemainingMs / 1000),
      };
    }

    const ageMs = nowMs - snapshot.createdAtMs;
    if (ageMs <= this.maxStaleMs) {
      return {
        status: 'stale',
        snapshot,
        ageSeconds: Math.ceil(ageMs / 1000),
      };
    }

    this.snapshots.delete(formatSnapshotKey({ ...key, version }));
    return {
      status: 'stale',
      ageSeconds: Math.ceil(ageMs / 1000),
    };
  }

  public invalidate(input: { instanceId: string; keycloakSubject?: string }): number {
    if (input.keycloakSubject) {
      return this.bumpVersion(input.instanceId, input.keycloakSubject);
    }

    let invalidated = 0;
    for (const key of this.versions.keys()) {
      if (key.startsWith(`${input.instanceId}:`)) {
        const [, keycloakSubject] = key.split(':');
        if (!keycloakSubject) {
          continue;
        }
        this.bumpVersion(input.instanceId, keycloakSubject);
        invalidated += 1;
      }
    }
    return invalidated;
  }

  public size(): number {
    return this.snapshots.size;
  }

  private deleteByScope(instanceId: string, keycloakSubject: string): void {
    const prefix = `iam:permission-snapshot:${instanceId}:${keycloakSubject}:`;
    for (const key of this.snapshots.keys()) {
      if (key.startsWith(prefix)) {
        this.snapshots.delete(key);
      }
    }
  }
}

export interface CacheInvalidationEvent {
  readonly instanceId: string;
  readonly keycloakSubject?: string;
  readonly trigger: 'pg_notify' | 'ttl' | 'recompute';
  readonly eventId?: string;
  readonly event: SnapshotInvalidationEvent;
}

export const parseInvalidationEvent = (payloadRaw: string): CacheInvalidationEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadRaw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const typed = parsed as Record<string, unknown>;
  if (typeof typed.instanceId !== 'string' || typed.instanceId.trim().length === 0) {
    return null;
  }

  const rawTrigger = typed.trigger;
  const trigger =
    rawTrigger === 'ttl' || rawTrigger === 'recompute' ? rawTrigger : 'pg_notify';
  const eventId = typeof typed.eventId === 'string' ? typed.eventId : undefined;
  const keycloakSubject = typeof typed.keycloakSubject === 'string' ? typed.keycloakSubject : undefined;
  const eventName = typeof typed.event === 'string' ? typed.event : undefined;

  if (eventName === 'RolePermissionChanged' && typeof typed.roleId === 'string') {
    return {
      instanceId: typed.instanceId,
      trigger,
      eventId,
      event: {
        type: 'role_permission_changed',
        instanceId: typed.instanceId,
        roleId: typed.roleId,
        eventId,
      },
    };
  }

  if (
    eventName === 'GroupMembershipChanged' &&
    typeof typed.groupId === 'string' &&
    typeof typed.accountId === 'string'
  ) {
    return {
      instanceId: typed.instanceId,
      keycloakSubject,
      trigger,
      eventId,
      event: {
        type: 'group_membership_changed',
        instanceId: typed.instanceId,
        groupId: typed.groupId,
        accountId: typed.accountId,
        ...(keycloakSubject ? { keycloakSubject } : {}),
        eventId,
      },
    };
  }

  if (
    eventName === 'GroupDeleted' &&
    typeof typed.groupId === 'string' &&
    Array.isArray(typed.affectedAccountIds)
  ) {
    const affectedKeycloakSubjects = Array.isArray(typed.affectedKeycloakSubjects)
      ? typed.affectedKeycloakSubjects.filter((value): value is string => typeof value === 'string')
      : undefined;
    return {
      instanceId: typed.instanceId,
      keycloakSubject,
      trigger,
      eventId,
      event: {
        type: 'group_deleted',
        instanceId: typed.instanceId,
        groupId: typed.groupId,
        affectedAccountIds: typed.affectedAccountIds.filter(
          (value): value is string => typeof value === 'string'
        ),
        ...(affectedKeycloakSubjects ? { affectedKeycloakSubjects } : {}),
        eventId,
      },
    };
  }

  return {
    instanceId: typed.instanceId,
    keycloakSubject,
    trigger,
    eventId,
    event: keycloakSubject
      ? {
          type: 'user_scope_changed',
          instanceId: typed.instanceId,
          keycloakSubject,
          eventId,
          ...(typeof typed.reason === 'string' ? { reason: typed.reason } : {}),
        }
      : {
          type: 'instance_scope_changed',
          instanceId: typed.instanceId,
          eventId,
          ...(typeof typed.reason === 'string' ? { reason: typed.reason } : {}),
        },
  };
};
