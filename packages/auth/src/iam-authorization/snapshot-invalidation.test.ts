import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-x', traceId: 'trace-x', workspaceId: 'ws-x' }),
  withRequestContext: (_opts: unknown, fn: () => Promise<unknown>) => fn(),
}));

vi.mock('./redis-permission-snapshot.server', () => ({
  invalidateRedisPermissionSnapshots: vi.fn().mockResolvedValue(0),
}));

import { invalidateRedisPermissionSnapshots } from './redis-permission-snapshot.server';
import { processSnapshotInvalidationEvent } from './snapshot-invalidation.server';

const mockInvalidate = invalidateRedisPermissionSnapshots as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processSnapshotInvalidationEvent', () => {
  it('role_permission_changed → invalidiert gesamte Instanz (kein userId)', async () => {
    await processSnapshotInvalidationEvent({
      type: 'role_permission_changed',
      instanceId: 'inst-1',
      roleId: 'role-abc',
    });

    expect(mockInvalidate).toHaveBeenCalledOnce();
    expect(mockInvalidate).toHaveBeenCalledWith('inst-1');
    // kein zweites Argument (kein userId)
    expect(mockInvalidate.mock.calls[0]).toHaveLength(1);
  });

  it('group_membership_changed → invalidiert nur diesen User', async () => {
    await processSnapshotInvalidationEvent({
      type: 'group_membership_changed',
      instanceId: 'inst-2',
      accountId: 'user-42',
      groupId: 'group-x',
    });

    expect(mockInvalidate).toHaveBeenCalledWith('inst-2', 'user-42');
  });

  it('delegation_changed → invalidiert Delegatee', async () => {
    await processSnapshotInvalidationEvent({
      type: 'delegation_changed',
      instanceId: 'inst-3',
      delegateeAccountId: 'delegatee-99',
    });

    expect(mockInvalidate).toHaveBeenCalledWith('inst-3', 'delegatee-99');
  });

  it('organization_membership_changed → invalidiert diesen User', async () => {
    await processSnapshotInvalidationEvent({
      type: 'organization_membership_changed',
      instanceId: 'inst-4',
      accountId: 'user-org-1',
    });

    expect(mockInvalidate).toHaveBeenCalledWith('inst-4', 'user-org-1');
  });

  it('account_role_assignment_changed → invalidiert diesen User', async () => {
    await processSnapshotInvalidationEvent({
      type: 'account_role_assignment_changed',
      instanceId: 'inst-5',
      accountId: 'user-role-1',
      roleId: 'role-xyz',
    });

    expect(mockInvalidate).toHaveBeenCalledWith('inst-5', 'user-role-1');
  });

  it('instance_settings_changed → invalidiert gesamte Instanz', async () => {
    await processSnapshotInvalidationEvent({
      type: 'instance_settings_changed',
      instanceId: 'inst-6',
    });

    expect(mockInvalidate).toHaveBeenCalledWith('inst-6');
    expect(mockInvalidate.mock.calls[0]).toHaveLength(1);
  });

  it('fällt bei unbekanntem Event-Typ in den default-Zweig (exhaustive guard)', async () => {
    // Erzwingt zur Laufzeit den default-Zweig der exhaustive-switch-Absicherung.
    await processSnapshotInvalidationEvent({
      // @ts-expect-error Testet bewusst einen ungültigen Event-Typ zur Laufzeit.
      type: 'unknown_event_type',
      instanceId: 'inst-7',
    });

    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
