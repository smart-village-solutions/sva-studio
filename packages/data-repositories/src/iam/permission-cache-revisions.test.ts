import { describe, expect, it, vi } from 'vitest';

import type { SqlExecutor, SqlStatement } from './repositories/types.js';
import {
  createPermissionCacheRevisionRepository,
  permissionCacheRevisionStatements,
} from './permission-cache-revisions.js';

const createExecutor = (rows: readonly Record<string, unknown>[]) => {
  const statements: SqlStatement[] = [];
  const executor: SqlExecutor = {
    execute: vi.fn(async <TRow>(statement: SqlStatement) => {
      statements.push(statement);
      return { rowCount: rows.length, rows: rows as readonly TRow[] };
    }),
  };
  return { executor, statements };
};

describe('permission cache revision repository', () => {
  it('reads the instance and user revision vector with one indexed statement', async () => {
    const { executor, statements } = createExecutor([
      { instance_revision: '4', user_revision: '7' },
    ]);

    await expect(
      createPermissionCacheRevisionRepository(executor).readVector('tenant-a', 'subject-a')
    ).resolves.toEqual({ instanceRevision: 4, userRevision: 7 });
    expect(statements).toEqual([
      permissionCacheRevisionStatements.readVector('tenant-a', 'subject-a'),
    ]);
    expect(statements[0]?.text).toContain('permission_cache_instance_revisions');
    expect(statements[0]?.text).toContain('permission_cache_user_revisions');
  });

  it('accepts numeric revision values returned by database adapters', async () => {
    const { executor } = createExecutor([{ instance_revision: 4, user_revision: 7 }]);

    await expect(
      createPermissionCacheRevisionRepository(executor).readVector('tenant-a', 'subject-a')
    ).resolves.toEqual({ instanceRevision: 4, userRevision: 7 });
  });

  it('bumps an absent logical revision from one to two and publishes in the same statement', async () => {
    const { executor, statements } = createExecutor([{ revision: '2' }]);

    await expect(
      createPermissionCacheRevisionRepository(executor).bump({
        kind: 'user',
        instanceId: 'tenant-a',
        keycloakSubject: 'subject-a',
      })
    ).resolves.toBe(2);
    expect(statements[0]?.text).toContain('ON CONFLICT (instance_id, keycloak_subject) DO UPDATE');
    expect(statements[0]?.text).toContain("'PermissionRevisionChanged'");
    expect(statements[0]?.text).toContain('pg_notify');
  });

  it('rejects missing and unsafe revisions', async () => {
    const missing = createExecutor([]);
    await expect(
      createPermissionCacheRevisionRepository(missing.executor).readVector('tenant-a', 'subject-a')
    ).rejects.toThrow('permission_cache_revision_read_failed');

    const unsafe = createExecutor([{ instance_revision: '9007199254740992', user_revision: '1' }]);
    await expect(
      createPermissionCacheRevisionRepository(unsafe.executor).readVector('tenant-a', 'subject-a')
    ).rejects.toThrow('invalid_permission_cache_revision:instance');
  });
});
