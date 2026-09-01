import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const authRuntimePackage = [
  resolve('node_modules/@sva/auth-runtime/package.json'),
  resolve('apps/sva-studio-react/node_modules/@sva/auth-runtime/package.json'),
].find((candidate) => existsSync(candidate));
if (!authRuntimePackage) throw new Error('auth_runtime_package_not_found');

const requireFromAuthRuntime = createRequire(realpathSync(authRuntimePackage));
const { runMigrations } = requireFromAuthRuntime('graphile-worker');
const { Pool } = requireFromAuthRuntime('pg');

const required = ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
for (const key of required) {
  if (!process.env[key]?.trim()) throw new Error(`missing_required_environment_variable:${key}`);
}

const user = encodeURIComponent(process.env.POSTGRES_USER.trim());
const password = encodeURIComponent(process.env.POSTGRES_PASSWORD.trim());
const host = process.env.POSTGRES_HOST?.trim() || 'postgres';
const port = process.env.POSTGRES_PORT?.trim() || '5432';
const database = encodeURIComponent(process.env.POSTGRES_DB.trim());
const pool = new Pool({
  connectionString: `postgres://${user}:${password}@${host}:${port}/${database}`,
  max: 2,
});

try {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS graphile_worker AUTHORIZATION CURRENT_USER;
    ALTER SCHEMA graphile_worker OWNER TO CURRENT_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA graphile_worker REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  `);
  await runMigrations({ pgPool: pool });
  await pool.query(`
    BEGIN;

    REVOKE ALL ON SCHEMA graphile_worker FROM PUBLIC;
    REVOKE ALL ON ALL TABLES IN SCHEMA graphile_worker FROM PUBLIC;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA graphile_worker FROM PUBLIC;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphile_worker FROM PUBLIC;

    DROP FUNCTION IF EXISTS graphile_worker.sva_enqueue_job(text, json, text, integer, text);

    CREATE OR REPLACE FUNCTION graphile_worker.sva_enqueue_job(
      identifier text,
      payload json,
      queue_name text,
      max_attempts integer,
      job_key text,
      run_at timestamptz DEFAULT NULL
    ) RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, graphile_worker
    AS $enqueue$
    BEGIN
      IF identifier NOT IN (
        'studio_job_execute',
        'studio_job_execute_privileged',
        'plugin_tenant_lifecycle_retry'
      ) THEN
        RAISE EXCEPTION 'unsupported_studio_job_identifier' USING ERRCODE = '22023';
      END IF;
      IF json_typeof(payload) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid_studio_job_payload' USING ERRCODE = '22023';
      END IF;
      IF queue_name IS NULL OR length(queue_name) NOT BETWEEN 1 AND 128 THEN
        RAISE EXCEPTION 'invalid_studio_job_queue' USING ERRCODE = '22023';
      END IF;
      IF max_attempts NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'invalid_studio_job_attempts' USING ERRCODE = '22023';
      END IF;
      IF job_key IS NULL OR length(job_key) NOT BETWEEN 1 AND 256 THEN
        RAISE EXCEPTION 'invalid_studio_job_key' USING ERRCODE = '22023';
      END IF;

      PERFORM graphile_worker.add_job(
        identifier => identifier,
        payload => payload,
        queue_name => queue_name,
        max_attempts => max_attempts,
        job_key => job_key,
        run_at => COALESCE(run_at, now())
      );
    END
    $enqueue$;

    REVOKE ALL ON FUNCTION graphile_worker.sva_enqueue_job(text, json, text, integer, text, timestamptz) FROM PUBLIC;

    DO $ownership$
    DECLARE
      object_record record;
    BEGIN
      ALTER SCHEMA graphile_worker OWNER TO CURRENT_USER;

      FOR object_record IN
        SELECT c.relkind, c.oid::regclass AS object_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'graphile_worker'
          AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
          AND (
            c.relkind <> 'S'
            OR NOT EXISTS (
              SELECT 1
              FROM pg_depend d
              WHERE d.classid = 'pg_class'::regclass
                AND d.objid = c.oid
                AND d.refclassid = 'pg_class'::regclass
                AND d.deptype IN ('a', 'i')
            )
          )
      LOOP
        IF object_record.relkind = 'S' THEN
          EXECUTE format('ALTER SEQUENCE %s OWNER TO %I', object_record.object_name, current_user);
        ELSIF object_record.relkind = 'v' THEN
          EXECUTE format('ALTER VIEW %s OWNER TO %I', object_record.object_name, current_user);
        ELSIF object_record.relkind = 'm' THEN
          EXECUTE format('ALTER MATERIALIZED VIEW %s OWNER TO %I', object_record.object_name, current_user);
        ELSE
          EXECUTE format('ALTER TABLE %s OWNER TO %I', object_record.object_name, current_user);
        END IF;
      END LOOP;

      FOR object_record IN
        SELECT p.oid::regprocedure AS object_name
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'graphile_worker'
      LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO %I', object_record.object_name, current_user);
      END LOOP;
    END
    $ownership$;

    COMMIT;
  `);
} finally {
  await pool.end();
}
