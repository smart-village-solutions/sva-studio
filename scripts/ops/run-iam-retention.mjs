#!/usr/bin/env node
import { Pool } from 'pg';

const databaseUrl = process.env.IAM_DATABASE_URL;

if (!databaseUrl) {
  console.error('[run-iam-retention] IAM_DATABASE_URL fehlt.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  idleTimeoutMillis: 10_000,
});

const anonymizeSql = `
WITH candidates AS (
  SELECT a.id
  FROM iam.accounts a
  JOIN iam.instances i ON i.id = a.instance_id
  WHERE a.soft_deleted_at IS NOT NULL
    AND a.permanently_deleted_at IS NULL
    AND a.soft_deleted_at < NOW() - make_interval(days => i.retention_days)
)
UPDATE iam.accounts a
SET
  email_ciphertext = NULL,
  display_name_ciphertext = NULL,
  first_name_ciphertext = NULL,
  last_name_ciphertext = NULL,
  phone_ciphertext = NULL,
  notes = NULL,
  permanently_deleted_at = NOW(),
  updated_at = NOW()
FROM candidates
WHERE a.id = candidates.id
RETURNING a.id;
`;

const archiveSql = `
WITH archive_candidates AS (
  SELECT
    al.id,
    al.instance_id,
    al.account_id,
    al.subject_id,
    al.event_type,
    al.result,
    al.payload,
    al.request_id,
    al.trace_id,
    al.created_at
  FROM iam.activity_logs al
  JOIN iam.instances i ON i.id = al.instance_id
  WHERE al.created_at < NOW() - make_interval(days => i.audit_retention_days)
),
archived AS (
  INSERT INTO iam.activity_logs_archive (
    instance_id,
    activity_log_id,
    account_id,
    subject_id,
    event_type,
    result,
    payload,
    request_id,
    trace_id,
    original_created_at
  )
  SELECT
    c.instance_id,
    c.id,
    c.account_id,
    c.subject_id,
    c.event_type,
    c.result,
    c.payload,
    c.request_id,
    c.trace_id,
    c.created_at
  FROM archive_candidates c
  ON CONFLICT (activity_log_id) DO NOTHING
  RETURNING activity_log_id
)
DELETE FROM iam.activity_logs al
USING archived
WHERE al.id = archived.activity_log_id
RETURNING al.id;
`;

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const anonymized = await client.query(anonymizeSql);
    const archived = await client.query(archiveSql);

    await client.query('COMMIT');

    console.log(
      `[run-iam-retention] done anonymized=${anonymized.rowCount} archived=${archived.rowCount}`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[run-iam-retention] failed', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error('[run-iam-retention] unexpected error', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
