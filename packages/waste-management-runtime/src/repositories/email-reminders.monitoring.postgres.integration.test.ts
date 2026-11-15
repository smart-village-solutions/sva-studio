import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applySchemaStatements } from '../operations/waste-management-operations.schema.js';
import { loadWasteEmailMonitoring } from './email-reminders.monitoring.js';
import type { SqlExecutor } from '@sva/data-repositories';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
const schema = `waste_email_monitoring_test_${randomUUID().replaceAll('-', '')}`;
const otherSchema = `${schema}_other`;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
let client: PoolClient;
const executor: SqlExecutor = {
  async execute(statement) {
    const result = await client.query(statement.text, [...(statement.values ?? [])]);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  },
};

describe.skipIf(!databaseUrl)('Email monitoring against PostgreSQL', () => {
  beforeAll(async () => {
    if (!pool) return;
    client = await pool.connect();
    for (const name of [schema, otherSchema]) {
      for (const statement of applySchemaStatements(name)) await client.query(statement);
    }
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query("SET DateStyle = 'SQL, DMY'");
    await client.query("SET TIME ZONE 'Pacific/Honolulu'");
  }, 60_000);
  afterAll(async () => {
    client?.release();
    if (pool) {
      for (const name of [schema, otherSchema])
        await pool.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
      await pool.end();
    }
  });

  it('reads real subscription items and outbox with stable UTC dates, filtering, pagination and tenant isolation', async () => {
    const city = (
      await client.query("INSERT INTO waste_cities (name) VALUES ('Testort') RETURNING id")
    ).rows[0].id;
    const fraction = (
      await client.query(
        "INSERT INTO waste_fractions (name,pdf_short_label) VALUES ('Bio','BIO') RETURNING id"
      )
    ).rows[0].id;
    const subscription = randomUUID();
    await client.query(
      `INSERT INTO waste_email_reminder_subscriptions
      (id,email,email_hash,city_id,street_id,location_label,consent_version,consent_accepted_at,
       doi_token_hash,unsubscribe_token_hash,expires_at,status,created_at,activated_at)
      VALUES ($1,'philipp@example.de','private-hash',$2,'private-street','private-location','v1',now(),
       'private-doi','private-unsubscribe',now(),'active','2026-11-01T10:00:00Z','2026-11-01T10:01:00Z')`,
      [subscription, city]
    );
    await client.query(
      "INSERT INTO waste_email_reminder_subscription_items (subscription_id,fraction_id,slot_id) VALUES ($1,$2,'bio:email:first')",
      [subscription, fraction]
    );
    await client.query(
      `INSERT INTO waste_email_reminder_outbox
      (subscription_id,message_kind,transport_id,template_key,send_at,dedupe_key,status,payload,last_error,attempt_count)
      VALUES ($1,'reminder','smtp','template','2026-11-02T09:00:00Z','unique','failed',$2,'provider failed: private@example.de',2)`,
      [
        subscription,
        JSON.stringify({
          recipient: 'philipp@example.de',
          templatePayload: { fractionName: 'Bio', unsubscribeUrl: 'private-token' },
          metadata: { pickupDate: '2026-11-03' },
        }),
      ]
    );
    const query = { page: 1, pageSize: 1, deliveryPage: 1, subscriptionId: subscription };
    const result = await loadWasteEmailMonitoring(executor, query);
    expect(result.total).toBe(1);
    expect(result.subscriptions[0]).toMatchObject({
      maskedEmail: 'p*****p@e********e',
      city: 'Testort',
      items: [{ fraction: 'Bio', slotId: 'bio:email:first' }],
      createdAt: '2026-11-01T10:00:00.000Z',
      activatedAt: '2026-11-01T10:01:00.000Z',
      lastSentEmail: null,
      nextEmail: null,
    });
    expect(result.deliveries[0]).toMatchObject({
      fraction: 'Bio',
      pickupDate: '2026-11-03',
      scheduledAt: '2026-11-02T09:00:00.000Z',
      attempts: 2,
      error: 'dispatch_failed',
    });
    expect(JSON.stringify(result)).not.toMatch(/philipp|private|unsubscribeUrl|recipient/);
    expect((await loadWasteEmailMonitoring(executor, { ...query, status: 'pending' })).total).toBe(
      0
    );
    const second = await loadWasteEmailMonitoring(executor, { ...query, page: 2, deliveryPage: 2 });
    expect(second).toMatchObject({ total: 1, subscriptions: [], deliveryTotal: 1, deliveries: [] });
    for (const [key, kind, status, sendAt, sentAt] of [
      ['old', 'doi', 'sent', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'],
      ['latest', 'reminder', 'sent', '2026-11-02T10:00:00Z', '2026-11-02T10:00:00Z'],
      ['ignored-failed', 'doi', 'failed', '2026-11-03T10:00:00Z', '2026-11-03T10:00:00Z'],
      ['ignored-cancelled', 'doi', 'cancelled', '2026-11-04T10:00:00Z', '2026-11-04T10:00:00Z'],
      ['next', 'doi', 'pending', '2026-11-02T06:00:00Z', null],
      ['later', 'reminder', 'pending', '2026-11-03T06:00:00Z', null],
      ['processing', 'reminder', 'processing', '2026-11-02T08:00:00Z', null],
    ]) {
      await client.query(
        `INSERT INTO waste_email_reminder_outbox
         (subscription_id,message_kind,transport_id,template_key,send_at,sent_at,dedupe_key,status,payload)
         VALUES ($1,$2,'smtp','template',$3,$4,$5,$6,'{}')`,
        [subscription, kind, sendAt, sentAt, key, status]
      );
    }
    const overview = await loadWasteEmailMonitoring(executor, query);
    expect(overview.subscriptions[0]).toMatchObject({
      lastSentEmail: { kind: 'reminder', sentAt: '2026-11-02T10:00:00.000Z' },
      nextEmail: {
        kind: 'reminder',
        status: 'processing',
        scheduledAt: '2026-11-02T08:00:00.000Z',
      },
    });
    await client.query(
      "UPDATE waste_email_reminder_outbox SET status='cancelled' WHERE dedupe_key='processing'"
    );
    expect((await loadWasteEmailMonitoring(executor, query)).subscriptions[0]?.nextEmail).toEqual({
      kind: 'doi',
      status: 'pending',
      scheduledAt: '2026-11-02T06:00:00.000Z',
    });
    expect(JSON.stringify(overview)).not.toMatch(/philipp|private|unsubscribeUrl|recipient/);
    await client.query(`SET search_path TO ${otherSchema}, public`);
    expect(await loadWasteEmailMonitoring(executor, query)).toEqual({
      total: 0,
      subscriptions: [],
      deliveryTotal: 0,
      deliveries: [],
    });
  });
});
