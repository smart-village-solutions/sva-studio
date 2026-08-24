import { randomUUID } from 'node:crypto';

import { type IdempotencyReserveResult, type IdempotencyStatus } from './types.js';
import { withInstanceScopedDb } from './shared-runtime.js';

const IDEMPOTENCY_CLEANUP_INTERVAL_MS = 60_000;
type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];
type IdempotencyScope = Readonly<{
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
}>;

const hasExpiredIdempotencyLease = (
  updatedAt: Date | string,
  leaseMs: number | undefined
): boolean => {
  const updatedAtMs = new Date(updatedAt).getTime();
  return (
    leaseMs !== undefined && Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs >= leaseMs
  );
};

let nextCleanupAt = 0;

const cleanupExpiredIdempotencyKeys = async (client: InstanceScopedClient) => {
  const now = Date.now();
  if (now < nextCleanupAt) {
    return;
  }
  nextCleanupAt = now + IDEMPOTENCY_CLEANUP_INTERVAL_MS;
  await client.query('DELETE FROM iam.idempotency_keys WHERE expires_at < NOW();');
};

const insertIdempotencyReservation = (
  client: InstanceScopedClient,
  input: IdempotencyScope & Readonly<{ payloadHash: string }>,
  leaseToken: string | undefined
) =>
  client.query(
    `
INSERT INTO iam.idempotency_keys (
  instance_id, actor_account_id, endpoint, idempotency_key, payload_hash, response_body, status,
  expires_at
)
VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, 'IN_PROGRESS', NOW() + INTERVAL '24 hours')
`,
    [
      input.instanceId,
      input.actorAccountId,
      input.endpoint,
      input.idempotencyKey,
      input.payloadHash,
      JSON.stringify(leaseToken ? { leaseToken } : null),
    ]
  );

const reclaimIdempotencyReservation = (
  client: InstanceScopedClient,
  input: IdempotencyScope,
  leaseToken: string
) =>
  client.query(
    `
UPDATE iam.idempotency_keys
SET response_body = $5::jsonb, updated_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'
WHERE instance_id = $1
  AND actor_account_id = $2::uuid
  AND endpoint = $3
  AND idempotency_key = $4;
`,
    [
      input.instanceId,
      input.actorAccountId,
      input.endpoint,
      input.idempotencyKey,
      JSON.stringify({ leaseToken }),
    ]
  );

export const reserveIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  payloadHash: string;
  inProgressLeaseMs?: number;
}): Promise<IdempotencyReserveResult> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const leaseToken = input.inProgressLeaseMs === undefined ? undefined : randomUUID();
    await cleanupExpiredIdempotencyKeys(client);

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      `${input.instanceId}:${input.actorAccountId}`,
      `${input.endpoint}:${input.idempotencyKey}`,
    ]);

    const existing = await client.query<{
      status: IdempotencyStatus;
      payload_hash: string;
      response_status: number | null;
      response_body: unknown;
      updated_at: Date | string;
    }>(
      `
SELECT status, payload_hash, response_status, response_body, updated_at
FROM iam.idempotency_keys
WHERE instance_id = $1
  AND actor_account_id = $2::uuid
  AND endpoint = $3
  AND idempotency_key = $4
LIMIT 1;
`,
      [input.instanceId, input.actorAccountId, input.endpoint, input.idempotencyKey]
    );

    const row = existing.rows[0];
    if (!row) {
      await insertIdempotencyReservation(client, input, leaseToken);
      return { status: 'reserved', ...(leaseToken ? { leaseToken } : {}) };
    }

    if (row.payload_hash !== input.payloadHash) {
      return {
        status: 'conflict',
        reason: 'payload_mismatch',
        message: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
      };
    }

    if (row.status === 'IN_PROGRESS') {
      if (hasExpiredIdempotencyLease(row.updated_at, input.inProgressLeaseMs)) {
        if (!leaseToken) throw new Error('idempotency_lease_missing');
        await reclaimIdempotencyReservation(client, input, leaseToken);
        return { status: 'reserved', leaseToken };
      }
      return {
        status: 'conflict',
        reason: 'in_progress',
        message: 'Idempotenter Request wird bereits verarbeitet.',
      };
    }

    return {
      status: 'replay',
      responseStatus: row.response_status ?? 200,
      responseBody: row.response_body,
    };
  });

export const renewIdempotencyLease = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  leaseToken: string;
}): Promise<boolean> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const renewed = await client.query(
      `
UPDATE iam.idempotency_keys
SET updated_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'
WHERE instance_id = $1
  AND actor_account_id = $2::uuid
  AND endpoint = $3
  AND idempotency_key = $4
  AND status = 'IN_PROGRESS'
  AND response_body->>'leaseToken' = $5
RETURNING id;
`,
      [
        input.instanceId,
        input.actorAccountId,
        input.endpoint,
        input.idempotencyKey,
        input.leaseToken,
      ]
    );
    return (renewed.rowCount ?? 0) > 0;
  });

export const completeIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  status: IdempotencyStatus;
  responseStatus: number;
  responseBody: unknown;
  leaseToken?: string;
}): Promise<boolean> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const completed = await client.query(
      `
UPDATE iam.idempotency_keys
SET
  status = $5,
  response_status = $6,
  response_body = $7::jsonb,
  updated_at = NOW(),
  expires_at = NOW() + INTERVAL '24 hours'
WHERE actor_account_id = $1::uuid
  AND instance_id = $2
  AND endpoint = $3
  AND idempotency_key = $4
  AND (
    (response_body->>'leaseToken' IS NULL AND $8::text IS NULL)
    OR response_body->>'leaseToken' = $8
  )
RETURNING id;
`,
      [
        input.actorAccountId,
        input.instanceId,
        input.endpoint,
        input.idempotencyKey,
        input.status,
        input.responseStatus,
        JSON.stringify(input.responseBody),
        input.leaseToken ?? null,
      ]
    );
    return (completed.rowCount ?? 0) > 0;
  });
