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
    expect(payload.instanceId).toBe('inst-1');
    expect(payload.trigger).toBe('group_event');
    expect(payload.reason).toBe('RolePermissionChanged');
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
      changeType: 'added',
    };

    await publishGroupEvent(client, event);

    expect(client.query).toHaveBeenCalledOnce();
    const payload = JSON.parse(client.query.mock.calls[0]![1][1]);
    expect(payload.instanceId).toBe('inst-2');
    expect(payload.reason).toBe('GroupMembershipChanged');
    expect(payload.groupId).toBe('group-xyz');
    expect(payload.accountId).toBe('user-123');
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
      changeType: 'removed',
    };

    await publishGroupEvent(client, event);

    const payload = JSON.parse(client.query.mock.calls[0]![1][1]);
    expect(payload.changeType).toBe('removed');
  });
});
