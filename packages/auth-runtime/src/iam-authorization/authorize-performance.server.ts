import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AuthorizePerformanceRequest,
  AuthorizePerformanceRunResult,
  AuthorizePerformanceScenario,
  AuthorizePerformanceScenarioResult,
  AuthorizeResponse,
} from '@sva/core';
import {
  buildAuthorizePerformancePayload,
  renderAuthorizePerformanceMarkdownReport,
  summarizeAuthorizePerformanceDurations,
} from '@sva/core';

import { authorizeHandler } from './authorize.js';
import { invalidateRedisPermissionSnapshots } from './redis-permission-snapshot.server.js';
import { permissionSnapshotCache } from './shared.js';

type BenchmarkActor = {
  readonly id: string;
  readonly instanceId: string;
};

type BenchmarkInput = {
  readonly actor: BenchmarkActor;
  readonly request: AuthorizePerformanceRequest;
  readonly requestHeaders: Headers;
  readonly requestUrl: string;
};

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

const scenarioThresholdMs = (scenario: AuthorizePerformanceScenario): number => {
  switch (scenario) {
    case 'cache-hit':
      return 100;
    case 'cache-miss':
      return 300;
    case 'recompute':
      return 300;
  }
};

const assertScenarioStatuses = (input: {
  readonly observedStatuses: readonly string[];
  readonly scenario: AuthorizePerformanceScenario;
}): void => {
  if (input.observedStatuses.length === 0) {
    throw new Error(`scenario:${input.scenario}:empty`);
  }

  if (input.scenario === 'cache-hit' && input.observedStatuses.some((status) => status !== 'hit')) {
    throw new Error(`scenario:${input.scenario}:unexpected_cache_status`);
  }

  if (input.scenario === 'cache-miss' && input.observedStatuses.some((status) => status !== 'miss')) {
    throw new Error(`scenario:${input.scenario}:unexpected_cache_status`);
  }

  if (input.scenario === 'recompute' && input.observedStatuses.some((status) => status === 'hit')) {
    throw new Error(`scenario:${input.scenario}:unexpected_cache_status`);
  }
};

const cloneHeadersForAuthorize = (headers: Headers, body: string): Headers => {
  const nextHeaders = new Headers();
  const headerNames = ['cookie', 'authorization', 'x-requested-with', 'origin', 'referer', 'traceparent'];

  for (const headerName of headerNames) {
    const value = headers.get(headerName);
    if (value) {
      nextHeaders.set(headerName, value);
    }
  }

  nextHeaders.set('content-type', 'application/json');
  nextHeaders.set('content-length', String(body.length));
  nextHeaders.set('x-requested-with', nextHeaders.get('x-requested-with') ?? 'XMLHttpRequest');
  return nextHeaders;
};

const invokeAuthorize = async (input: {
  readonly headers: Headers;
  readonly payload: ReturnType<typeof buildAuthorizePerformancePayload>;
  readonly requestUrl: string;
}): Promise<{
  readonly cacheStatus: string;
  readonly durationMs: number;
}> => {
  const startedAt = performance.now();
  const body = JSON.stringify(input.payload);
  const response = await authorizeHandler(
    new Request(new URL('/iam/authorize', input.requestUrl).toString(), {
      method: 'POST',
      headers: cloneHeadersForAuthorize(input.headers, body),
      body,
    })
  );
  const durationMs = performance.now() - startedAt;

  if (!response.ok) {
    throw new Error(`authorize_http_${response.status}`);
  }

  const json = (await response.json()) as Partial<AuthorizeResponse>;
  if (typeof json.cacheStatus !== 'string') {
    throw new Error('authorize_missing_cache_status');
  }

  return {
    cacheStatus: json.cacheStatus,
    durationMs,
  };
};

const invalidateUserScope = async (actor: BenchmarkActor): Promise<void> => {
  permissionSnapshotCache.invalidate({
    instanceId: actor.instanceId,
    keycloakSubject: actor.id,
  });
  await invalidateRedisPermissionSnapshots(actor.instanceId, actor.id);
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

const buildAuthorizePerformanceBasePayload = (input: BenchmarkInput) => ({
  instanceId: input.actor.instanceId,
  action: input.request.action,
  resource: {
    type: input.request.resourceType,
    ...(input.request.resourceId ? { id: input.request.resourceId } : {}),
    ...(input.request.organizationId ? { organizationId: input.request.organizationId } : {}),
  },
  context: {
    ...(input.request.organizationId ? { organizationId: input.request.organizationId } : {}),
  },
});

const buildScenarioStableWarmupPayload = (input: {
  readonly basePayload: ReturnType<typeof buildAuthorizePerformanceBasePayload>;
  readonly runId: string;
  readonly scenario: AuthorizePerformanceScenario;
}) =>
  input.scenario === 'cache-miss'
    ? null
    : buildAuthorizePerformancePayload({
        basePayload: input.basePayload,
        runId: input.runId,
        sampleIndex: 0,
        scenario: input.scenario,
      });

const buildScenarioWarmupPayload = (input: {
  readonly basePayload: ReturnType<typeof buildAuthorizePerformanceBasePayload>;
  readonly runId: string;
  readonly sampleIndex: number;
  readonly scenario: AuthorizePerformanceScenario;
  readonly stableWarmupPayload: ReturnType<typeof buildAuthorizePerformancePayload> | null;
}) => {
  if (input.scenario !== 'cache-miss') {
    return input.stableWarmupPayload;
  }

  return buildAuthorizePerformancePayload({
    basePayload: input.basePayload,
    runId: `${input.runId}-warmup`,
    sampleIndex: input.sampleIndex,
    scenario: input.scenario,
  });
};

const maybeInvalidateScopeForScenario = async (scenario: AuthorizePerformanceScenario, actor: BenchmarkActor): Promise<void> => {
  if (scenario === 'recompute') {
    await invalidateUserScope(actor);
  }
};

const runScenarioWarmup = async (input: {
  readonly actor: BenchmarkActor;
  readonly basePayload: ReturnType<typeof buildAuthorizePerformanceBasePayload>;
  readonly headers: Headers;
  readonly requestUrl: string;
  readonly runId: string;
  readonly scenario: AuthorizePerformanceScenario;
  readonly warmupRequests: number;
}): Promise<void> => {
  const stableWarmupPayload = buildScenarioStableWarmupPayload({
    basePayload: input.basePayload,
    runId: input.runId,
    scenario: input.scenario,
  });

  for (let index = 0; index < input.warmupRequests; index += 1) {
    await maybeInvalidateScopeForScenario(input.scenario, input.actor);
    const warmupPayload = buildScenarioWarmupPayload({
      basePayload: input.basePayload,
      runId: input.runId,
      sampleIndex: index,
      scenario: input.scenario,
      stableWarmupPayload,
    });

    if (!warmupPayload) {
      throw new Error('warmup_payload_missing');
    }

    await invokeAuthorize({
      headers: input.headers,
      payload: warmupPayload,
      requestUrl: input.requestUrl,
    });
  }
};

const runScenarioMeasurements = async (input: {
  readonly actor: BenchmarkActor;
  readonly basePayload: ReturnType<typeof buildAuthorizePerformanceBasePayload>;
  readonly headers: Headers;
  readonly measuredRequests: number;
  readonly requestUrl: string;
  readonly runId: string;
  readonly scenario: AuthorizePerformanceScenario;
}): Promise<{
  readonly observedStatuses: string[];
  readonly samplesMs: number[];
}> => {
  const observedStatuses: string[] = [];
  const samplesMs: number[] = [];

  for (let sampleIndex = 0; sampleIndex < input.measuredRequests; sampleIndex += 1) {
    await maybeInvalidateScopeForScenario(input.scenario, input.actor);
    const payload = buildAuthorizePerformancePayload({
      basePayload: input.basePayload,
      runId: input.runId,
      sampleIndex,
      scenario: input.scenario,
    });
    const result = await invokeAuthorize({
      headers: input.headers,
      payload,
      requestUrl: input.requestUrl,
    });

    samplesMs.push(result.durationMs);
    observedStatuses.push(result.cacheStatus);
  }

  return { observedStatuses, samplesMs };
};

const runScenarioBenchmark = async (input: {
  readonly actor: BenchmarkActor;
  readonly basePayload: ReturnType<typeof buildAuthorizePerformanceBasePayload>;
  readonly headers: Headers;
  readonly measuredRequests: number;
  readonly requestUrl: string;
  readonly runId: string;
  readonly scenario: AuthorizePerformanceScenario;
  readonly warmupRequests: number;
}): Promise<AuthorizePerformanceScenarioResult> => {
  await runScenarioWarmup(input);
  const { observedStatuses, samplesMs } = await runScenarioMeasurements(input);

  assertScenarioStatuses({
    observedStatuses,
    scenario: input.scenario,
  });

  const summary = summarizeAuthorizePerformanceDurations(samplesMs);
  const evaluation = summary.p95Ms < scenarioThresholdMs(input.scenario) ? 'accepted' : 'rejected';

  return {
    scenario: input.scenario,
    samplesMs,
    summary,
    evaluation,
    evaluationLabel: evaluation === 'accepted' ? 'erfüllt' : 'nicht erfüllt',
    observedCacheStatuses: observedStatuses,
  };
};

export const runAuthorizePerformanceBenchmark = async (
  input: BenchmarkInput
): Promise<AuthorizePerformanceRunResult> => {
  const generatedAt = new Date();
  const measuredRequests = input.request.measuredRequests ?? DEFAULT_MEASURED_REQUESTS;
  const warmupRequests = input.request.warmupRequests ?? DEFAULT_WARMUP_REQUESTS;
  const runId = generatedAt.getTime().toString(36);
  const basePayload = buildAuthorizePerformanceBasePayload(input);

  const scenarios: AuthorizePerformanceScenarioResult[] = [];
  for (const scenario of ['cache-hit', 'cache-miss', 'recompute'] as const) {
    scenarios.push(
      await runScenarioBenchmark({
        actor: input.actor,
        basePayload,
        headers: input.requestHeaders,
        measuredRequests,
        requestUrl: input.requestUrl,
        runId,
        scenario,
        warmupRequests,
      })
    );
  }

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
