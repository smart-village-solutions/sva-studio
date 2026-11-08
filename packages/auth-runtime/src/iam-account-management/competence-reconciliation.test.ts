import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  registry: new Map<string, { operations: { operation: string }[] }>(),
  bump: vi.fn(),
}));
vi.mock('../iam-authorization/permission-revision-store.js', () => ({
  bumpPermissionRevisionWithClient: state.bump,
}));
vi.mock('../iam-instance-registry/plugin-activation-policy-snapshot.js', () => ({
  readInstanceRegistryPluginTenantLifecycleRegistry: () => state.registry,
}));
import { notifyPermissionInvalidation } from './shared-activity.js';

it('durably queues competence reconciliation in the account transaction', async () => {
  state.registry.set('ssf', { operations: [{ operation: 'reconcile' }] });
  const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ eligible: true }] });
  await notifyPermissionInvalidation(
    { query },
    {
      instanceId: 'tenant-a',
      keycloakSubject: 'reviewer',
      trigger: 'user_competence_languages_changed',
    }
  );
  const queued = query.mock.calls.find(([sql]) => String(sql).includes('sva_enqueue_job'));
  expect(queued).toBeDefined();
  expect(queued?.[1]).toEqual(
    expect.arrayContaining([
      'plugin_tenant_lifecycle_retry',
      JSON.stringify({ instanceId: 'tenant-a', pluginId: 'ssf', operation: 'reconcile' }),
    ])
  );
});

it.each([false, undefined])(
  'does not queue for inactive, suspended or missing tenant/module (%s)',
  async (eligible) => {
    state.registry.set('ssf', { operations: [{ operation: 'reconcile' }] });
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ eligible }] });
    await notifyPermissionInvalidation(
      { query },
      { instanceId: 'tenant-b', trigger: 'user_competence_languages_changed' }
    );
    expect(query.mock.calls.some(([sql]) => String(sql).includes('sva_enqueue_job'))).toBe(false);
  }
);
it('does not load SSF or queue when its lifecycle is not configured', async () => {
  state.registry.clear();
  const query = vi.fn();
  await notifyPermissionInvalidation(
    { query },
    { instanceId: 'tenant-a', trigger: 'user_competence_languages_changed' }
  );
  expect(query).not.toHaveBeenCalled();
});
it('propagates durable enqueue failure so the managed account transaction rolls back', async () => {
  state.registry.set('ssf', { operations: [{ operation: 'reconcile' }] });
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ eligible: true }] })
    .mockRejectedValueOnce(new Error('queue unavailable'));
  await expect(
    notifyPermissionInvalidation(
      { query },
      { instanceId: 'tenant-a', trigger: 'user_competence_languages_changed' }
    )
  ).rejects.toThrow('queue unavailable');
});
