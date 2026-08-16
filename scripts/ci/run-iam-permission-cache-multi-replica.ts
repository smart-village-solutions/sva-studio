import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildPermissionCacheProbePayload,
  parsePermissionCacheMultiReplicaConfig,
  percentile,
  permissionCacheBenchmarkThresholdsMs,
  renderPermissionCacheMultiReplicaReport,
  type PermissionCacheBenchmarkResult,
  type PermissionCacheBenchmarkScenario,
  type PermissionCacheMultiReplicaConfig,
  type PermissionCacheMultiReplicaReport,
  type PermissionCacheScenarioResult,
} from './iam-permission-cache-multi-replica.ts';

type QueryResult<TRow = Record<string, unknown>> = {
  readonly rowCount: number | null;
  readonly rows: TRow[];
};

type PoolClient = {
  query: <TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<QueryResult<TRow>>;
  release: () => void;
};

type Pool = {
  connect: () => Promise<PoolClient>;
  end: () => Promise<void>;
  query: PoolClient['query'];
};

type PgModule = {
  Pool: new (options: { connectionString: string; max?: number }) => Pool;
};

type RedisClient = {
  del: (...keys: string[]) => Promise<number>;
  disconnect: () => void;
  scan: (
    cursor: string,
    ...args: readonly (string | number)[]
  ) => Promise<[cursor: string, keys: string[]]>;
};

type RedisModule = {
  default: new (
    url: string,
    options?: { lazyConnect?: boolean; maxRetriesPerRequest?: number }
  ) => RedisClient;
};

type AuthorizeResponse = {
  readonly allowed?: boolean;
  readonly cacheStatus?: string;
  readonly error?: string | { readonly code?: string };
  readonly permissionRevision?: {
    readonly instanceRevision?: number;
    readonly userRevision?: number;
  };
};

const rootDir = resolve(import.meta.dirname, '../..');
const authRuntimeRequire = createRequire(resolve(rootDir, 'packages/auth-runtime/package.json'));
const { Pool } = authRuntimeRequire('pg') as PgModule;
const Redis = (authRuntimeRequire('ioredis') as RedisModule).default;

const TEST_ACCOUNT_ID = '93100000-0000-4000-8000-000000000001';
const TEST_ROLE_ID = '93100000-0000-4000-8000-000000000002';
const TEST_PERMISSION_ID = '93100000-0000-4000-8000-000000000003';
const TEST_ACTION = 'content.cacheProbe';
const TEST_RESOURCE_TYPE = 'acceptance';

const sleep = async (durationMs: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));

const withTransaction = async <T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
  options?: { readonly rollback?: boolean }
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query(options?.rollback ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const removeRedisSnapshots = async (
  redis: RedisClient,
  input: { readonly instanceId: string; readonly keycloakSubject: string }
): Promise<void> => {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `perm:v2:${input.instanceId}:${input.keycloakSubject}:*`,
      'COUNT',
      100
    );
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    cursor = nextCursor;
  } while (cursor !== '0');
};

const cleanupTestData = async (
  pool: Pool,
  redis: RedisClient,
  config: PermissionCacheMultiReplicaConfig
): Promise<void> => {
  await pool.query('DELETE FROM iam.accounts WHERE id = $1', [TEST_ACCOUNT_ID]);
  await pool.query('DELETE FROM iam.permissions WHERE id = $1', [TEST_PERMISSION_ID]);
  await pool.query('DELETE FROM iam.roles WHERE id = $1', [TEST_ROLE_ID]);
  await pool.query(
    'DELETE FROM iam.permission_cache_user_revisions WHERE instance_id = $1 AND keycloak_subject = $2',
    [config.instanceId, config.keycloakSubject]
  );
  await removeRedisSnapshots(redis, config);
};

const seedTestData = async (
  pool: Pool,
  redis: RedisClient,
  config: PermissionCacheMultiReplicaConfig
): Promise<void> => {
  await cleanupTestData(pool, redis, config);
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO iam.accounts (id, keycloak_subject, status, instance_id)
       VALUES ($1, $2, 'active', $3)`,
      [TEST_ACCOUNT_ID, config.keycloakSubject, config.instanceId]
    );
    await client.query(
      `INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
       VALUES ($1, $2, 'member')`,
      [config.instanceId, TEST_ACCOUNT_ID]
    );
    await client.query(
      `INSERT INTO iam.roles (
         id, role_name, role_key, display_name, external_role_name, is_system_role,
         role_level, managed_by, sync_state, instance_id
       ) VALUES ($1, 'Permission cache acceptance', 'permission_cache_acceptance',
         'Permission cache acceptance', 'permission_cache_acceptance', false, 10,
         'studio', 'synced', $2)`,
      [TEST_ROLE_ID, config.instanceId]
    );
    await client.query(
      `INSERT INTO iam.permissions (
         id, permission_key, action, resource_type, scope, instance_id
       ) VALUES ($1, $2, $2, $3, '{}'::jsonb, $4)`,
      [TEST_PERMISSION_ID, TEST_ACTION, TEST_RESOURCE_TYPE, config.instanceId]
    );
    await client.query(
      `INSERT INTO iam.account_roles (instance_id, account_id, role_id)
       VALUES ($1, $2, $3)`,
      [config.instanceId, TEST_ACCOUNT_ID, TEST_ROLE_ID]
    );
  });
};

const bumpRevision = async (
  client: PoolClient,
  config: PermissionCacheMultiReplicaConfig,
  scope: 'instance' | 'user',
  notify: boolean
): Promise<number> => {
  const result =
    scope === 'instance'
      ? await client.query<{ revision: string }>(
          `INSERT INTO iam.permission_cache_instance_revisions (instance_id, revision, updated_at)
           VALUES ($1, 2, NOW())
           ON CONFLICT (instance_id) DO UPDATE
             SET revision = iam.permission_cache_instance_revisions.revision + 1,
                 updated_at = NOW()
           RETURNING revision::text AS revision`,
          [config.instanceId]
        )
      : await client.query<{ revision: string }>(
          `INSERT INTO iam.permission_cache_user_revisions (
             instance_id, keycloak_subject, revision, updated_at
           ) VALUES ($1, $2, 2, NOW())
           ON CONFLICT (instance_id, keycloak_subject) DO UPDATE
             SET revision = iam.permission_cache_user_revisions.revision + 1,
                 updated_at = NOW()
           RETURNING revision::text AS revision`,
          [config.instanceId, config.keycloakSubject]
        );
  const revision = Number(result.rows[0]?.revision);
  if (!Number.isSafeInteger(revision)) {
    throw new Error(`invalid_${scope}_revision`);
  }

  if (notify) {
    await client.query('SELECT pg_notify($1, $2)', [
      'iam_permission_snapshot_invalidation',
      JSON.stringify({
        eventId: `local-acceptance-${scope}-${revision}`,
        event: 'PermissionRevisionChanged',
        instanceId: config.instanceId,
        ...(scope === 'user' ? { keycloakSubject: config.keycloakSubject } : {}),
        revisionScope: scope,
        newRevision: revision,
        trigger: 'pg_notify',
      }),
    ]);
  }
  return revision;
};

const setPermissionGrant = async (
  pool: Pool,
  config: PermissionCacheMultiReplicaConfig,
  input: {
    readonly granted: boolean;
    readonly notify: boolean;
    readonly revisionScope: 'instance' | 'user';
    readonly rollback?: boolean;
  }
): Promise<number> =>
  withTransaction(
    pool,
    async (client) => {
      if (input.granted) {
        await client.query(
          `INSERT INTO iam.role_permissions (
             instance_id, role_id, permission_id, grant_origin_kind, access_scope
           ) VALUES ($1, $2, $3, 'manual', 'all')
           ON CONFLICT DO NOTHING`,
          [config.instanceId, TEST_ROLE_ID, TEST_PERMISSION_ID]
        );
      } else {
        await client.query(
          `DELETE FROM iam.role_permissions
           WHERE instance_id = $1 AND role_id = $2 AND permission_id = $3`,
          [config.instanceId, TEST_ROLE_ID, TEST_PERMISSION_ID]
        );
      }
      return bumpRevision(client, config, input.revisionScope, input.notify);
    },
    { rollback: input.rollback }
  );

const authorize = async (
  baseUrl: string,
  config: PermissionCacheMultiReplicaConfig,
  context?: { readonly geoHierarchy?: readonly string[] }
): Promise<{
  readonly durationMs: number;
  readonly response: AuthorizeResponse;
  readonly status: number;
}> => {
  const startedAt = performance.now();
  const httpResponse = await fetch(`${baseUrl}/iam/authorize`, {
    method: 'POST',
    headers: {
      Cookie: 'sva_dev_auth=1',
      'Content-Type': 'application/json',
      Origin: baseUrl,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(
      buildPermissionCacheProbePayload({
        instanceId: config.instanceId,
        action: TEST_ACTION,
        resourceType: TEST_RESOURCE_TYPE,
        geoHierarchy: context?.geoHierarchy,
      })
    ),
    signal: AbortSignal.timeout(30_000),
  });
  const durationMs = performance.now() - startedAt;
  const response = (await httpResponse.json()) as AuthorizeResponse;
  return { durationMs, response, status: httpResponse.status };
};

const assertDecision = (
  result: Awaited<ReturnType<typeof authorize>>,
  expectedAllowed: boolean,
  label: string
): void => {
  if (result.status !== 200 || result.response.allowed !== expectedAllowed) {
    throw new Error(
      `${label}:expected_allowed_${String(expectedAllowed)}:http_${result.status}:${JSON.stringify(result.response.error)}`
    );
  }
};

const waitForDecisionOnAllReplicas = async (
  config: PermissionCacheMultiReplicaConfig,
  expectedAllowed: boolean,
  label: string
): Promise<AuthorizeResponse[]> => {
  let lastResults: Awaited<ReturnType<typeof authorize>>[] = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const results = await Promise.all(config.replicaUrls.map((url) => authorize(url, config)));
    lastResults = results;
    if (
      results.every(
        (result) => result.status === 200 && result.response.allowed === expectedAllowed
      )
    ) {
      return results.map((result) => result.response);
    }
    await sleep(50);
  }
  const summary = lastResults.map(({ response, status }) => ({
    allowed: response.allowed,
    cacheStatus: response.cacheStatus,
    error: response.error,
    status,
  }));
  throw new Error(`${label}:replicas_did_not_converge:${JSON.stringify(summary)}`);
};

const runIntegrationScenarios = async (
  pool: Pool,
  config: PermissionCacheMultiReplicaConfig
): Promise<PermissionCacheScenarioResult[]> => {
  const scenarios: PermissionCacheScenarioResult[] = [];
  const pass = (name: string, details: string) =>
    scenarios.push({ name, status: 'passed', details });

  await waitForDecisionOnAllReplicas(config, false, 'warm-cache');

  const grantRevision = await setPermissionGrant(pool, config, {
    granted: true,
    notify: true,
    revisionScope: 'user',
  });
  await waitForDecisionOnAllReplicas(config, true, 'user-grant');
  pass('Benutzer-Grant', `Beide Replikate verwenden userRevision ${grantRevision}.`);

  const revokeRevision = await setPermissionGrant(pool, config, {
    granted: false,
    notify: true,
    revisionScope: 'user',
  });
  await waitForDecisionOnAllReplicas(config, false, 'user-revocation');
  pass('Benutzer-Revocation', `Beide Replikate verwenden userRevision ${revokeRevision}.`);

  await setPermissionGrant(pool, config, {
    granted: true,
    notify: true,
    revisionScope: 'user',
    rollback: true,
  });
  await waitForDecisionOnAllReplicas(config, false, 'transaction-rollback');
  pass('Transaktionsrollback', 'Grant, Revisions-Bump und NOTIFY wurden gemeinsam verworfen.');

  const lostEventRevision = await setPermissionGrant(pool, config, {
    granted: true,
    notify: false,
    revisionScope: 'user',
  });
  await waitForDecisionOnAllReplicas(config, true, 'lost-event');
  pass(
    'Verlorenes Event',
    `Die autoritative Revision ${lostEventRevision} invalidiert beide Replikate ohne NOTIFY.`
  );

  await pool.query('SELECT pg_notify($1, $2)', [
    'iam_permission_snapshot_invalidation',
    JSON.stringify({
      eventId: 'local-acceptance-delayed-event',
      event: 'PermissionRevisionChanged',
      instanceId: config.instanceId,
      keycloakSubject: config.keycloakSubject,
      revisionScope: 'user',
      newRevision: Math.max(1, lostEventRevision - 1),
      trigger: 'pg_notify',
    }),
  ]);
  await waitForDecisionOnAllReplicas(config, true, 'delayed-event');
  pass(
    'Verspätetes Event',
    'Ein älteres Event konnte die aktuelle Grant-Entscheidung nicht ersetzen.'
  );

  const instanceRevision = await setPermissionGrant(pool, config, {
    granted: false,
    notify: true,
    revisionScope: 'instance',
  });
  await waitForDecisionOnAllReplicas(config, false, 'instance-invalidation');
  pass('Instanzinvalidierung', `Beide Replikate verwenden instanceRevision ${instanceRevision}.`);

  const concurrentReads = Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      authorize(config.replicaUrls[index % config.replicaUrls.length]!, config)
    )
  );
  const concurrentMutation = setPermissionGrant(pool, config, {
    granted: true,
    notify: true,
    revisionScope: 'user',
  });
  await Promise.all([concurrentReads, concurrentMutation]);
  await waitForDecisionOnAllReplicas(config, true, 'parallel-mutation-recompute');
  pass(
    'Parallele Mutation/Recompute',
    'Nach dem Rennen konvergieren beide Replikate auf den Grant.'
  );

  for (const [name, url] of [
    ['Redis-Ausfall', config.redisFailureUrl],
    ['DB-Ausfall', config.databaseFailureUrl],
  ] as const) {
    const result = await authorize(url, config);
    if (result.status !== 503) {
      throw new Error(`${name}:expected_http_503:received_${result.status}`);
    }
    pass(name, 'Der Authorize-Pfad antwortet fail-closed mit HTTP 503.');
  }

  return scenarios;
};

const runBenchmarkScenario = async (
  pool: Pool,
  config: PermissionCacheMultiReplicaConfig,
  scenario: PermissionCacheBenchmarkScenario
): Promise<PermissionCacheBenchmarkResult> => {
  const samplesMs: number[] = [];

  if (scenario === 'cache-hit') {
    await waitForDecisionOnAllReplicas(config, true, 'benchmark-cache-hit-warmup');
    const results = await Promise.all(
      Array.from({ length: config.measuredRequests }, (_, index) =>
        authorize(config.replicaUrls[index % config.replicaUrls.length]!, config)
      )
    );
    for (const result of results) {
      assertDecision(result, true, scenario);
      if (result.response.cacheStatus !== 'hit') {
        throw new Error(`${scenario}:unexpected_cache_status:${result.response.cacheStatus}`);
      }
      samplesMs.push(result.durationMs);
    }
  } else if (scenario === 'cache-miss') {
    const results = await Promise.all(
      Array.from({ length: config.measuredRequests }, (_, index) =>
        authorize(config.replicaUrls[index % config.replicaUrls.length]!, config, {
          geoHierarchy: [`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`],
        })
      )
    );
    for (const result of results) {
      assertDecision(result, true, scenario);
      if (result.response.cacheStatus !== 'miss') {
        throw new Error(`${scenario}:unexpected_cache_status:${result.response.cacheStatus}`);
      }
      samplesMs.push(result.durationMs);
    }
  } else {
    for (let index = 0; index < config.measuredRequests; index += 1) {
      await withTransaction(pool, (client) => bumpRevision(client, config, 'user', true));
      const result = await authorize(
        config.replicaUrls[index % config.replicaUrls.length]!,
        config
      );
      assertDecision(result, true, scenario);
      if (result.response.cacheStatus === 'hit') {
        throw new Error(`${scenario}:unexpected_cache_status:hit`);
      }
      samplesMs.push(result.durationMs);
    }
  }

  const p50Ms = percentile(samplesMs, 0.5);
  const p95Ms = percentile(samplesMs, 0.95);
  const p99Ms = percentile(samplesMs, 0.99);
  const thresholdMs = permissionCacheBenchmarkThresholdsMs[scenario];
  return {
    scenario,
    samplesMs,
    p50Ms,
    p95Ms,
    p99Ms,
    thresholdMs,
    accepted: p95Ms < thresholdMs,
  };
};

const writeReport = async (
  config: PermissionCacheMultiReplicaConfig,
  report: PermissionCacheMultiReplicaReport
): Promise<{ readonly jsonPath: string; readonly markdownPath: string }> => {
  const timestamp = report.generatedAt.replaceAll(':', '-').replace(/\.\d{3}Z$/u, 'Z');
  const baseName = `iam-permission-cache-multi-replica-${timestamp}`;
  const reportDirectory = resolve(rootDir, config.reportDirectory);
  const jsonPath = resolve(reportDirectory, `${baseName}.json`);
  const markdownPath = resolve(reportDirectory, `${baseName}.md`);
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderPermissionCacheMultiReplicaReport(report), 'utf8');
  return { jsonPath, markdownPath };
};

export const runPermissionCacheMultiReplicaAcceptance = async (
  env: NodeJS.ProcessEnv = process.env
): Promise<PermissionCacheMultiReplicaReport> => {
  const config = parsePermissionCacheMultiReplicaConfig(env);
  const pool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  const redis = new Redis(config.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 });

  try {
    await Promise.all(
      config.replicaUrls.map(async (url) => {
        const response = await fetch(`${url}/health/ready`, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new Error(`replica_not_ready:${url}:http_${response.status}`);
        }
      })
    );
    await seedTestData(pool, redis, config);
    const scenarios = await runIntegrationScenarios(pool, config);
    const benchmarks: PermissionCacheBenchmarkResult[] = [];
    for (const scenario of ['cache-hit', 'cache-miss', 'recompute'] as const) {
      benchmarks.push(await runBenchmarkScenario(pool, config, scenario));
    }
    const report: PermissionCacheMultiReplicaReport = {
      generatedAt: new Date().toISOString(),
      replicaCount: config.replicaUrls.length,
      measuredRequests: config.measuredRequests,
      scenarios,
      benchmarks,
    };
    const paths = await writeReport(config, report);
    console.log(`[iam-cache-multi-replica] report written: ${paths.markdownPath}`);

    if (benchmarks.some((benchmark) => !benchmark.accepted)) {
      process.exitCode = 1;
    }
    return report;
  } finally {
    await cleanupTestData(pool, redis, config).catch(() => undefined);
    redis.disconnect();
    await pool.end().catch(() => undefined);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPermissionCacheMultiReplicaAcceptance().catch((error: unknown) => {
    console.error(
      `[iam-cache-multi-replica] failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
