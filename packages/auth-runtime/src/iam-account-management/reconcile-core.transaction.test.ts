import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  committedRoles: [] as Record<string, unknown>[],
  separateConnectionReads: vi.fn(),
}));

vi.mock('./shared.js', () => ({
  emitRoleAuditEvent: vi.fn(),
  resolveIdentityProviderForInstance: vi.fn(),
  setRoleDriftBacklog: vi.fn(),
  setRoleSyncState: vi.fn(),
  trackKeycloakCall: vi.fn(),
  withInstanceScopedDb: async (
    _instanceId: string,
    work: (client: unknown) => Promise<unknown>
  ) => {
    state.separateConnectionReads();
    return work({ query: async () => ({ rows: state.committedRoles }) });
  },
}));

import {
  readRoleCatalogFingerprint,
  readRoleCatalogFingerprintInTransaction,
} from './reconcile-core.js';

describe('role catalog fingerprint transaction visibility', () => {
  it('captures the seeded role before commit and matches the committed catalog afterward', async () => {
    state.committedRoles = [];
    state.separateConnectionReads.mockClear();
    const seededRole = {
      id: 'role-1',
      role_key: 'system_admin',
      role_name: 'system_admin',
      display_name: 'System Admin',
      external_role_name: 'system_admin',
      description: 'Protected system role',
      is_system_role: true,
      role_level: 100,
      managed_by: 'studio',
      sync_state: 'pending',
      last_synced_at: null,
      last_error_code: null,
    };
    const transactionClient = {
      query: vi.fn(async () => ({ rowCount: 1, rows: [seededRole] })),
    };

    const staleFingerprint = await readRoleCatalogFingerprint('tenant-a');
    const queuedFingerprint = await readRoleCatalogFingerprintInTransaction(
      'tenant-a',
      transactionClient
    );

    expect(queuedFingerprint).not.toBe(staleFingerprint);
    expect(transactionClient.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM iam.roles'),
      ['tenant-a']
    );
    expect(state.separateConnectionReads).toHaveBeenCalledOnce();

    state.committedRoles = [seededRole];
    expect(await readRoleCatalogFingerprint('tenant-a')).toBe(queuedFingerprint);
  });
});
