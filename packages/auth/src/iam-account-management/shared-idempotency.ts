import { type IdempotencyReserveResult, type IdempotencyStatus } from './types.js';
import { withInstanceScopedDb } from './shared-runtime.js';

export const reserveIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  payloadHash: string;
}): Promise<IdempotencyReserveResult> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('DELETE FROM iam.idempotency_keys WHERE expires_at < NOW();');

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      `${input.instanceId}:${input.actorAccountId}`,
      `${input.endpoint}:${input.idempotencyKey}`,
    ]);

    const existing = await client.query<{
      status: IdempotencyStatus;
      payload_hash: string;
      response_status: number | null;
      response_body: unknown;
    }>(
      `
SELECT status, payload_hash, response_status, response_body
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
      await client.query(
        `
INSERT INTO iam.idempotency_keys (
  instance_id,
  actor_account_id,
  endpoint,
  idempotency_key,
  payload_hash,
  status,
  expires_at
)
VALUES ($1, $2::uuid, $3, $4, $5, 'IN_PROGRESS', NOW() + INTERVAL '24 hours')
`,
        [input.instanceId, input.actorAccountId, input.endpoint, input.idempotencyKey, input.payloadHash]
      );
      return { status: 'reserved' };
    }

    if (row.payload_hash !== input.payloadHash) {
      return {
        status: 'conflict',
        message: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
      };
    }

    if (row.status === 'IN_PROGRESS') {
      return {
        status: 'conflict',
        message: 'Idempotenter Request wird bereits verarbeitet.',
      };
    }

    return {
      status: 'replay',
      responseStatus: row.response_status ?? 200,
      responseBody: row.response_body,
    };
  });

export const completeIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  status: IdempotencyStatus;
  responseStatus: number;
  responseBody: unknown;
}) => {
  await withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query(
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
  AND idempotency_key = $4;
`,
      [
        input.actorAccountId,
        input.instanceId,
        input.endpoint,
        input.idempotencyKey,
        input.status,
        input.responseStatus,
        JSON.stringify(input.responseBody),
      ]
    );
  });
};
