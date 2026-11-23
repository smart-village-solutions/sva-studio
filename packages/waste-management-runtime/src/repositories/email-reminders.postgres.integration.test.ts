import { randomUUID } from 'node:crypto';
import type { MailDispatchPayload } from '@sva/core';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSqlExecutor } from '../operations/waste-management-operations.shared.js';
import { applySchemaStatements } from '../operations/waste-management-operations.schema.js';
import { createWasteEmailReminderRepository } from './email-reminders.js';
import { loadWasteEmailMonitoring } from './email-reminders.monitoring.js';
import { outboxDispatchStatements } from './email-reminders.outbox-dispatch.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 2 }) : null;
const schema = `waste_email_delivery_${randomUUID().replaceAll('-', '')}`;
let client: PoolClient;
let concurrent: PoolClient;
const createRepository = (connection = client) =>
  createWasteEmailReminderRepository(createSqlExecutor(connection));

const createSubscription = async () => {
  const id = randomUUID();
  const city = await client.query('INSERT INTO waste_cities (name) VALUES ($1) RETURNING id', [id]);
  await client.query(
    `INSERT INTO waste_email_reminder_subscriptions
     (id, status, email, email_hash, city_id, street_id, location_label, consent_version,
      consent_accepted_at, expires_at, doi_token_hash, unsubscribe_token_hash)
     VALUES ($1, 'active', 'fixture@example.invalid', $2, $3, 'fixture-street', 'Fixture', 'v1',
       NOW(), NOW() + INTERVAL '48 hours', $4, $5)`,
    [id, `email-${id}`, city.rows[0]?.id, `doi-${id}`, `unsub-${id}`]
  );
  return id;
};

const makePayload = (
  subscriptionId: string,
  memberKeys?: readonly string[]
): MailDispatchPayload => ({
  orderId: subscriptionId,
  transportId: 'smtp',
  messageKind: 'transactional',
  templateKey: 'waste.email-reminder.reminder',
  addresses: [{ kind: 'to', email: 'fixture@example.invalid' }],
  templatePayload: { fractionName: 'Fixture' },
  metadata: {
    pickupDate: '2027-01-04',
    ...(memberKeys ? { reminderMemberKeys: JSON.stringify(memberKeys) } : {}),
  },
});

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

describe.skipIf(!databaseUrl)('Email reminder outbox against PostgreSQL', () => {
  beforeAll(async () => {
    if (!pool) return;
    client = await pool.connect();
    concurrent = await pool.connect();
    for (const statement of applySchemaStatements(schema)) await client.query(statement);
    await client.query(`SET search_path TO ${schema}, public`);
    await concurrent.query(`SET search_path TO ${schema}, public`);
  }, 60_000);

  afterAll(async () => {
    client?.release();
    concurrent?.release();
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    }
  });

  it.each([undefined, 'provider-message-1'])(
    'marks a delivered message sent with provider ID %s',
    async (providerMessageId) => {
      const subscriptionId = await createSubscription();
      const outboxId = randomUUID();
      const leasedAt = '2026-10-20T06:00:00.000Z';
      await client.query(
        `INSERT INTO waste_email_reminder_outbox
       (id, subscription_id, message_kind, transport_id, template_key, send_at, dedupe_key,
        status, leased_at, last_error, payload)
       VALUES ($1, $2, 'reminder', 'smtp', 'template', $3, $1::uuid::text,
         'processing', $3, 'dispatch_claimed', '{}')`,
        [outboxId, subscriptionId, leasedAt]
      );

      const statement = outboxDispatchStatements.markOutboxEntrySent({
        outboxId,
        now: '2026-10-20T06:01:00.000Z',
        leasedAt,
        ...(providerMessageId ? { providerMessageId } : {}),
      });
      const result = await client.query(statement.text, statement.values);

      expect(result.rowCount).toBe(1);
      const saved = await client.query<{ status: string; last_error: string | null }>(
        'SELECT status, last_error FROM waste_email_reminder_outbox WHERE id = $1::uuid',
        [outboxId]
      );
      expect(saved.rows[0]).toEqual({
        status: 'sent',
        last_error: providerMessageId ? `provider_message_id:${providerMessageId}` : null,
      });
    }
  );

  it('reserves a reminder after provider acceptance if the claim transaction rolls back', async () => {
    const subscriptionId = await createSubscription();
    const outboxId = randomUUID();
    const leasedAt = '2027-01-03T06:00:00.000Z';
    const repository = createRepository();
    const payload = makePayload(subscriptionId, [
      `reminder:${subscriptionId}:member:first:2027-01-04`,
    ]);
    await repository.enqueueOutboxEntry({
      id: outboxId,
      subscriptionId,
      messageKind: 'reminder',
      transportId: 'smtp',
      templateKey: 'waste.email-reminder.reminder',
      sendAt: leasedAt,
      dedupeKey: `reminder-group:${subscriptionId}:2027-01-04:${leasedAt}`,
      payload: { ...payload, templatePayload: { fractionName: 'Biotonne, Papiertonne' } },
    });
    expect((await repository.leaseDueOutboxEntries({ now: leasedAt, limit: 1 }))[0]?.id).toBe(
      outboxId
    );
    let providerHandoffs = 0;
    await expect(
      inTransaction(client, async () => {
        expect(await repository.claimOutboxEntryForDispatch({ outboxId, leasedAt })).toBe(true);
        providerHandoffs += 1;
        await repository.markOutboxEntrySent({
          outboxId,
          leasedAt,
          now: leasedAt,
          providerMessageId: 'accepted',
        });
        throw new Error('crash before commit');
      })
    ).rejects.toThrow('crash before commit');
    const expired = '2027-01-03T07:00:00.000Z';
    expect(await repository.markUnresolvedReminderDeliveries({ now: expired })).toBe(1);
    expect(await repository.leaseDueOutboxEntries({ now: expired, limit: 1 })).toEqual([]);
    expect(providerHandoffs).toBe(1);
    expect(
      (
        await client.query(
          'SELECT status, last_error FROM waste_email_reminder_outbox WHERE id = $1',
          [outboxId]
        )
      ).rows
    ).toEqual([{ status: 'failed', last_error: 'mail_dispatch_outcome_unknown' }]);
    const monitoring = await loadWasteEmailMonitoring(createSqlExecutor(client), {
      page: 1,
      pageSize: 25,
      deliveryPage: 1,
      subscriptionId,
    });
    expect(monitoring.deliveries).toMatchObject([
      {
        id: outboxId,
        error: 'outcome_unknown',
        fraction: 'Biotonne, Papiertonne',
      },
    ]);
    expect(
      await repository.unsubscribeByTokenHash({
        tokenHash: `unsub-${subscriptionId}`,
        now: expired,
      })
    ).toMatchObject({ status: 'unsubscribed' });
    const revoked = await client.query(
      `SELECT s.email, s.email_hash, o.payload, o.last_error, o.status
       FROM waste_email_reminder_subscriptions s
       JOIN waste_email_reminder_outbox o ON o.subscription_id = s.id
       WHERE o.id = $1`,
      [outboxId]
    );
    expect(revoked.rows).toEqual([
      {
        email: null,
        email_hash: null,
        payload: {},
        last_error: 'mail_dispatch_outcome_unknown',
        status: 'failed',
      },
    ]);
  });

  it('atomically replaces a waiting legacy order and serializes two planners and leases', async () => {
    const subscriptionId = await createSubscription();
    const plannedAt = '2027-01-03T06:00:00.000Z';
    const pickupDate = '2027-01-04';
    const waitingKey = `reminder:${subscriptionId}:paper:paper:first:${pickupDate}`;
    const sentKey = `reminder:${subscriptionId}:bio:bio:first:${pickupDate}`;
    const groupKey = `reminder-group:${subscriptionId}:${pickupDate}:${plannedAt}`;
    const waitingId = randomUUID();
    const sentId = randomUUID();
    const actualEntry = (id: string, dedupeKey: string, memberKeys?: readonly string[]) => ({
      id,
      subscriptionId,
      messageKind: 'reminder' as const,
      transportId: 'smtp',
      templateKey: 'waste.email-reminder.reminder',
      sendAt: plannedAt,
      dedupeKey,
      payload: makePayload(subscriptionId, memberKeys),
    });
    const repository = createRepository();
    await repository.enqueueOutboxEntry(actualEntry(waitingId, waitingKey));
    await repository.enqueueOutboxEntry(actualEntry(sentId, sentKey));
    await client.query(
      "UPDATE waste_email_reminder_outbox SET status = 'sent', attempt_count = 1 WHERE id = $1",
      [sentId]
    );

    const plan = async (connection: PoolClient, abort = false) =>
      inTransaction(connection, async () => {
        const planning = createRepository(connection);
        const orders = await planning.loadLockedReminderPlanningOrders({
          subscriptionId,
          pickupDates: [pickupDate],
          dedupeKeys: [waitingKey, sentKey, groupKey],
        });
        expect(orders).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ dedupeKey: sentKey, status: 'sent', attemptCount: 1 }),
          ])
        );
        const result = await planning.enqueueOutboxEntry(
          actualEntry(randomUUID(), groupKey, [waitingKey])
        );
        await planning.cancelInvalidReminderOutboxEntries({
          now: plannedAt,
          validDedupeKeys: [groupKey],
        });
        if (abort) throw new Error('abort transition');
        return result;
      });
    const readOrders = async () => {
      const { rows } = await client.query(
        'SELECT dedupe_key, status FROM waste_email_reminder_outbox WHERE subscription_id = $1 ORDER BY dedupe_key',
        [subscriptionId]
      );
      return rows;
    };
    await expect(plan(client, true)).rejects.toThrow('abort transition');
    expect(await readOrders()).toEqual([
      { dedupe_key: sentKey, status: 'sent' },
      { dedupe_key: waitingKey, status: 'pending' },
    ]);
    expect(await Promise.all([plan(client), plan(concurrent)])).toEqual(['inserted', 'refreshed']);
    expect(await readOrders()).toEqual(
      expect.arrayContaining([
        { dedupe_key: groupKey, status: 'pending' },
        { dedupe_key: sentKey, status: 'sent' },
        { dedupe_key: waitingKey, status: 'cancelled' },
      ])
    );
    expect(await readOrders()).toHaveLength(3);
    const leases = await Promise.all([
      repository.leaseDueOutboxEntries({ now: plannedAt, limit: 1 }),
      createRepository(concurrent).leaseDueOutboxEntries({ now: plannedAt, limit: 1 }),
    ]);
    expect(leases.flat()).toEqual([
      expect.objectContaining({
        dedupeKey: groupKey,
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            reminderMemberKeys: JSON.stringify([waitingKey]),
          }),
        }),
      }),
    ]);
  });

  it('keeps the original group on a safe retry and drops it on revocation', async () => {
    const subscriptionId = await createSubscription();
    const outboxId = randomUUID();
    const plannedAt = '2027-02-03T06:00:00.000Z';
    const retryAt = '2027-02-03T06:10:00.000Z';
    const pickupDate = '2027-02-04';
    const dedupeKey = `reminder-group:${subscriptionId}:${pickupDate}:${plannedAt}`;
    const memberKeys = [`reminder:${subscriptionId}:paper:paper:first:${pickupDate}`];
    const payload = makePayload(subscriptionId, memberKeys);
    const repository = createRepository();
    await repository.enqueueOutboxEntry({
      id: outboxId,
      subscriptionId,
      messageKind: 'reminder',
      transportId: 'smtp',
      templateKey: 'waste.email-reminder.reminder',
      sendAt: plannedAt,
      dedupeKey,
      payload: {
        ...payload,
        metadata: { ...payload.metadata, pickupDate, originalSendAt: plannedAt },
      },
    });
    const leased = await repository.leaseDueOutboxEntries({ now: plannedAt, limit: 10 });
    expect(leased.find(({ id }) => id === outboxId)?.dedupeKey).toBe(dedupeKey);
    await inTransaction(client, async () => {
      expect(await repository.claimOutboxEntryForDispatch({ outboxId, leasedAt: plannedAt })).toBe(
        true
      );
      expect(
        await repository.markOutboxEntryFailed({
          outboxId,
          leasedAt: plannedAt,
          now: plannedAt,
          errorMessage: 'mail_transport_not_available',
          retryAt,
        })
      ).toBe(true);
    });
    const saved = await client.query(
      'SELECT dedupe_key, send_at, status, payload FROM waste_email_reminder_outbox WHERE id = $1',
      [outboxId]
    );
    expect(saved.rows[0]).toMatchObject({
      dedupe_key: dedupeKey,
      send_at: new Date(retryAt),
      status: 'pending',
      payload: {
        metadata: { originalSendAt: plannedAt, reminderMemberKeys: JSON.stringify(memberKeys) },
      },
    });
    expect(
      await createRepository(concurrent).unsubscribeByTokenHash({
        tokenHash: `unsub-${subscriptionId}`,
        now: '2027-02-03T06:05:00.000Z',
      })
    ).toMatchObject({ status: 'unsubscribed' });
    expect(await repository.leaseDueOutboxEntries({ now: retryAt, limit: 10 })).toEqual([]);
    expect(
      (
        await client.query(
          'SELECT status, payload FROM waste_email_reminder_outbox WHERE id = $1',
          [outboxId]
        )
      ).rows
    ).toEqual([{ status: 'cancelled', payload: {} }]);
  });
});
