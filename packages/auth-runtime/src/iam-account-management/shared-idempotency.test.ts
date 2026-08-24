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
  client: {
    query: vi.fn(),
  },
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./shared-runtime.js', () => ({
  withInstanceScopedDb: mocks.withInstanceScopedDb,
}));

import { completeIdempotency, reserveIdempotency } from './shared-idempotency.js';

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
          response_body: null,
          response_status: null,
          status: 'IN_PROGRESS',
          updated_at: new Date(),
        });
      }
      if (text.includes('SET updated_at = NOW()')) {
        const row = mocks.rows.get(rowKey(values));
        if (row) row.updated_at = new Date();
      } else if (text.includes('UPDATE iam.idempotency_keys')) {
        const key = `${values[1]}:${values[0]}:${values[2]}:${values[3]}`;
        const row = mocks.rows.get(key);
        if (row) {
          row.status = values[4] as typeof row.status;
          row.response_status = values[5] as number;
          row.response_body = JSON.parse(values[6] as string) as unknown;
        }
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
    await reserveIdempotency(input);
    const row = mocks.rows.get(
      `${input.instanceId}:${input.actorAccountId}:${input.endpoint}:${input.idempotencyKey}`
    );
    if (!row) throw new Error('missing test reservation');
    row.updated_at = new Date(Date.now() - 5 * 60 * 1_000 - 1);

    await expect(
      reserveIdempotency({ ...input, inProgressLeaseMs: 5 * 60 * 1_000 })
    ).resolves.toEqual({ status: 'reserved' });
  });
});
