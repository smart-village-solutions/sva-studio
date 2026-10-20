import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { outboxDispatchStatements } from './email-reminders.outbox-dispatch.js';

const databaseUrl = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : null;
let client: PoolClient | null = null;

describe.skipIf(!databaseUrl)('Email reminder outbox against PostgreSQL', () => {
  beforeAll(async () => {
    if (!pool) return;
    client = await pool.connect();
    await client.query(`
      CREATE TEMP TABLE waste_email_reminder_outbox (
        id uuid PRIMARY KEY,
        status text NOT NULL,
        sent_at timestamptz,
        leased_at timestamptz,
        updated_at timestamptz,
        last_error text
      )
    `);
  });

  afterAll(async () => {
    client?.release();
    await pool?.end();
  });

  it.each([undefined, 'provider-message-1'])('marks a delivered message sent with provider ID %s', async (providerMessageId) => {
    if (!client) throw new Error('integration client not initialized');
    const outboxId = randomUUID();
    const leasedAt = '2026-10-20T06:00:00.000Z';
    await client.query(
      `INSERT INTO waste_email_reminder_outbox (id, status, leased_at, last_error)
       VALUES ($1::uuid, 'processing', $2::timestamptz, 'dispatch_claimed')`,
      [outboxId, leasedAt]
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
  });
});
