import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rows: new Map<
    string,
    {
      payload_hash: string;
      response_body: unknown;
      response_status: number | null;
      status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
      updated_at: Date;
    }
  >(),
  reclaimRace: false,
  client: {
    query: vi.fn(),
  },
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./shared-runtime.js', () => ({
  withInstanceScopedDb: mocks.withInstanceScopedDb,
}));

import {
  completeIdempotency,
  hasIdempotentAuditEvent,
  releaseIdempotencyReservation,
  renewIdempotencyLease,
  reserveIdempotency,
} from './shared-idempotency.js';

const input = {
  instanceId: 'de-test',
  actorAccountId: '00000000-0000-4000-8000-000000000001',
  endpoint: 'POST:/api/v1/iam/users',
  idempotencyKey: 'idem-1',
  payloadHash: 'hash-1',
};

const rowKey = (values: readonly unknown[]) =>
  `${values[0]}:${values[1]}:${values[2]}:${values[3]}`;

describe('shared idempotency store', () => {
  beforeEach(() => {
    mocks.rows.clear();
    mocks.reclaimRace = false;
    mocks.client.query.mockReset();
    mocks.withInstanceScopedDb.mockImplementation(async (_instanceId, work) => work(mocks.client));
    mocks.client.query.mockImplementation(async (text: string, values: readonly unknown[] = []) => {
      if (text.includes('SELECT status, payload_hash')) {
        const row = mocks.rows.get(rowKey(values));
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (text.includes('INSERT INTO iam.idempotency_keys')) {
        mocks.rows.set(rowKey(values), {
          payload_hash: values[4] as string,
          response_body: JSON.parse(values[5] as string) as unknown,
          response_status: null,
          status: 'IN_PROGRESS',
          updated_at: new Date(),
        });
      }
      if (text.includes("DELETE FROM iam.idempotency_keys\nWHERE instance_id")) {
        const row = mocks.rows.get(rowKey(values));
        const token = (row?.response_body as { leaseToken?: string } | null)?.leaseToken;
        const released = row?.status === 'IN_PROGRESS' && token === values[4];
        if (released) mocks.rows.delete(rowKey(values));
        return { rowCount: released ? 1 : 0, rows: released ? [{ id: 'idem-row' }] : [] };
      }
      if (text.includes('response_body = $5::jsonb')) {
        const row = mocks.rows.get(rowKey(values));
        if (row && mocks.reclaimRace) {
          row.status = 'COMPLETED';
          row.response_body = { completed: true };
          row.response_status = 201;
          row.updated_at = new Date();
        }
        const matchesObservedVersion =
          row?.status === 'IN_PROGRESS' &&
          Date.now() - row.updated_at.getTime() >= (values[5] as number) &&
          JSON.stringify(row.response_body) === values[6];
        if (row && matchesObservedVersion) {
          row.response_body = JSON.parse(values[4] as string) as unknown;
          row.updated_at = new Date();
        }
        return {
          rowCount: matchesObservedVersion ? 1 : 0,
          rows: matchesObservedVersion ? [{ id: 'idem-row' }] : [],
        };
      }
      if (text.includes("response_body->>'leaseToken' = $5")) {
        const row = mocks.rows.get(rowKey(values));
        const token = (row?.response_body as { leaseToken?: string } | null)?.leaseToken;
        const renewed = row?.status === 'IN_PROGRESS' && token === values[4];
        if (renewed && row) row.updated_at = new Date();
        return { rowCount: renewed ? 1 : 0, rows: renewed ? [{ id: 'idem-row' }] : [] };
      } else if (text.includes('UPDATE iam.idempotency_keys')) {
        const key = `${values[1]}:${values[0]}:${values[2]}:${values[3]}`;
        const row = mocks.rows.get(key);
        const token = (row?.response_body as { leaseToken?: string } | null)?.leaseToken;
        const expectedToken = values[7] as string | null;
        const mayComplete =
          row && (token === undefined ? expectedToken === null : token === expectedToken);
        if (mayComplete) {
          row.status = values[4] as typeof row.status;
          row.response_status = values[5] as number;
          row.response_body = JSON.parse(values[6] as string) as unknown;
        }
        return {
          rowCount: mayComplete ? 1 : 0,
          rows: mayComplete ? [{ id: 'idem-row' }] : [],
        };
      }
      return { rowCount: 0, rows: [] };
    });
  });

  it('reserves first-use idempotency keys', async () => {
    await expect(reserveIdempotency(input)).resolves.toEqual({ status: 'reserved' });

    expect(
      mocks.rows.get(
        `${input.instanceId}:${input.actorAccountId}:${input.endpoint}:${input.idempotencyKey}`
      )
    ).toMatchObject({ payload_hash: input.payloadHash, status: 'IN_PROGRESS' });
  });

  it('replays completed requests with the stored response', async () => {
    await reserveIdempotency(input);
    await completeIdempotency({
      ...input,
      responseBody: { userId: 'user-1' },
      responseStatus: 201,
      status: 'COMPLETED',
    });

    await expect(reserveIdempotency(input)).resolves.toEqual({
      responseBody: { userId: 'user-1' },
      responseStatus: 201,
      status: 'replay',
    });
  });

  it('rejects reused keys with a different payload hash', async () => {
    await reserveIdempotency(input);

    await expect(reserveIdempotency({ ...input, payloadHash: 'hash-2' })).resolves.toMatchObject({
      status: 'conflict',
    });
  });

  it('rejects concurrent in-progress requests for the same payload', async () => {
    await reserveIdempotency(input);

    await expect(reserveIdempotency(input)).resolves.toMatchObject({
      status: 'conflict',
    });
  });

  it('recovers an in-progress reservation after its explicit lease expires', async () => {
    await reserveIdempotency({ ...input, inProgressLeaseMs: 5 * 60 * 1_000 });
    const row = mocks.rows.get(
      `${input.instanceId}:${input.actorAccountId}:${input.endpoint}:${input.idempotencyKey}`
    );
    if (!row) throw new Error('missing test reservation');
    row.updated_at = new Date(Date.now() - 5 * 60 * 1_000 - 1);

    await expect(
      reserveIdempotency({ ...input, inProgressLeaseMs: 5 * 60 * 1_000 })
    ).resolves.toMatchObject({ status: 'reserved', leaseToken: expect.any(String) });
  });

  it('does not overwrite completion racing with an expired lease reclaim', async () => {
    await reserveIdempotency({ ...input, inProgressLeaseMs: 5 * 60 * 1_000 });
    const row = mocks.rows.get(
      `${input.instanceId}:${input.actorAccountId}:${input.endpoint}:${input.idempotencyKey}`
    );
    if (!row) throw new Error('missing test reservation');
    row.updated_at = new Date(Date.now() - 5 * 60 * 1_000 - 1);
    mocks.reclaimRace = true;

    await expect(
      reserveIdempotency({ ...input, inProgressLeaseMs: 5 * 60 * 1_000 })
    ).resolves.toMatchObject({ status: 'conflict', reason: 'in_progress' });
    expect(row).toMatchObject({
      status: 'COMPLETED',
      response_body: { completed: true },
      response_status: 201,
    });
  });

  it('renews and completes only the current lease owner', async () => {
    const reserved = await reserveIdempotency({
      ...input,
      inProgressLeaseMs: 5 * 60 * 1_000,
    });
    if (reserved.status !== 'reserved' || !reserved.leaseToken)
      throw new Error('missing test lease');

    await expect(
      renewIdempotencyLease({ ...input, leaseToken: reserved.leaseToken })
    ).resolves.toBe(true);
    await expect(renewIdempotencyLease({ ...input, leaseToken: 'replaced' })).resolves.toBe(false);
    await expect(
      completeIdempotency({
        ...input,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody: { ok: true },
        leaseToken: 'replaced',
      })
    ).resolves.toBe(false);
    await expect(
      completeIdempotency({
        ...input,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody: { ok: true },
        leaseToken: reserved.leaseToken,
      })
    ).resolves.toBe(true);
  });

  it('releases only the current lease owner so transient failures can be retried', async () => {
    const reserved = await reserveIdempotency({ ...input, inProgressLeaseMs: 5 * 60 * 1_000 });
    if (reserved.status !== 'reserved' || !reserved.leaseToken)
      throw new Error('missing test lease');

    await expect(
      releaseIdempotencyReservation({ ...input, leaseToken: 'replaced' })
    ).resolves.toBe(false);
    await expect(
      releaseIdempotencyReservation({ ...input, leaseToken: reserved.leaseToken })
    ).resolves.toBe(true);
    await expect(
      reserveIdempotency({ ...input, inProgressLeaseMs: 5 * 60 * 1_000 })
    ).resolves.toMatchObject({ status: 'reserved', leaseToken: expect.any(String) });
  });

  it('scopes audit deduplication to the actor account', async () => {
    await hasIdempotentAuditEvent({
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      idempotencyKey: input.idempotencyKey,
      eventType: 'plugin_action_authorized',
      actionId: 'waste-management.annual-tour-transfer.created',
    });

    expect(mocks.client.query).toHaveBeenCalledWith(
      expect.stringContaining('AND account_id = $5::uuid'),
      [
        input.instanceId,
        input.idempotencyKey,
        'plugin_action_authorized',
        'waste-management.annual-tour-transfer.created',
        input.actorAccountId,
      ]
    );
  });
});
