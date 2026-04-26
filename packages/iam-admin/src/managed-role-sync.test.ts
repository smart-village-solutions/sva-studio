import { describe, expect, it, vi } from 'vitest';

import { createManagedRoleSync } from './managed-role-sync.js';
import type { QueryClient } from './query-client.js';

const managedRoleRow = {
  id: 'role-1',
  role_key: 'editor',
  role_name: 'editor',
  display_name: 'Editor',
  external_role_name: 'Editor',
  description: 'Can edit content',
  is_system_role: false,
  role_level: 20,
  managed_by: 'studio',
  sync_state: 'pending',
  last_synced_at: null,
  last_error_code: null,
} as const;

const createDeps = (rows = [managedRoleRow]) => {
  const client: QueryClient = {
    query: vi.fn(async () => ({ rowCount: rows.length, rows: [...rows] })),
  };

  const deps = {
    buildRoleAttributes: vi.fn((input) => ({
      managedBy: 'studio' as const,
      instanceId: input.instanceId,
      roleKey: input.roleKey,
      displayName: input.displayName,
    })),
    emitRoleAuditEvent: vi.fn(async () => undefined),
    setRoleSyncState: vi.fn(async () => undefined),
    trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
    withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (queryClient: QueryClient) => Promise<unknown>) =>
      work(client)
    ),
  };

  return { client, deps };
};

describe('managed-role-sync', () => {
  it('skips database access when no external role names are requested', async () => {
    const { deps } = createDeps([]);
    const sync = createManagedRoleSync(deps);

    await expect(sync.loadManagedRolesByExternalNames('inst-1', [])).resolves.toEqual([]);

    expect(deps.withInstanceScopedDb).not.toHaveBeenCalled();
  });

  it('loads managed roles by external names with instance scope and deduplicated names', async () => {
    const { client, deps } = createDeps();
    const sync = createManagedRoleSync(deps);

    await expect(sync.loadManagedRolesByExternalNames('inst-1', ['Editor', 'Editor'])).resolves.toEqual([
      managedRoleRow,
    ]);

    expect(deps.withInstanceScopedDb).toHaveBeenCalledWith('inst-1', expect.any(Function));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('FROM iam.roles'), ['inst-1', ['Editor']]);
  });

  it('creates missing realm roles and marks sync as successful', async () => {
    const { deps } = createDeps();
    const identityProvider = {
      provider: {
        getRoleByName: vi.fn(async () => null),
        createRole: vi.fn(async () => ({ externalName: 'Editor' })),
      },
    };
    const sync = createManagedRoleSync(deps);

    await sync.ensureManagedRealmRolesExist({
      instanceId: 'inst-1',
      identityProvider,
      externalRoleNames: ['Editor'],
      actorAccountId: 'actor-1',
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(identityProvider.provider.createRole).toHaveBeenCalledWith({
      externalName: 'Editor',
      description: 'Can edit content',
      attributes: {
        managedBy: 'studio',
        instanceId: 'inst-1',
        roleKey: 'editor',
        displayName: 'Editor',
      },
    });
    expect(deps.setRoleSyncState).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'inst-1',
      roleId: 'role-1',
      syncState: 'synced',
      errorCode: null,
      syncedAt: true,
    });
    expect(deps.emitRoleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'role.sync_succeeded',
        result: 'success',
        roleKey: 'editor',
        externalRoleName: 'Editor',
      })
    );
  });

  it('does not recreate existing realm roles', async () => {
    const { deps } = createDeps();
    const identityProvider = {
      provider: {
        getRoleByName: vi.fn(async () => ({ externalName: 'Editor' })),
        createRole: vi.fn(async () => ({ externalName: 'Editor' })),
      },
    };
    const sync = createManagedRoleSync(deps);

    await sync.ensureManagedRealmRolesExist({
      instanceId: 'inst-1',
      identityProvider,
      externalRoleNames: ['Editor'],
    });

    expect(identityProvider.provider.createRole).not.toHaveBeenCalled();
    expect(deps.setRoleSyncState).not.toHaveBeenCalled();
    expect(deps.emitRoleAuditEvent).not.toHaveBeenCalled();
  });

  it('marks sync as failed and rethrows create errors', async () => {
    const { deps } = createDeps();
    const error = new Error('forbidden');
    error.name = 'ForbiddenError';
    const identityProvider = {
      provider: {
        getRoleByName: vi.fn(async () => null),
        createRole: vi.fn(async () => {
          throw error;
        }),
      },
    };
    const sync = createManagedRoleSync(deps);

    await expect(
      sync.ensureManagedRealmRolesExist({
        instanceId: 'inst-1',
        identityProvider,
        externalRoleNames: ['Editor'],
      })
    ).rejects.toThrow(error);

    expect(deps.setRoleSyncState).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'inst-1',
      roleId: 'role-1',
      syncState: 'failed',
      errorCode: expect.any(String),
      syncedAt: false,
    });
    expect(deps.emitRoleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'role.sync_failed',
        result: 'failure',
      })
    );
  });
});
