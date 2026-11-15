/** Real PostgreSQL evidence for destructive fraction operations, including rollback and drift. */
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySchemaStatements } from '../operations/waste-management-operations.schema.js';
import { buildWasteTourFractionsContractStatements } from '../operations/waste-tour-fractions.schema.js';
import { processWasteFractionDeletion } from './fraction-deletion.js';

const url = process.env.WASTE_DATE_SHIFT_TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 3 }) : null;
const schema = `fraction_delete_${randomUUID().replaceAll('-', '')}`;
let client: PoolClient;
const source = randomUUID(),
  target = randomUUID(),
  other = randomUUID();
const tour = randomUUID(),
  location = randomUUID(),
  city = randomUUID();
const input = { fractionId: source, mode: 'detach' as const };
const execute = async (mode: 'detach' | 'replace' | 'delete-tours', targetFractionId?: string) => {
  const request = { fractionId: source, mode, ...(targetFractionId ? { targetFractionId } : {}) };
  const preview = await processWasteFractionDeletion(client, request);
  return processWasteFractionDeletion(client, request, preview.token);
};
const count = async (table: string) =>
  Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);

describe.skipIf(!url)('fraction deletion PostgreSQL', () => {
  beforeAll(async () => {
    client = await pool!.connect();
    for (const sql of applySchemaStatements(schema)) await client.query(sql);
    await client.query(`SET search_path TO ${schema}, public`);
  }, 60_000);
  beforeEach(async () => {
    await client.query('TRUNCATE waste_fractions, waste_cities, waste_tours CASCADE');
    await client.query(
      "INSERT INTO waste_fractions(id,name,pdf_short_label,color,active) VALUES ($1,'Source','SRC','#000000',true),($2,'Target','TGT','#111111',true),($3,'Other','OTH','#222222',true)",
      [source, target, other]
    );
    await client.query("INSERT INTO waste_cities(id,name) VALUES ($1,'City')", [city]);
    await client.query(
      'INSERT INTO waste_collection_locations(id,city_id,active) VALUES ($1,$2,true)',
      [location, city]
    );
    await client.query(
      "INSERT INTO waste_tours(id,name,waste_fraction_ids,status,active,recurrence,first_date,end_date) VALUES ($1,'Tour',$2,'published',true,'weekly','2030-01-01','2030-12-31')",
      [tour, [source, other]]
    );
    await client.query(
      'INSERT INTO waste_location_tour_links(location_id,tour_id) VALUES ($1,$2)',
      [location, tour]
    );
    await client.query(
      "INSERT INTO waste_location_tour_pickup_dates(location_id,tour_id,pickup_date,note) VALUES ($1,$2,'2030-01-03','keep note')",
      [location, tour]
    );
    const assignment = randomUUID();
    await client.query(
      "INSERT INTO waste_tour_assignments(id,tour_id,pickup_date,note) VALUES ($1,$2,'2030-01-04','assignment note')",
      [assignment, tour]
    );
    await client.query('INSERT INTO waste_tour_assignment_locations VALUES ($1,$2)', [
      assignment,
      location,
    ]);
    await client.query(
      "INSERT INTO waste_tour_date_shifts(tour_id,original_date,actual_date,has_year) VALUES ($1,'2030-01-01','2030-01-02',true)",
      [tour]
    );
  });
  afterAll(async () => {
    if (client) {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      client.release();
    }
    await pool?.end();
  });
  it('detaches while preserving tour identity, other fractions, notes, dates and locations', async () => {
    const result = await execute('detach');
    expect(result.canDetach).toBe(true);
    expect(
      (
        await client.query('SELECT fraction_id::text FROM waste_tour_fractions WHERE tour_id=$1', [
          tour,
        ])
      ).rows
    ).toEqual([{ fraction_id: other }]);
    expect(await count('waste_tours')).toBe(1);
    expect(await count('waste_tour_assignments')).toBe(1);
    expect(await count('waste_location_tour_pickup_dates')).toBe(1);
    expect(
      (await client.query('SELECT note FROM waste_location_tour_pickup_dates')).rows[0].note
    ).toBe('keep note');
    expect(await count('waste_collection_locations')).toBe(1);
    expect(await count('waste_fractions')).toBe(2);
  });
  it('rejects an empty resulting tour and a changed confirmation without partial writes', async () => {
    const initial = await processWasteFractionDeletion(client, input);
    await client.query('SELECT replace_waste_tour_fractions($1,$2)', [tour, [source]]);
    await expect(processWasteFractionDeletion(client, input, initial.token)).rejects.toThrow(
      'fraction_preview_stale'
    );
    const blocked = await processWasteFractionDeletion(client, input);
    expect(blocked.canDetach).toBe(false);
    await expect(processWasteFractionDeletion(client, input, blocked.token)).rejects.toThrow(
      'fraction_delete_blocked:empty-tour'
    );
    expect(await count('waste_fractions')).toBe(3);
  });
  it('replaces without duplicate target assignments and retains existing target position', async () => {
    await client.query('SELECT replace_waste_tour_fractions($1,$2)', [
      tour,
      [other, source, target],
    ]);
    await execute('replace', target);
    const result = await client.query(
      'SELECT fraction_id::text FROM waste_tour_fractions WHERE tour_id=$1 ORDER BY position',
      [tour]
    );
    expect(result.rows.map((r) => r.fraction_id)).toEqual([other, target]);
    expect(await count('waste_tour_assignments')).toBe(1);
  });
  it('cascades every tour dependency, retaining other fraction records and unrelated tours', async () => {
    await client.query(
      "INSERT INTO waste_tours(name,waste_fraction_ids,status,active) VALUES ('Unaffected',$1,'archived',false)",
      [[other]]
    );
    const preview = await execute('delete-tours');
    expect(preview.counts).toMatchObject({ links: 1, pickupDates: 1, assignments: 1, shifts: 1 });
    for (const table of [
      'waste_location_tour_links',
      'waste_location_tour_pickup_dates',
      'waste_tour_assignments',
      'waste_tour_assignment_locations',
      'waste_tour_date_shifts',
    ])
      expect(await count(table)).toBe(0);
    expect(await count('waste_tours')).toBe(1);
    expect(await count('waste_fractions')).toBe(2);
    expect(await count('waste_collection_locations')).toBe(1);
  });
  it('blocks real pickup collisions and returns readable tour and location labels', async () => {
    const competing = randomUUID();
    await client.query(
      "INSERT INTO waste_tours(id,name,waste_fraction_ids,status,active,recurrence,first_date,end_date) VALUES ($1,'Target Tour',$2,'published',true,'weekly','2030-01-01','2030-12-31')",
      [competing, [target]]
    );
    await client.query(
      'INSERT INTO waste_location_tour_links(location_id,tour_id) VALUES ($1,$2)',
      [location, competing]
    );
    const request = { fractionId: source, mode: 'replace' as const, targetFractionId: target };
    const preview = await processWasteFractionDeletion(client, request);
    expect(preview.blockedReason).toBe('date-conflict');
    expect(preview.conflicts[0].locationLabel).toBe('City');
    expect(new Set(preview.conflicts[0].tourNames)).toEqual(new Set(['Tour', 'Target Tour']));
    await expect(processWasteFractionDeletion(client, request, preview.token)).rejects.toThrow(
      'fraction_delete_blocked:date-conflict'
    );
    expect(await count('waste_fractions')).toBe(3);
  });
  it('rolls back changed assignments when the final delete fails', async () => {
    await client.query(
      `CREATE FUNCTION reject_fraction_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test_delete_failure'; END $$`
    );
    await client.query(
      'CREATE TRIGGER reject_fraction_delete BEFORE DELETE ON waste_fractions FOR EACH ROW EXECUTE FUNCTION reject_fraction_delete()'
    );
    try {
      await expect(execute('replace', target)).rejects.toThrow('test_delete_failure');
      expect(
        (
          await client.query(
            'SELECT fraction_id::text FROM waste_tour_fractions WHERE tour_id=$1 ORDER BY position',
            [tour]
          )
        ).rows.map((r) => r.fraction_id)
      ).toEqual([source, other]);
    } finally {
      await client.query(
        'DROP TRIGGER reject_fraction_delete ON waste_fractions; DROP FUNCTION reject_fraction_delete()'
      );
    }
  });
  it('removes source reminder selections, cancels unsent keys and blocks an active dispatch claim', async () => {
    const subscription = randomUUID();
    await client.query(
      `INSERT INTO waste_email_reminder_subscriptions
      (id,email,email_hash,city_id,street_id,location_label,consent_version,consent_accepted_at,doi_token_hash,unsubscribe_token_hash,expires_at,status)
      VALUES ($1::uuid,'fixture@example.test','hash',$2,'all','City','v1',NOW(),$1::text,$1::text,'2099-01-01','active')`,
      [subscription, city]
    );
    await client.query(
      "INSERT INTO waste_email_reminder_subscription_items(subscription_id,fraction_id,slot_id) VALUES ($1,$2,'first'),($1,$3,'first')",
      [subscription, source, other]
    );
    await client.query(
      `INSERT INTO waste_email_reminder_outbox
      (subscription_id,message_kind,transport_id,template_key,send_at,dedupe_key,payload,status,last_error,leased_at)
      VALUES ($1,'reminder','mail','reminder','2030-01-01',$2,'{}','processing','dispatch_claimed',NOW())`,
      [subscription, `reminder:${subscription}:${source}:first:2030-01-04`]
    );
    const blocked = await processWasteFractionDeletion(client, input);
    expect(blocked.blockedReason).toBe('reminder-dispatching');
    await expect(processWasteFractionDeletion(client, input, blocked.token)).rejects.toThrow(
      'fraction_delete_blocked:reminder-dispatching'
    );
    await client.query("UPDATE waste_email_reminder_outbox SET status='pending',last_error=NULL");
    const allowed = await execute('replace', target);
    expect(allowed.counts).toMatchObject({ reminderItems: 1, pendingReminders: 1 });
    expect(
      (await client.query('SELECT fraction_id::text FROM waste_email_reminder_subscription_items'))
        .rows
    ).toEqual([{ fraction_id: other }]);
    expect(
      (await client.query('SELECT status FROM waste_email_reminder_outbox')).rows[0].status
    ).toBe('cancelled');
    expect(await count('waste_email_reminder_subscriptions')).toBe(1);
  });
  it('cancels other-fraction reminders only when their last pickup is deleted', async () => {
    const subscription = randomUUID();
    await client.query(
      `INSERT INTO waste_email_reminder_subscriptions
      (id,email,email_hash,city_id,street_id,location_label,consent_version,consent_accepted_at,doi_token_hash,unsubscribe_token_hash,expires_at,status)
      VALUES ($1::uuid,'fixture@example.test','hash',$2,'all','City','v1',NOW(),$1::text,$1::text,'2099-01-01','active')`,
      [subscription, city]
    );
    await client.query(
      "INSERT INTO waste_email_reminder_subscription_items(subscription_id,fraction_id,slot_id) VALUES ($1,$2,'first')",
      [subscription, other]
    );
    const surviving = randomUUID();
    await client.query(
      "INSERT INTO waste_tours(id,name,waste_fraction_ids,status,active) VALUES ($1,'Surviving',$2,'published',true)",
      [surviving, [other]]
    );
    await client.query(
      "INSERT INTO waste_tour_assignments(id,tour_id,pickup_date) VALUES ($1,$2,'2030-01-04')",
      [surviving, surviving]
    );
    await client.query('INSERT INTO waste_tour_assignment_locations VALUES ($1,$2)', [
      surviving,
      location,
    ]);
    for (const date of ['2030-01-04', '2030-01-03'])
      await client.query(
        `INSERT INTO waste_email_reminder_outbox
      (subscription_id,message_kind,transport_id,template_key,send_at,dedupe_key,payload)
      VALUES ($1,'reminder','mail','reminder','2030-01-01',$2,'{}')`,
        [subscription, `reminder:${subscription}:${other}:first:${date}`]
      );
    await execute('delete-tours');
    const rows = await client.query(
      'SELECT right(dedupe_key,10) AS date,status FROM waste_email_reminder_outbox ORDER BY date'
    );
    expect(rows.rows).toEqual([
      { date: '2030-01-03', status: 'cancelled' },
      { date: '2030-01-04', status: 'pending' },
    ]);
  });
  it('uses the application principal without direct relation-write privileges', async () => {
    const role = `fraction_app_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE ROLE ${role}; GRANT USAGE ON SCHEMA ${schema} TO ${role};
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role};
      REVOKE INSERT,UPDATE,DELETE ON waste_tour_fractions FROM ${role};
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${role}`);
    try {
      await client.query(`SET ROLE ${role}`);
      await execute('replace', target);
      expect(await count('waste_fractions')).toBe(2);
    } finally {
      await client.query('RESET ROLE');
      await client.query(`DROP OWNED BY ${role}; DROP ROLE ${role}`);
    }
  });
  it('rejects unknown source and foreign target without touching the source', async () => {
    const foreign = randomUUID();
    await expect(
      processWasteFractionDeletion(client, { fractionId: foreign, mode: 'delete-tours' })
    ).rejects.toThrow('fraction_not_found');
    const request = { fractionId: source, mode: 'replace' as const, targetFractionId: foreign };
    const preview = await processWasteFractionDeletion(client, request);
    expect(preview.blockedReason).toBe('invalid-target');
    await expect(processWasteFractionDeletion(client, request, preview.token)).rejects.toThrow(
      'fraction_delete_blocked:invalid-target'
    );
    expect(await count('waste_fractions')).toBe(3);
  });
  it('waits for a reminder planning transaction before rechecking a confirmation', async () => {
    const preview = await processWasteFractionDeletion(client, {
      fractionId: source,
      mode: 'delete-tours',
    });
    const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const planner = await pool!.connect();
    let mutation: Promise<unknown> | undefined;
    try {
      await planner.query(`SET search_path TO ${schema}, public`);
      await planner.query('BEGIN');
      await planner.query(
        "SELECT pg_advisory_xact_lock_shared(hashtext(current_schema()), hashtext('waste-fraction-deletion'))"
      );
      const editor = await pool!.connect();
      try {
        await editor.query(`SET search_path TO ${schema}, public`);
        await editor.query('BEGIN');
        await editor.query("SET LOCAL lock_timeout = '100ms'");
        await editor.query(
          "UPDATE waste_tours SET description = 'Editing stays available' WHERE id=$1",
          [tour]
        );
        await editor.query('COMMIT');
      } finally {
        await editor.query('ROLLBACK');
        editor.release();
      }
      mutation = processWasteFractionDeletion(
        client,
        { fractionId: source, mode: 'delete-tours' },
        preview.token
      );
      const rejection = expect(mutation).rejects.toThrow('fraction_preview_stale');
      await vi.waitFor(async () => {
        const row = (
          await planner.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])
        ).rows[0];
        expect(row.wait_event_type).toBe('Lock');
      });
      // Outbox planning may also update data before committing. The deletion must reload afterwards.
      await planner.query(
        "INSERT INTO waste_tours(name,waste_fraction_ids,status,active) VALUES ('Concurrent',$1,'draft',false)",
        [[source]]
      );
      await planner.query('COMMIT');
      await rejection;
      expect(await count('waste_tours')).toBe(2);
    } finally {
      await planner.query('ROLLBACK');
      planner.release();
      await mutation?.catch(() => undefined);
    }
  });
  it.each([false, true])(
    'rechecks after a concurrent contracted writer commits (tour update: %s)',
    async (updateTour) => {
      const original = (
        await client.query(
          "SELECT pg_get_functiondef('replace_waste_tour_fractions(uuid,text[])'::regprocedure) AS sql"
        )
      ).rows[0].sql;
      const writer = await pool!.connect();
      let mutation: Promise<unknown> | undefined;
      try {
        await client.query(buildWasteTourFractionsContractStatements(schema)[2]);
        const preview = await processWasteFractionDeletion(client, input);
        const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await writer.query(`SET search_path TO ${schema}, public`);
        await writer.query('BEGIN');
        await writer.query('SELECT id FROM waste_tours WHERE id=$1 FOR UPDATE', [tour]);
        mutation = processWasteFractionDeletion(client, input, preview.token);
        const rejection = expect(mutation).rejects.toThrow('fraction_preview_stale');
        await vi.waitFor(async () => {
          const row = (
            await writer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])
          ).rows[0];
          expect(row.wait_event_type).toBe('Lock');
        });
        await writer.query('SELECT replace_waste_tour_fractions($1,$2)', [tour, [source, target]]);
        if (updateTour)
          await writer.query("UPDATE waste_tours SET description = 'Concurrent edit' WHERE id=$1", [
            tour,
          ]);
        await writer.query('COMMIT');
        await rejection;
        expect(
          (
            await client.query(
              'SELECT fraction_id::text FROM waste_tour_fractions WHERE tour_id=$1 ORDER BY position',
              [tour]
            )
          ).rows
        ).toEqual([{ fraction_id: source }, { fraction_id: target }]);
        expect(await count('waste_fractions')).toBe(3);
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
        await mutation?.catch(() => undefined);
        await client.query(original);
      }
    }
  );
  it('rejects a busy child-table writer without blocking its lock upgrade', async () => {
    const preview = await processWasteFractionDeletion(client, input);
    const writer = await pool!.connect();
    try {
      await writer.query(`SET search_path TO ${schema}, public`);
      await writer.query('BEGIN');
      await writer.query('SELECT id FROM waste_collection_locations WHERE id=$1 FOR UPDATE', [
        location,
      ]);
      await expect(
        processWasteFractionDeletion(client, input, preview.token)
      ).rejects.toMatchObject({ code: '55P03' });
      await writer.query("SET LOCAL lock_timeout = '100ms'");
      await writer.query('UPDATE waste_collection_locations SET active=false WHERE id=$1', [
        location,
      ]);
      await writer.query('COMMIT');
      await expect(processWasteFractionDeletion(client, input, preview.token)).rejects.toThrow(
        'fraction_preview_stale'
      );
      expect(await count('waste_fractions')).toBe(3);
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
    }
  });
  it('includes a concurrent committed new referencing tour in stale preview rejection', async () => {
    const preview = await processWasteFractionDeletion(client, {
      fractionId: source,
      mode: 'delete-tours',
    });
    const writer = await pool!.connect();
    try {
      await writer.query(`SET search_path TO ${schema},public`);
      await writer.query(
        "INSERT INTO waste_tours(name,waste_fraction_ids,status,active) VALUES ('Concurrent',$1,'draft',false)",
        [[source]]
      );
    } finally {
      writer.release();
    }
    await expect(
      processWasteFractionDeletion(
        client,
        { fractionId: source, mode: 'delete-tours' },
        preview.token
      )
    ).rejects.toThrow('fraction_preview_stale');
    expect(await count('waste_tours')).toBe(2);
    expect(await count('waste_fractions')).toBe(3);
  });
});
