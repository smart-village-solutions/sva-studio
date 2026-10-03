import { randomUUID } from 'node:crypto';

import {
  activationPluginId,
  instanceId,
  observabilityOtherInstanceId,
  pluginId,
  scalar,
} from './plugin-lifecycle-contract-base.js';
import type { QueryClient } from './plugin-lifecycle-contract-base.js';

export const configureFixture = async (pool: QueryClient): Promise<void> => {
  await pool.query(
    `INSERT INTO iam.instances (
       id, display_name, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id
     )
     VALUES ($1, 'Lifecycle Contract', 'lifecycle-contract.test',
       'lifecycle-contract', 'sva-studio', 'sva-studio-admin')
     ON CONFLICT (id) DO NOTHING`,
    [instanceId]
  );
  await pool.query(
    `INSERT INTO iam.instance_modules (
       instance_id, module_id, activation_policy, activation_origin, effective_active,
       manual_override, manifest_version, policy_revision, state_revision
     ) VALUES ($1, $2, 'automatic', 'policy_reconcile', true, NULL, 1, 'contract-1', 1)
     ON CONFLICT (instance_id, module_id) DO UPDATE SET effective_active = true`,
    [instanceId, pluginId]
  );
  await pool.query(`
    CREATE SCHEMA lifecycle_contract;
    CREATE SEQUENCE lifecycle_contract.failpoint_hits;
    CREATE TABLE lifecycle_contract.control (name text PRIMARY KEY);
    CREATE TABLE lifecycle_contract.effects (
      effect_key text PRIMARY KEY,
      deliveries integer NOT NULL DEFAULT 1
    );
    CREATE FUNCTION lifecycle_contract.trip() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = pg_catalog, lifecycle_contract AS $fn$
    DECLARE configured text; hit bigint;
    BEGIN
      SELECT name INTO configured FROM control LIMIT 1;
      IF configured = TG_ARGV[0]
        AND (TG_NARGS < 2 OR (to_jsonb(NEW) ->> 'key') LIKE TG_ARGV[1]) THEN
        hit := nextval('failpoint_hits');
        IF hit = 1 THEN
          RAISE EXCEPTION 'plugin_lifecycle_failpoint:%', configured;
        END IF;
      END IF;
      RETURN NEW;
    END
    $fn$;
    CREATE TRIGGER lifecycle_contract_after_request
      AFTER INSERT ON iam.instance_plugin_lifecycle
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_request');
    CREATE TRIGGER lifecycle_contract_after_activation_intent
      AFTER INSERT ON iam.instance_plugin_lifecycle
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_activation_intent');
    CREATE TRIGGER lifecycle_contract_after_job
      AFTER INSERT ON iam.studio_jobs
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_job');
    CREATE TRIGGER lifecycle_contract_after_iam_materialization
      AFTER INSERT ON iam.permissions
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_iam_materialization');
    CREATE TRIGGER lifecycle_contract_after_claim
      AFTER UPDATE ON iam.instance_plugin_lifecycle
      FOR EACH ROW WHEN (OLD.active_job_id IS NULL AND NEW.active_job_id IS NOT NULL)
      EXECUTE FUNCTION lifecycle_contract.trip('after_claim');
    CREATE TRIGGER lifecycle_contract_after_lifecycle_terminal
      AFTER UPDATE ON iam.instance_plugin_lifecycle
      FOR EACH ROW WHEN (OLD.active_job_id IS NOT NULL AND NEW.active_job_id IS NULL)
      EXECUTE FUNCTION lifecycle_contract.trip('after_lifecycle_terminal');
    CREATE TRIGGER lifecycle_contract_after_terminal_event
      AFTER INSERT ON iam.studio_job_events
      FOR EACH ROW WHEN (NEW.event_type IN ('job.succeeded', 'job.failed', 'job.cancelled'))
      EXECUTE FUNCTION lifecycle_contract.trip('after_terminal_event');
    CREATE TRIGGER lifecycle_contract_after_terminal_job_status
      AFTER UPDATE ON iam.studio_jobs
      FOR EACH ROW WHEN (
        OLD.status NOT IN ('succeeded', 'failed', 'cancelled')
        AND NEW.status IN ('succeeded', 'failed', 'cancelled')
      ) EXECUTE FUNCTION lifecycle_contract.trip('after_terminal_job_status');
    CREATE TRIGGER lifecycle_contract_after_enqueue
      AFTER INSERT ON graphile_worker._private_jobs
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip('after_enqueue', 'studio-job:%');
    CREATE TRIGGER lifecycle_contract_after_retry_enqueue
      AFTER INSERT ON graphile_worker._private_jobs
      FOR EACH ROW EXECUTE FUNCTION lifecycle_contract.trip(
        'after_retry_enqueue', 'plugin-tenant-lifecycle-retry:%'
      );
  `);
};

export const setFailpoint = async (pool: QueryClient, name?: string): Promise<void> => {
  await pool.query('TRUNCATE lifecycle_contract.control');
  await pool.query('ALTER SEQUENCE lifecycle_contract.failpoint_hits RESTART WITH 1');
  if (name) await pool.query('INSERT INTO lifecycle_contract.control(name) VALUES ($1)', [name]);
};

export const failpointHits = (pool: QueryClient): Promise<string | undefined> =>
  scalar(
    pool,
    "SELECT CASE WHEN is_called THEN last_value::text ELSE '0' END AS value FROM lifecycle_contract.failpoint_hits"
  );

export const cleanLifecycle = async (pool: QueryClient): Promise<void> => {
  await setFailpoint(pool);
  await pool.query(
    "DELETE FROM graphile_worker._private_jobs WHERE key LIKE 'studio-job:%' OR key LIKE 'plugin-tenant-lifecycle-%'"
  );
  await pool.query('DELETE FROM iam.instance_plugin_lifecycle WHERE instance_id = $1', [
    instanceId,
  ]);
  await pool.query('DELETE FROM iam.studio_jobs WHERE instance_id = $1', [instanceId]);
};

export const cleanActivation = async (pool: QueryClient): Promise<void> => {
  await setFailpoint(pool);
  await pool.query(
    "DELETE FROM graphile_worker._private_jobs WHERE key LIKE 'plugin-tenant-lifecycle-activation:%'"
  );
  await pool.query(
    'DELETE FROM iam.instance_plugin_lifecycle WHERE instance_id = $1 AND plugin_id = $2',
    [instanceId, activationPluginId]
  );
  await pool.query('DELETE FROM iam.permissions WHERE instance_id = $1 AND permission_key = $2', [
    instanceId,
    `${activationPluginId}.read`,
  ]);
  await pool.query('DELETE FROM iam.instance_modules WHERE instance_id = $1 AND module_id = $2', [
    instanceId,
    activationPluginId,
  ]);
};

export const configureObservabilityFixture = async (pool: QueryClient): Promise<void> => {
  const oldTimestamp = new Date(Date.now() - 180_000).toISOString();
  const dueTimestamp = new Date(Date.now() - 60_000).toISOString();
  const futureTimestamp = new Date(Date.now() + 600_000).toISOString();
  const staleJobId = randomUUID();
  const queuedJobId = randomUUID();
  const freshQueuedJobId = randomUUID();

  await pool.query(
    `INSERT INTO iam.instances (
       id, display_name, primary_hostname, auth_realm, auth_client_id, tenant_admin_client_id
     ) VALUES ($1, 'Lifecycle Observability', 'lifecycle-observability.test',
       'lifecycle-observability', 'sva-studio', 'sva-studio-admin')
     ON CONFLICT (id) DO NOTHING`,
    [observabilityOtherInstanceId]
  );
  await pool.query('DELETE FROM iam.instance_plugin_lifecycle WHERE instance_id IN ($1, $2)', [
    instanceId,
    observabilityOtherInstanceId,
  ]);
  await pool.query('DELETE FROM iam.studio_jobs WHERE instance_id IN ($1, $2)', [
    instanceId,
    observabilityOtherInstanceId,
  ]);
  await pool.query(
    `INSERT INTO iam.studio_jobs (
       id, instance_id, plugin_id, job_type_id, queue_name, status, input_payload,
       attempts, max_attempts, idempotency_key, scheduled_at, started_at, updated_at,
       worker_id, heartbeat_at, source
     ) VALUES
       ($1, $4, 'obs-stale', 'obs-stale.provision', 'plugin-lifecycle', 'running', '{}'::jsonb,
        1, 5, 'obs-stale', $6, $6, $6, 'lost-worker', $6, 'plugin'),
       ($2, $5, 'obs-queued', 'obs-queued.provision', 'plugin-lifecycle', 'queued', '{}'::jsonb,
        0, 5, 'obs-queued', $6, NULL, $6, NULL, NULL, 'plugin'),
       ($3, $4, 'obs-fresh', 'obs-fresh.provision', 'plugin-lifecycle', 'queued', '{}'::jsonb,
        0, 5, 'obs-fresh', $7, NULL, $7, NULL, NULL, 'plugin')`,
    [
      staleJobId,
      queuedJobId,
      freshQueuedJobId,
      instanceId,
      observabilityOtherInstanceId,
      oldTimestamp,
      dueTimestamp,
    ]
  );
  await pool.query(
    `INSERT INTO iam.instance_plugin_lifecycle (
       instance_id, plugin_id, readiness_status, desired_generation, completed_generation,
       claimed_generation, active_job_id, retry_kind, retry_after, started_at, updated_at,
       next_recheck_at
     ) VALUES
       ($1, 'obs-stale', 'pending', 1, 0, 1, $3, NULL, NULL, $6, $6, $7),
       ($2, 'obs-queued', 'pending', 1, 0, 1, $4, NULL, NULL, NULL, $6, $8),
       ($1, 'obs-fresh', 'pending', 1, 0, 1, $5, NULL, NULL, NULL, $7, $8),
       ($1, 'obs-retry', 'degraded', 2, 1, NULL, NULL, 'retryable', $7, NULL, $7, NULL),
       ($2, 'obs-recheck', 'pending', 1, 1, NULL, NULL, NULL, NULL, NULL, $7, $7),
       ($1, 'obs-owner', 'blocked', 2, 1, NULL, NULL, 'terminal', NULL, NULL, $7, NULL),
       ($1, 'obs-wait-retry', 'degraded', 2, 1, NULL, NULL, 'retryable', $8, NULL, $7, NULL),
       ($2, 'obs-wait-recheck', 'pending', 2, 1, NULL, NULL, NULL, NULL, NULL, $7, $8)`,
    [
      instanceId,
      observabilityOtherInstanceId,
      staleJobId,
      queuedJobId,
      freshQueuedJobId,
      oldTimestamp,
      dueTimestamp,
      futureTimestamp,
    ]
  );
};
