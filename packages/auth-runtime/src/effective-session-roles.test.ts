import { describe, expect, it, vi } from 'vitest';

import type { QueryClient } from './db.js';
import type { SessionUser } from './types.js';

const loggerState = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => loggerState),
  getWorkspaceContext: vi.fn(() => ({
    requestId: 'req-effective-roles',
    traceId: 'trace-effective-roles',
  })),
}));

describe('effective session roles', () => {
  it('merges direct and group-derived IAM roles into the session user', async () => {
    const { enrichSessionUserWithEffectiveRoles } = await import('./effective-session-roles.js');
    const withResolvedInstanceDb = vi.fn(
      async (
        _resolvePool: () => unknown,
        _instanceId: string,
        work: (client: QueryClient) => Promise<readonly string[]>
      ) =>
        work({
          query: vi.fn(async () => ({
            rowCount: 3,
            rows: [
              { role_key: 'system_admin' },
              { role_key: 'app_manager' },
              { role_key: 'system_admin' },
            ],
          })),
        })
    );

    const user: SessionUser = {
      id: 'kc-user-1',
      instanceId: 'de-musterhausen',
      roles: ['editor', 'app_manager'],
    };

    await expect(
      enrichSessionUserWithEffectiveRoles(user, {
        resolvePool: () => ({}) as object,
        withResolvedInstanceDb,
      })
    ).resolves.toEqual({
      ...user,
      roles: ['editor', 'app_manager', 'system_admin'],
    });
  });

  it('keeps the session user unchanged when role hydration fails', async () => {
    const { enrichSessionUserWithEffectiveRoles } = await import('./effective-session-roles.js');
    const user: SessionUser = {
      id: 'kc-user-1',
      instanceId: 'de-musterhausen',
      roles: ['editor'],
    };

    await expect(
      enrichSessionUserWithEffectiveRoles(user, {
        resolvePool: () => null,
        withResolvedInstanceDb: vi.fn(async () => {
          throw new Error('db unavailable');
        }),
      })
    ).resolves.toBe(user);

    expect(loggerState.warn).toHaveBeenCalledWith(
      'Effective IAM role hydration failed for session user',
      expect.objectContaining({
        instance_id: 'de-musterhausen',
        user_id: 'kc-user-1',
      })
    );
  });

  it('skips database hydration for platform users without instance scope', async () => {
    const { enrichSessionUserWithEffectiveRoles } = await import('./effective-session-roles.js');
    const withResolvedInstanceDb = vi.fn();
    const user: SessionUser = {
      id: 'kc-platform-user',
      roles: ['system_admin'],
    };

    await expect(
      enrichSessionUserWithEffectiveRoles(user, {
        resolvePool: () => ({}) as object,
        withResolvedInstanceDb,
      })
    ).resolves.toBe(user);

    expect(withResolvedInstanceDb).not.toHaveBeenCalled();
  });
});
