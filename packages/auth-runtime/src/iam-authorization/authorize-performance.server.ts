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
const reportRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/reports');

const latestBenchmarkByActor = new Map<string, AuthorizePerformanceRunResult>();

const toActorKey = (input: { instanceId: string; keycloakSubject: string }) =>
  `${input.instanceId}:${input.keycloakSubject}`;

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

const createReportBaseName = (generatedAt: Date): string =>
  `iam-authorize-performance-${generatedAt.toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z')}`;

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
  latestBenchmarkByActor.get(toActorKey(input)) ?? null;

export const runAuthorizePerformanceBenchmark = async (
  input: BenchmarkInput
): Promise<AuthorizePerformanceRunResult> => {
  const generatedAt = new Date();
  const measuredRequests = input.request.measuredRequests ?? DEFAULT_MEASURED_REQUESTS;
  const warmupRequests = input.request.warmupRequests ?? DEFAULT_WARMUP_REQUESTS;
  const runId = generatedAt.getTime().toString(36);

  const basePayload = {
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
  };

  const scenarios: AuthorizePerformanceScenarioResult[] = [];
  for (const scenario of ['cache-hit', 'cache-miss', 'recompute'] as const) {
    const observedStatuses = [] as string[];

    const stableWarmupPayload =
      scenario === 'cache-miss'
        ? null
        : buildAuthorizePerformancePayload({
            basePayload,
            runId,
            sampleIndex: 0,
            scenario,
          });

    for (let index = 0; index < warmupRequests; index += 1) {
      if (scenario === 'recompute') {
        await invalidateUserScope(input.actor);
      }

      const warmupPayload =
        scenario === 'cache-miss'
          ? buildAuthorizePerformancePayload({
              basePayload,
              runId: `${runId}-warmup`,
              sampleIndex: index,
              scenario,
            })
          : stableWarmupPayload;

      if (!warmupPayload) {
        throw new Error('warmup_payload_missing');
      }

      await invokeAuthorize({
        headers: input.requestHeaders,
        payload: warmupPayload,
        requestUrl: input.requestUrl,
      });
    }

    const samplesMs = [] as number[];
    for (let sampleIndex = 0; sampleIndex < measuredRequests; sampleIndex += 1) {
      if (scenario === 'recompute') {
        await invalidateUserScope(input.actor);
      }

      const payload = buildAuthorizePerformancePayload({
        basePayload,
        runId,
        sampleIndex,
        scenario,
      });
      const result = await invokeAuthorize({
        headers: input.requestHeaders,
        payload,
        requestUrl: input.requestUrl,
      });
      samplesMs.push(result.durationMs);
      observedStatuses.push(result.cacheStatus);
    }

    assertScenarioStatuses({
      observedStatuses,
      scenario,
    });

    const summary = summarizeAuthorizePerformanceDurations(samplesMs);
    const evaluation = summary.p95Ms < scenarioThresholdMs(scenario) ? 'accepted' : 'rejected';

    scenarios.push({
      scenario,
      samplesMs,
      summary,
      evaluation,
      evaluationLabel: evaluation === 'accepted' ? 'erfüllt' : 'nicht erfüllt',
      observedCacheStatuses: observedStatuses,
    });
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
  latestBenchmarkByActor.set(
    toActorKey({
      instanceId: input.actor.instanceId,
      keycloakSubject: input.actor.id,
    }),
    finalizedResult
  );

  return finalizedResult;
};
