import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  claimSsfAuthorizationProjection,
  confirmSsfAuthorizationProjectionReadBack,
  createPostgresSsfAuthorizationProjectionStore,
  createSsfAuthorizationRevision,
  markSsfAuthorizationSessionsRevoked,
  readReadySsfAuthorizationRevision,
  stageSsfAuthorizationProjection,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  type SsfAuthorizationProjection,
} from '../src/runtime.js';

const projection = (
  instanceId = 'tenant-a',
  permissions: SsfAuthorizationProjection['subjects'][number]['permissions'] = [
    'ssf.configuration.tenant.read',
  ]
): SsfAuthorizationProjection => ({
  contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
  instanceId,
  subjects: [{ subject: 'user-a', roles: ['user'], permissions }],
});

describe('SSF authorization projection repository', () => {
  it('stages normalized desired state and returns the persisted generation', async () => {
    const desired = projection();
    const desiredRevision = createSsfAuthorizationRevision(desired);
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          instance_id: 'tenant-a',
          generation: '2',
          status: 'pending',
          desired_revision: desiredRevision,
          desired_projection: desired,
          confirmed_revision: null,
          confirmed_projection: null,
          sessions_revoked_revision: null,
          last_error_code: null,
        },
      ],
    });

    await expect(
      stageSsfAuthorizationProjection({ query } as unknown as Pool, desired)
    ).resolves.toMatchObject({
      instanceId: 'tenant-a',
      generation: 2,
      status: 'pending',
      desiredRevision,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('generation = CASE'), [
      'tenant-a',
      desiredRevision,
      JSON.stringify(desired),
    ]);
  });

  it('claims only the exact generation and desired revision', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    await expect(
      claimSsfAuthorizationProjection({ query } as unknown as Pool, {
        instanceId: 'tenant-a',
        generation: 3,
        desiredRevision: `sha256:${'a'.repeat(64)}`,
      })
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "status IN ('pending', 'projecting', 'revocation_pending', 'blocked')"
      ),
      ['tenant-a', 3, `sha256:${'a'.repeat(64)}`]
    );
  });

  it('serializes a complete tenant reconcile with a session advisory lock', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const store = createPostgresSsfAuthorizationProjectionStore(pool);
    const operation = vi.fn(async () => 'completed');

    await expect(store.withTenantLock('tenant-a', operation)).resolves.toBe('completed');

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      ['tenant-a']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      ['tenant-a']
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('releases the tenant advisory lock when reconcile work fails', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const store = createPostgresSsfAuthorizationProjectionStore(pool);

    await expect(
      store.withTenantLock('tenant-a', async () => {
        throw new Error('projection failed');
      })
    ).rejects.toThrow('projection failed');

    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      ['tenant-a']
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('blocks a mismatching Keycloak read-back without confirming it', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    await expect(
      confirmSsfAuthorizationProjectionReadBack({ query } as unknown as Pool, {
        desired: projection(),
        readBack: projection('tenant-a', []),
        generation: 1,
      })
    ).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SET status = 'blocked'"), [
      'tenant-a',
      1,
      createSsfAuthorizationRevision(projection()),
      'readback_mismatch',
    ]);
  });

  it('requires confirmed read-back and session revocation before readiness', async () => {
    const desired = projection();
    const revision = createSsfAuthorizationRevision(desired);
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const pool = { query } as unknown as Pool;

    await expect(
      confirmSsfAuthorizationProjectionReadBack(pool, {
        desired,
        readBack: { ...desired, subjects: [...desired.subjects].reverse() },
        generation: 4,
      })
    ).resolves.toBe(true);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET status = 'revocation_pending'"),
      ['tenant-a', 4, revision, JSON.stringify(desired)]
    );

    await expect(
      markSsfAuthorizationSessionsRevoked(pool, {
        instanceId: 'tenant-a',
        generation: 4,
        authorizationRevision: revision,
      })
    ).resolves.toBe(true);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("SET status = 'ready'"), [
      'tenant-a',
      4,
      revision,
    ]);
  });

  it('reads only an exactly converged revision in a tenant-bound transaction', async () => {
    const revision = `sha256:${'b'.repeat(64)}`;
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ confirmed_revision: revision }] })
        .mockResolvedValueOnce({ rowCount: null, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(readReadySsfAuthorizationRevision(pool, 'tenant-a')).resolves.toBe(revision);
    expect(client.query).toHaveBeenNthCalledWith(2, 'SELECT set_config($1, $2, true)', [
      'app.instance_id',
      'tenant-a',
    ]);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('confirmed_revision = sessions_revoked_revision'),
      ['tenant-a']
    );
    expect(client.release).toHaveBeenCalledOnce();
  });
});
