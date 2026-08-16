export const permissionCacheBenchmarkThresholdsMs = {
  'cache-hit': 250,
  'cache-miss': 600,
  recompute: 300,
} as const;

export type PermissionCacheBenchmarkScenario = keyof typeof permissionCacheBenchmarkThresholdsMs;

export type PermissionCacheScenarioResult = Readonly<{
  name: string;
  status: 'passed' | 'failed';
  details: string;
}>;

export type PermissionCacheBenchmarkResult = Readonly<{
  scenario: PermissionCacheBenchmarkScenario;
  samplesMs: readonly number[];
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  thresholdMs: number;
  accepted: boolean;
}>;

export type PermissionCacheMultiReplicaReport = Readonly<{
  generatedAt: string;
  replicaCount: number;
  measuredRequests: number;
  scenarios: readonly PermissionCacheScenarioResult[];
  benchmarks: readonly PermissionCacheBenchmarkResult[];
}>;

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`invalid_positive_integer:${value}`);
  }
  return parsed;
};

export type PermissionCacheMultiReplicaConfig = Readonly<{
  replicaUrls: readonly string[];
  redisFailureUrl: string;
  databaseFailureUrl: string;
  databaseUrl: string;
  redisUrl: string;
  instanceId: string;
  keycloakSubject: string;
  measuredRequests: number;
  reportDirectory: string;
}>;

export const buildPermissionCacheProbePayload = (input: {
  readonly instanceId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly geoHierarchy?: readonly string[];
}) => ({
  instanceId: input.instanceId,
  action: input.action,
  resource: { type: input.resourceType },
  ...(input.geoHierarchy ? { context: { attributes: { geoHierarchy: input.geoHierarchy } } } : {}),
});

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/$/u, '');

export const parsePermissionCacheMultiReplicaConfig = (
  env: NodeJS.ProcessEnv
): PermissionCacheMultiReplicaConfig => {
  const replicaUrls = (env.IAM_CACHE_REPLICA_URLS ?? '')
    .split(',')
    .map(normalizeBaseUrl)
    .filter(Boolean);
  if (replicaUrls.length < 2) {
    throw new Error('iam_cache_replica_urls_requires_two_replicas');
  }

  const databaseUrl = env.IAM_CACHE_TEST_DATABASE_URL?.trim();
  const redisUrl = env.IAM_CACHE_TEST_REDIS_URL?.trim();
  const redisFailureUrl = env.IAM_CACHE_REDIS_FAILURE_URL?.trim();
  const databaseFailureUrl = env.IAM_CACHE_DATABASE_FAILURE_URL?.trim();
  if (!databaseUrl || !redisUrl || !redisFailureUrl || !databaseFailureUrl) {
    throw new Error('iam_cache_multi_replica_config_missing');
  }

  return {
    replicaUrls,
    redisFailureUrl: normalizeBaseUrl(redisFailureUrl),
    databaseFailureUrl: normalizeBaseUrl(databaseFailureUrl),
    databaseUrl,
    redisUrl,
    instanceId: env.IAM_CACHE_TEST_INSTANCE_ID?.trim() || 'de-musterhausen',
    keycloakSubject: env.IAM_CACHE_TEST_KEYCLOAK_SUBJECT?.trim() || 'dev:scoped-access-acceptance',
    measuredRequests: parsePositiveInteger(env.IAM_CACHE_TEST_MEASURED_REQUESTS, 100),
    reportDirectory: env.IAM_CACHE_TEST_REPORT_DIR?.trim() || 'docs/reports',
  };
};

export const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) {
    throw new Error('permission_cache_benchmark_has_no_samples');
  }
  const sorted = [...values].sort((left, right) => left - right);
  return (
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] ?? 0
  );
};

const formatMs = (value: number): string => `${value.toFixed(2)} ms`;

export const renderPermissionCacheMultiReplicaReport = (
  report: PermissionCacheMultiReplicaReport
): string => {
  const lines = [
    '# Multi-Replikat-Nachweis für den IAM-Permission-Cache',
    '',
    '## Kontext',
    '',
    `- Zeitpunkt: ${report.generatedAt}`,
    `- App-Replikate: ${report.replicaCount}`,
    `- Mess-Requests je Benchmark: ${report.measuredRequests}`,
    `- Parallelität für Cache-Hit und Cache-Miss: ${report.measuredRequests}`,
    '- Testprofil: Produktionsbuild, lokales Docker-Netz, keine Browser-Drosselung',
    '- Infrastruktur: lokales PostgreSQL und Redis über Docker',
    '- Endpunkt: `POST /iam/authorize` auf zwei unabhängigen App-Prozessen',
    '- Abweichung: Kein synthetisches Slow-4G-Profil; der lokale Docker-Aufbau ist als belastbarer Nachweis freigegeben.',
    '',
    '## Integrationsszenarien',
    '',
    '| Szenario | Ergebnis | Details |',
    '| --- | --- | --- |',
    ...report.scenarios.map(
      (scenario) =>
        `| ${scenario.name} | ${scenario.status === 'passed' ? 'erfüllt' : 'nicht erfüllt'} | ${scenario.details} |`
    ),
    '',
    '## Performance',
    '',
    '| Szenario | Samples | p50 | p95 | p99 | Grenze | Ergebnis |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...report.benchmarks.map(
      (benchmark) =>
        `| ${benchmark.scenario} | ${benchmark.samplesMs.length} | ${formatMs(benchmark.p50Ms)} | ${formatMs(benchmark.p95Ms)} | ${formatMs(benchmark.p99Ms)} | < ${formatMs(benchmark.thresholdMs)} | ${benchmark.accepted ? 'erfüllt' : 'nicht erfüllt'} |`
    ),
    '',
    '## Abnahme',
    '',
    report.scenarios.every((scenario) => scenario.status === 'passed') &&
    report.benchmarks.every((benchmark) => benchmark.accepted)
      ? 'Alle Multi-Replikat- und Performance-Kriterien sind erfüllt.'
      : 'Mindestens ein Multi-Replikat- oder Performance-Kriterium ist nicht erfüllt.',
    '',
  ];

  return lines.join('\n');
};
