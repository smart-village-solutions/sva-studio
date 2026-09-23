import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import {
  claimSsfAuthorizationProjection,
  confirmSsfAuthorizationProjectionReadBack,
  createPostgresSsfAuthorizationProjectionStore,
  createSsfAuthorizationRevision,
  hasReadySsfAuthorizationProjectionSubjects,
  markSsfAuthorizationProjectionReady,
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
        "status IN ('pending', 'projecting', 'activation_pending', 'revocation_pending', 'blocked', 'ready')"
      ),
      ['tenant-a', 3, `sha256:${'a'.repeat(64)}`]
    );
  });

  it('serializes a complete tenant reconcile with a session advisory lock', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ acquired: true }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const store = createPostgresSsfAuthorizationProjectionStore(pool);
    const operation = vi.fn(async () => 'completed');

    await expect(store.withTenantLock('tenant-a', operation)).resolves.toBe('completed');

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',
      ['tenant-a']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      ['tenant-a']
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('returns a bounded conflict when the tenant advisory lock is already held', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ acquired: false }] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const store = createPostgresSsfAuthorizationProjectionStore(pool);
    const operation = vi.fn();

    await expect(store.withTenantLock('tenant-a', operation)).rejects.toThrow(
      'ssf_authorization_projection_lock_unavailable'
    );
    expect(operation).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('releases the tenant advisory lock when reconcile work fails', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ acquired: true }] })
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

  it('does not attempt to unlock when lock acquisition fails', async () => {
    const acquisitionError = new Error('lock unavailable');
    const client = {
      query: vi.fn().mockRejectedValue(acquisitionError),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const store = createPostgresSsfAuthorizationProjectionStore(pool);

    await expect(store.withTenantLock('tenant-a', vi.fn())).rejects.toBe(acquisitionError);

    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('preserves the reconcile failure when unlocking also fails', async () => {
    const reconcileError = new Error('projection failed');
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ acquired: true }] })
        .mockRejectedValueOnce(new Error('unlock failed')),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
    const store = createPostgresSsfAuthorizationProjectionStore(pool);

    await expect(
      store.withTenantLock('tenant-a', async () => {
        throw reconcileError;
      })
    ).rejects.toBe(reconcileError);

    expect(client.query).toHaveBeenCalledTimes(2);
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

  it('requires confirmed read-back before the repository can publish readiness', async () => {
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
      expect.stringContaining("SET status = 'activation_pending'"),
      ['tenant-a', 4, revision, JSON.stringify(desired)]
    );

    await expect(
      markSsfAuthorizationProjectionReady(pool, {
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
    const revision = createSsfAuthorizationRevision({
      contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
      instanceId: 'tenant-a',
      subjects: [],
    });
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
      expect.not.stringContaining('sessions_revoked_revision'),
      ['tenant-a']
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('reads subject availability only from an exactly converged projection', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ confirmed_has_subjects: true }] })
        .mockResolvedValueOnce({ rowCount: null, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(hasReadySsfAuthorizationProjectionSubjects(pool, 'tenant-a')).resolves.toBe(true);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('SELECT confirmed_has_subjects'),
      ['tenant-a']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('desired_revision = confirmed_revision'),
      ['tenant-a']
    );
  });

  it('treats an absent confirmed subject flag as unavailable', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: null, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(hasReadySsfAuthorizationProjectionSubjects(pool, 'tenant-a')).resolves.toBe(false);
  });

  it('treats missing subject evidence in a historical schema as unavailable', async () => {
    const missingColumnError = Object.assign(new Error('column does not exist'), { code: '42703' });
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockRejectedValueOnce(missingColumnError)
        .mockResolvedValueOnce({ rowCount: null, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(hasReadySsfAuthorizationProjectionSubjects(pool, 'tenant-a')).resolves.toBe(false);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('preserves database errors other than a missing subject evidence column', async () => {
    const databaseError = Object.assign(new Error('database unavailable'), { code: '57P01' });
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rowCount: null, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockRejectedValueOnce(databaseError)
        .mockResolvedValueOnce({ rowCount: null, rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;

    await expect(hasReadySsfAuthorizationProjectionSubjects(pool, 'tenant-a')).rejects.toBe(
      databaseError
    );
  });
});
