import {
  buildPermissionCacheProbePayload,
  percentile,
  permissionCacheBenchmarkThresholdsMs,
  type PermissionCacheBenchmarkResult,
  type PermissionCacheBenchmarkScenario,
  type PermissionCacheMultiReplicaConfig,
  type PermissionCacheScenarioResult,
} from './iam-permission-cache-multi-replica.ts';
import {
  bumpRevision,
  setPermissionGrant,
  withTransaction,
  type Pool,
} from './iam-permission-cache-multi-replica-fixture.ts';

type AuthorizeResponse = {
  readonly allowed?: boolean;
  readonly cacheStatus?: string;
  readonly error?: string | { readonly code?: string };
  readonly permissionRevision?: {
    readonly instanceRevision?: number;
    readonly userRevision?: number;
  };
};

type AuthorizeResult = {
  readonly durationMs: number;
  readonly response: AuthorizeResponse;
  readonly status: number;
};

const sleep = async (durationMs: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));

const selectReplicaUrl = (
  config: PermissionCacheMultiReplicaConfig,
  index: number
): string => {
  const url = config.replicaUrls[index % config.replicaUrls.length];
  if (!url) {
    throw new Error('iam_cache_replica_url_missing');
  }
  return url;
};

const authorize = async (
  baseUrl: string,
  config: PermissionCacheMultiReplicaConfig,
  context?: { readonly geoHierarchy?: readonly string[] }
): Promise<AuthorizeResult> => {
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
        action: 'content.cacheProbe',
        resourceType: 'acceptance',
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
  result: AuthorizeResult,
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
  let lastResults: AuthorizeResult[] = [];
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

export const runIntegrationScenarios = async (
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
      authorize(selectReplicaUrl(config, index), config)
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

const collectCacheHitSamples = async (
  config: PermissionCacheMultiReplicaConfig
): Promise<number[]> => {
  await waitForDecisionOnAllReplicas(config, true, 'benchmark-cache-hit-warmup');
  const results = await Promise.all(
    Array.from({ length: config.measuredRequests }, (_, index) =>
      authorize(selectReplicaUrl(config, index), config)
    )
  );
  return results.map((result) => {
    assertDecision(result, true, 'cache-hit');
    if (result.response.cacheStatus !== 'hit') {
      throw new Error(`cache-hit:unexpected_cache_status:${result.response.cacheStatus}`);
    }
    return result.durationMs;
  });
};

const collectCacheMissSamples = async (
  config: PermissionCacheMultiReplicaConfig
): Promise<number[]> => {
  const results = await Promise.all(
    Array.from({ length: config.measuredRequests }, (_, index) =>
      authorize(selectReplicaUrl(config, index), config, {
        geoHierarchy: [`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`],
      })
    )
  );
  return results.map((result) => {
    assertDecision(result, true, 'cache-miss');
    if (result.response.cacheStatus !== 'miss') {
      throw new Error(`cache-miss:unexpected_cache_status:${result.response.cacheStatus}`);
    }
    return result.durationMs;
  });
};

const collectRecomputeSamples = async (
  pool: Pool,
  config: PermissionCacheMultiReplicaConfig
): Promise<number[]> => {
  const samplesMs: number[] = [];
  for (let index = 0; index < config.measuredRequests; index += 1) {
    await withTransaction(pool, (client) => bumpRevision(client, config, 'user', true));
    const result = await authorize(selectReplicaUrl(config, index), config);
    assertDecision(result, true, 'recompute');
    if (result.response.cacheStatus === 'hit') {
      throw new Error('recompute:unexpected_cache_status:hit');
    }
    samplesMs.push(result.durationMs);
  }
  return samplesMs;
};

const collectBenchmarkSamples = (
  pool: Pool,
  config: PermissionCacheMultiReplicaConfig,
  scenario: PermissionCacheBenchmarkScenario
): Promise<number[]> => {
  const collectors: Record<PermissionCacheBenchmarkScenario, () => Promise<number[]>> = {
    'cache-hit': () => collectCacheHitSamples(config),
    'cache-miss': () => collectCacheMissSamples(config),
    recompute: () => collectRecomputeSamples(pool, config),
  };
  return collectors[scenario]();
};

export const runBenchmarkScenario = async (
  pool: Pool,
  config: PermissionCacheMultiReplicaConfig,
  scenario: PermissionCacheBenchmarkScenario
): Promise<PermissionCacheBenchmarkResult> => {
  const samplesMs = await collectBenchmarkSamples(pool, config, scenario);

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
