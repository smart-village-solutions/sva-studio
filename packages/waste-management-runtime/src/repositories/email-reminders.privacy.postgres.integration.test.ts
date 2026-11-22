import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applySchemaStatements } from '../operations/waste-management-operations.schema.js';
import { createSqlExecutor } from '../operations/waste-management-operations.shared.js';
import { createWasteEmailReminderRepository } from './email-reminders.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
const schema = `waste_email_privacy_${randomUUID().replaceAll('-', '')}`;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;
let client: PoolClient;
let concurrent: PoolClient;
const recipient = 'synthetic@example.invalid';

const createSubscription = async (status: 'pending' | 'active' | 'unsubscribed', expiresAt: string) => {
  const id = randomUUID();
  const city = await client.query("INSERT INTO waste_cities (name) VALUES ($1) RETURNING id", [id]);
  await client.query(
    `INSERT INTO waste_email_reminder_subscriptions
     (id, status, email, email_hash, city_id, street_id, location_label, consent_version,
      consent_accepted_at, expires_at, doi_token_hash, unsubscribe_token_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, 'test-street', 'Testort, Hausnummer 12', 'v1',
      $6::timestamptz - INTERVAL '48 hours', $6, $7, $8, $6::timestamptz - INTERVAL '48 hours')`,
    [id, status, recipient, `synthetic-hash-${id}`, city.rows[0]?.id, expiresAt, `doi-${id}`, `unsub-${id}`]
  );
  return id;
};

const createOutbox = async (
  subscriptionId: string,
  kind: 'doi' | 'reminder',
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled',
  timestamp: string
) => {
  const id = randomUUID();
  await client.query(
    `INSERT INTO waste_email_reminder_outbox
     (id, subscription_id, message_kind, transport_id, template_key, send_at, dedupe_key,
      status, leased_at, sent_at, payload, last_error)
     VALUES ($1, $2, $3, 'smtp', 'template', $4, $1::uuid::text,
      $5, CASE WHEN $5 = 'processing' THEN $4::timestamptz END,
      CASE WHEN $5 = 'sent' THEN $4::timestamptz END, $6::jsonb, $7)`,
    [
      id, subscriptionId, kind, timestamp, status,
      JSON.stringify({ addresses: [{ email: recipient }], templatePayload: { confirmUrl: 'synthetic-token' } }),
      status === 'processing' ? null : `SMTP failure for ${recipient}`,
    ]
  );
  return id;
};

const inTransaction = async <T>(connection: PoolClient, work: () => Promise<T>): Promise<T> => {
  await connection.query('BEGIN');
  try {
    const result = await work();
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  }
};

const repositoryFor = (connection: PoolClient) =>
  createWasteEmailReminderRepository(createSqlExecutor(connection));

const testTimestamp = () => new Date().toISOString();
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

describe.skipIf(!databaseUrl)('Waste email address retention against PostgreSQL', () => {
  beforeAll(async () => {
    if (!pool) return;
    client = await pool.connect();
    concurrent = await pool.connect();
    for (const statement of applySchemaStatements(schema)) await client.query(statement);
    await client.query(`SET search_path TO ${schema}, public`);
    await concurrent.query(`SET search_path TO ${schema}, public`);
  }, 60_000);

  afterAll(async () => {
    concurrent?.release();
    client?.release();
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    }
  });

  it('blocks activation exactly at expiry and removes an unconfirmed 48 hour old subscription', async () => {
    const now = testTimestamp();
    const id = await createSubscription('pending', now);
    const order = await createOutbox(id, 'doi', 'processing', now);
    const active = await createSubscription('active', now);
    const repo = repositoryFor(client);
    expect(await inTransaction(client, () =>
      repo.activateByDoiTokenHash({ tokenHash: `doi-${id}`, now })
    )).toEqual({ status: 'expired' });
    expect(await repo.deleteExpiredPendingSubscriptions({ now })).toEqual({
      expiredPendingCount: 1, expiredDoiCount: 1,
    });
    expect((await client.query('SELECT id FROM waste_email_reminder_subscriptions WHERE id = $1', [id])).rows).toEqual([]);
    expect((await client.query('SELECT id FROM waste_email_reminder_outbox WHERE id = $1', [order])).rows).toEqual([]);
    expect((await client.query('SELECT id FROM waste_email_reminder_subscriptions WHERE id = $1', [active])).rowCount).toBe(1);
    expect(await repo.deleteExpiredPendingSubscriptions({ now })).toEqual({
      expiredPendingCount: 0, expiredDoiCount: 0,
    });
  });

  it.each(['active', 'unsubscribed'] as const)('scrubs historical PII and keeps unsubscribe stable for %s subscriptions', async (status) => {
    const now = testTimestamp();
    const id = await createSubscription(status, tomorrow());
    for (const state of ['pending', 'processing', 'sent', 'failed', 'cancelled'] as const) {
      await createOutbox(id, state === 'pending' ? 'doi' : 'reminder', state, now);
    }
    const repo = repositoryFor(client);
    const subscription = () => client.query(
      'SELECT email, email_hash, location_label, status, unsubscribed_at, updated_at FROM waste_email_reminder_subscriptions WHERE id = $1',
      [id]
    );
    const outbox = () => client.query(
      'SELECT status, payload, leased_at, last_error, updated_at FROM waste_email_reminder_outbox WHERE subscription_id = $1 ORDER BY id',
      [id]
    );
    const unsubscribe = (timestamp: string) => inTransaction(client, () =>
      repo.unsubscribeByTokenHash({ tokenHash: `unsub-${id}`, now: timestamp })
    );
    expect(await unsubscribe(now)).toMatchObject({
      status: status === 'active' ? 'unsubscribed' : 'already_unsubscribed',
    });
    const firstSubscription = (await subscription()).rows;
    const firstOutbox = (await outbox()).rows;
    expect(firstSubscription[0]).toMatchObject({ email: null, email_hash: null, location_label: '', status: 'unsubscribed' });
    expect(firstOutbox.map((row) => row.status).sort()).toEqual(['cancelled', 'cancelled', 'cancelled', 'failed', 'sent']);
    expect(firstOutbox.every((row) => row.leased_at === null && JSON.stringify(row.payload) === '{}')).toBe(true);
    expect(JSON.stringify([firstSubscription, firstOutbox])).not.toMatch(/example\.invalid|synthetic-token|synthetic-hash/);
    expect(await unsubscribe(tomorrow())).toMatchObject({ status: 'already_unsubscribed' });
    expect((await subscription()).rows).toEqual(firstSubscription);
    expect((await outbox()).rows).toEqual(firstOutbox);
    expect(await repo.loadUnsubscribeSubscriptionById({ subscriptionId: id })).toEqual({
      subscriptionId: id,
      unsubscribeTokenHash: `unsub-${id}`,
    });
  });

  it.each(['completed', 'rolled back'] as const)('serializes revoke and the %s dispatch claim', async (result) => {
    const now = testTimestamp();
    const id = await createSubscription('active', tomorrow());
    const outboxId = await createOutbox(id, 'reminder', 'processing', now);
    const worker = repositoryFor(client);
    const revoke = repositoryFor(concurrent);
    await client.query('BEGIN');
    try {
      expect(await worker.claimOutboxEntryForDispatch({ outboxId, leasedAt: now })).toBe(true);
      const concurrentPid = (await concurrent.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      const revoking = inTransaction(concurrent, () =>
        revoke.unsubscribeByTokenHash({ tokenHash: `unsub-${id}`, now })
      );
      await vi.waitFor(async () => {
        const row = (await client.query(
          'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [concurrentPid]
        )).rows[0];
        expect(row?.wait_event_type).toBe('Lock');
      });
      if (result === 'completed') {
        expect(await worker.markOutboxEntrySent({ outboxId, leasedAt: now, now })).toBe(true);
      }
      await client.query(result === 'completed' ? 'COMMIT' : 'ROLLBACK');
      expect(await revoking).toMatchObject({ status: 'unsubscribed' });
      expect(await worker.claimOutboxEntryForDispatch({ outboxId, leasedAt: now })).toBe(false);
      expect((await client.query(
        'SELECT status, payload FROM waste_email_reminder_outbox WHERE id = $1', [outboxId]
      )).rows[0]).toEqual({
        status: result === 'completed' ? 'sent' : 'cancelled',
        payload: {},
      });
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('does not enqueue a stale reminder payload after a concurrent revocation', async () => {
    const now = testTimestamp();
    const id = await createSubscription('active', tomorrow());
    const expiry = repositoryFor(client);
    const stalePlanner = repositoryFor(concurrent);
    const plannerPid = (await concurrent.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
    await client.query('BEGIN');
    try {
      expect(await expiry.unsubscribeByTokenHash({ tokenHash: `unsub-${id}`, now })).toMatchObject({
        status: 'unsubscribed',
      });
      const enqueue = stalePlanner.enqueueOutboxEntry({
        id: randomUUID(), subscriptionId: id, messageKind: 'reminder',
        transportId: 'smtp', templateKey: 'test-reminder', sendAt: now,
        dedupeKey: `reminder:${id}`,
        payload: {
          orderId: id, messageKind: 'transactional', transportId: 'smtp',
          templateKey: 'test-reminder', addresses: [{ kind: 'to', email: recipient }],
          templatePayload: {},
        },
      });
      await vi.waitFor(async () => {
        const row = (await client.query(
          'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [plannerPid]
        )).rows[0];
        expect(row?.wait_event_type).toBe('Lock');
      });
      await client.query('COMMIT');
      expect(await enqueue).toBe('duplicate');
      expect((await client.query('SELECT id FROM waste_email_reminder_outbox WHERE subscription_id = $1', [id])).rows).toEqual([]);
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
