import type {
  AuthorizePerformanceRequest,
  AuthorizePerformanceScenario,
  AuthorizePerformanceScenarioResult,
  AuthorizeResponse,
} from '@sva/core';
import { buildAuthorizePerformancePayload, summarizeAuthorizePerformanceDurations } from '@sva/core';

import { authorizeHandler } from './authorize.js';
import { invalidateRedisPermissionSnapshots } from './redis-permission-snapshot.server.js';
import { permissionSnapshotCache } from './shared.js';

export type BenchmarkActor = {
  readonly id: string;
  readonly instanceId: string;
};

export type BenchmarkInput = {
  readonly actor: BenchmarkActor;
  readonly request: AuthorizePerformanceRequest;
  readonly requestHeaders: Headers;
  readonly requestUrl: string;
};

type ScenarioExecutionInput = BenchmarkInput & {
  readonly measuredRequests: number;
  readonly runId: string;
  readonly warmupRequests: number;
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

const maybeInvalidateScopeForScenario = async (
  scenario: AuthorizePerformanceScenario,
  actor: BenchmarkActor
): Promise<void> => {
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

export const runAuthorizePerformanceScenarios = async (
  input: ScenarioExecutionInput
): Promise<AuthorizePerformanceScenarioResult[]> => {
  const basePayload = buildAuthorizePerformanceBasePayload(input);
  const scenarios: AuthorizePerformanceScenarioResult[] = [];

  for (const scenario of ['cache-hit', 'cache-miss', 'recompute'] as const) {
    scenarios.push(
      await runScenarioBenchmark({
        actor: input.actor,
        basePayload,
        headers: input.requestHeaders,
        measuredRequests: input.measuredRequests,
        requestUrl: input.requestUrl,
        runId: input.runId,
        scenario,
        warmupRequests: input.warmupRequests,
      })
    );
  }

  return scenarios;
};
