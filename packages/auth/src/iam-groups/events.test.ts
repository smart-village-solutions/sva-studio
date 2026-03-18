import { describe, expect, it, vi } from 'vitest';

import type { GroupEvent } from './events';
import { publishGroupEvent } from './events';

const makeClient = () => ({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) });

describe('publishGroupEvent', () => {
  it('ruft pg_notify für RolePermissionChanged auf', async () => {
    const client = makeClient();
    const event: GroupEvent = {
      event: 'RolePermissionChanged',
      instanceId: 'inst-1',
      roleId: 'role-abc',
      requestId: 'req-1',
      traceId: 'trace-1',
    };

    await publishGroupEvent(client, event);

    expect(client.query).toHaveBeenCalledOnce();
    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toContain('pg_notify');
    expect(params[0]).toBe('iam_permission_snapshot_invalidation');

    const payload = JSON.parse(params[1]);
    expect(payload.eventId).toBeTruthy();
    expect(payload.event).toBe('RolePermissionChanged');
    expect(payload.instanceId).toBe('inst-1');
    expect(payload.trigger).toBe('pg_notify');
    expect(payload.roleId).toBe('role-abc');
    expect(payload.requestId).toBe('req-1');
    expect(payload.traceId).toBe('trace-1');
  });

  it('ruft pg_notify für GroupMembershipChanged auf', async () => {
    const client = makeClient();
    const event: GroupEvent = {
      event: 'GroupMembershipChanged',
      instanceId: 'inst-2',
      groupId: 'group-xyz',
      accountId: 'user-123',
      keycloakSubject: 'kc-user-123',
      changeType: 'added',
    };

    await publishGroupEvent(client, event);

    expect(client.query).toHaveBeenCalledOnce();
    const payload = JSON.parse(client.query.mock.calls[0]![1][1]);
    expect(payload.event).toBe('GroupMembershipChanged');
    expect(payload.instanceId).toBe('inst-2');
    expect(payload.groupId).toBe('group-xyz');
    expect(payload.accountId).toBe('user-123');
    expect(payload.keycloakSubject).toBe('kc-user-123');
    expect(payload.changeType).toBe('added');
    // roleId darf nicht vorhanden sein
    expect(payload.roleId).toBeUndefined();
  });

  it('enthält keine requestId/traceId wenn nicht angegeben', async () => {
    const client = makeClient();
    const event: GroupEvent = {
      event: 'RolePermissionChanged',
      instanceId: 'inst-3',
      roleId: 'role-999',
    };

    await publishGroupEvent(client, event);

    const payload = JSON.parse(client.query.mock.calls[0]![1][1]);
    expect(payload.requestId).toBeUndefined();
    expect(payload.traceId).toBeUndefined();
  });

  it('ruft entfernte Membership korrekt ab', async () => {
    const client = makeClient();
    const event: GroupEvent = {
      event: 'GroupMembershipChanged',
      instanceId: 'inst-4',
      groupId: 'group-abc',
      accountId: 'user-456',
      keycloakSubject: 'kc-user-456',
      changeType: 'removed',
    };

    await publishGroupEvent(client, event);

    const payload = JSON.parse(client.query.mock.calls[0]![1][1]);
    expect(payload.changeType).toBe('removed');
  });

  it('ruft pg_notify für GroupDeleted auf', async () => {
    const client = makeClient();

    await publishGroupEvent(client, {
      event: 'GroupDeleted',
      instanceId: 'inst-5',
      groupId: 'group-deleted',
      affectedAccountIds: ['acc-1', 'acc-2'],
      affectedKeycloakSubjects: ['kc-1', 'kc-2'],
    });

    const payload = JSON.parse(client.query.mock.calls[0]![1][1]);
    expect(payload.event).toBe('GroupDeleted');
    expect(payload.groupId).toBe('group-deleted');
    expect(payload.affectedAccountIds).toEqual(['acc-1', 'acc-2']);
    expect(payload.affectedKeycloakSubjects).toEqual(['kc-1', 'kc-2']);
  });
});
