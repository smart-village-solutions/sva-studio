import { describe, expect, it, vi } from 'vitest';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

const state = vi.hoisted(() => ({
  capturedDeps: undefined as
    { readRoleCatalogFingerprint?: (instanceId: string) => Promise<string> } | undefined,
}));

vi.mock('./service.js', () => ({
  createInstanceRegistryService: (deps: typeof state.capturedDeps) => {
    state.capturedDeps = deps;
    return {};
  },
}));

import { createInstanceRegistryRuntime } from './runtime-wiring.js';

describe('scoped role catalog snapshot', () => {
  it('reads the uncommitted seed on the locked connection used by the queued run', async () => {
    const events: string[] = [];
    let seeded = false;
    let committed = false;
    const client = {
      query: vi.fn(async (sql: string) => {
        events.push(sql);
        if (sql === 'insert role') seeded = true;
        if (sql === 'COMMIT') committed = true;
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };
    const externalRead = vi.fn(async () =>
      committed ? 'seeded-role-catalog' : 'stale-empty-catalog'
    );
    const scopedRead = vi.fn(async (_instanceId: string, scopedClient: typeof client) => {
      expect(scopedClient).toBe(client);
      events.push('read catalog');
      return seeded ? 'seeded-role-catalog' : 'stale-empty-catalog';
    });
    const runtime = createInstanceRegistryRuntime({
      resolvePool: () => ({ connect: async () => client }),
      createRepository: () => ({}) as InstanceRegistryRepository,
      serviceDeps: {
        invalidateHost: vi.fn(),
        readRoleCatalogFingerprint: externalRead,
      },
      readScopedRoleCatalogFingerprint: scopedRead,
    });

    const fingerprint = await runtime.withScopedRegistryService(
      'tenant-a',
      async () => {
        await client.query('insert role');
        return state.capturedDeps?.readRoleCatalogFingerprint?.('tenant-a');
      },
      { shouldReconcileActivationPolicies: async () => false }
    );

    expect(fingerprint).toBe('seeded-role-catalog');
    expect(scopedRead).toHaveBeenCalledWith('tenant-a', client);
    expect(externalRead).not.toHaveBeenCalled();
    expect(events.indexOf('insert role')).toBeLessThan(events.indexOf('read catalog'));
    expect(events.indexOf('read catalog')).toBeLessThan(events.indexOf('COMMIT'));
    expect(await externalRead()).toBe(fingerprint);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
