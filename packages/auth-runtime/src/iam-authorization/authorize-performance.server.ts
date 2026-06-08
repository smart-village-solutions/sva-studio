import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AuthorizePerformanceRunResult,
} from '@sva/core';
import { renderAuthorizePerformanceMarkdownReport } from '@sva/core';

import { runAuthorizePerformanceScenarios, type BenchmarkInput } from './authorize-performance-benchmark.js';

const DEFAULT_MEASURED_REQUESTS = 12;
const DEFAULT_WARMUP_REQUESTS = 2;
const LATEST_BENCHMARK_TTL_MS = 15 * 60 * 1000;
const reportRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/reports');

type LatestBenchmarkCacheEntry = {
  readonly cachedAtMs: number;
  readonly result: AuthorizePerformanceRunResult;
};

const latestBenchmarkByActor = new Map<string, LatestBenchmarkCacheEntry>();

const toActorKey = (input: { instanceId: string; keycloakSubject: string }) =>
  `${input.instanceId}:${input.keycloakSubject}`;

const sweepExpiredBenchmarks = (): void => {
  const now = Date.now();
  for (const [actorKey, entry] of latestBenchmarkByActor.entries()) {
    if (entry.cachedAtMs + LATEST_BENCHMARK_TTL_MS <= now) {
      latestBenchmarkByActor.delete(actorKey);
    }
  }
};

const createFilesystemSafeIsoTimestamp = (value: Date): string =>
  value.toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');

const createReportBaseName = (generatedAt: Date): string =>
  `iam-authorize-performance-${createFilesystemSafeIsoTimestamp(generatedAt)}`;

const writeReports = async (
  report: AuthorizePerformanceRunResult
): Promise<NonNullable<AuthorizePerformanceRunResult['report']>> => {
  await mkdir(reportRoot, { recursive: true });
  const baseName = createReportBaseName(new Date(report.generatedAt));
  const jsonPath = resolve(reportRoot, `${baseName}.json`);
  const markdownPath = resolve(reportRoot, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderAuthorizePerformanceMarkdownReport(report), 'utf8');

  return {
    jsonPath: jsonPath.replace(`${process.cwd()}/`, ''),
    markdownPath: markdownPath.replace(`${process.cwd()}/`, ''),
  };
};

export const readLatestAuthorizePerformanceBenchmark = (input: {
  readonly instanceId: string;
  readonly keycloakSubject: string;
}): AuthorizePerformanceRunResult | null =>
  {
    sweepExpiredBenchmarks();
    return latestBenchmarkByActor.get(toActorKey(input))?.result ?? null;
  };

export const runAuthorizePerformanceBenchmark = async (
  input: BenchmarkInput
): Promise<AuthorizePerformanceRunResult> => {
  const generatedAt = new Date();
  const measuredRequests = input.request.measuredRequests ?? DEFAULT_MEASURED_REQUESTS;
  const warmupRequests = input.request.warmupRequests ?? DEFAULT_WARMUP_REQUESTS;
  const runId = generatedAt.getTime().toString(36);
  const scenarios = await runAuthorizePerformanceScenarios({
    ...input,
    measuredRequests,
    runId,
    warmupRequests,
  });

  const result: AuthorizePerformanceRunResult = {
    generatedAt: generatedAt.toISOString(),
    measuredOn: 'server',
    actor: {
      instanceId: input.actor.instanceId,
      keycloakSubject: input.actor.id,
    },
    request: {
      action: input.request.action,
      resourceType: input.request.resourceType,
      ...(input.request.resourceId ? { resourceId: input.request.resourceId } : {}),
      ...(input.request.organizationId ? { organizationId: input.request.organizationId } : {}),
    },
    configuration: {
      measuredRequests,
      warmupRequests,
    },
    scenarios,
  };

  const report = await writeReports(result);
  const finalizedResult = {
    ...result,
    report,
  } satisfies AuthorizePerformanceRunResult;
  sweepExpiredBenchmarks();
  latestBenchmarkByActor.set(toActorKey({ instanceId: input.actor.instanceId, keycloakSubject: input.actor.id }), {
    cachedAtMs: Date.now(),
    result: finalizedResult,
  });

  return finalizedResult;
};
