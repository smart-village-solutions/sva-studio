import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  parsePermissionCacheMultiReplicaConfig,
  renderPermissionCacheMultiReplicaReport,
  type PermissionCacheBenchmarkResult,
  type PermissionCacheMultiReplicaConfig,
  type PermissionCacheMultiReplicaReport,
} from './iam-permission-cache-multi-replica.ts';
import {
  cleanupTestData,
  seedTestData,
  type Pool,
  type RedisClient,
} from './iam-permission-cache-multi-replica-fixture.ts';
import {
  runBenchmarkScenario,
  runIntegrationScenarios,
} from './iam-permission-cache-multi-replica-scenarios.ts';

type PgModule = {
  Pool: new (options: { connectionString: string; max?: number }) => Pool;
};

type RedisModule = {
  default: new (
    url: string,
    options?: { lazyConnect?: boolean; maxRetriesPerRequest?: number }
  ) => RedisClient;
};

const rootDir = resolve(import.meta.dirname, '../..');
const authRuntimeRequire = createRequire(resolve(rootDir, 'packages/auth-runtime/package.json'));
const { Pool } = authRuntimeRequire('pg') as PgModule;
const Redis = (authRuntimeRequire('ioredis') as RedisModule).default;

const assertReplicasReady = async (config: PermissionCacheMultiReplicaConfig): Promise<void> => {
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
    await assertReplicasReady(config);
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
