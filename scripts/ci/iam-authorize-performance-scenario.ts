import {
  authorizeBenchmarkP95ThresholdMs,
  buildAuthorizeBenchmarkPayload,
  summarizeDurations,
  type AuthorizeBenchmarkPayload,
  type AuthorizeBenchmarkScenario,
  type ScenarioMeasurement,
} from './iam-authorize-performance.ts';
import { emitUserScopeInvalidation, invokeAuthorize } from './iam-authorize-performance-request.js';
import type { Pool } from './iam-authorize-performance-request.js';
import type { BrowserContext } from './iam-authorize-performance-session.js';

const sleep = async (durationMs: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));

const scenarioThresholdMs = (scenario: AuthorizeBenchmarkScenario): number =>
  authorizeBenchmarkP95ThresholdMs[scenario];

const assertScenarioStatuses = (input: {
  readonly observedStatuses: readonly string[];
  readonly scenario: AuthorizeBenchmarkScenario;
}): void => {
  if (input.observedStatuses.length === 0) {
    throw new Error(`Szenario ${input.scenario} lieferte keine cacheStatus-Werte.`);
  }

  if (input.scenario === 'cache-hit' && input.observedStatuses.some((status) => status !== 'hit')) {
    throw new Error(
      `Szenario cache-hit lieferte unerwartete cacheStatus-Werte: ${input.observedStatuses.join(', ')}.`
    );
  }

  if (
    input.scenario === 'cache-miss' &&
    input.observedStatuses.some((status) => status !== 'miss')
  ) {
    throw new Error(
      `Szenario cache-miss lieferte unerwartete cacheStatus-Werte: ${input.observedStatuses.join(', ')}.`
    );
  }

  if (input.scenario === 'recompute' && input.observedStatuses.some((status) => status === 'hit')) {
    throw new Error(
      `Szenario recompute blieb im Cache-Hit hängen: ${input.observedStatuses.join(', ')}.`
    );
  }
};

export const runScenario = async (input: {
  readonly basePayload: AuthorizeBenchmarkPayload;
  readonly baseUrl: string;
  readonly context: BrowserContext;
  readonly invalidationDelayMs: number;
  readonly keycloakSubject: string;
  readonly measuredRequests: number;
  readonly pool: Pool;
  readonly runId: string;
  readonly scenario: AuthorizeBenchmarkScenario;
  readonly scenarioConcurrency: number;
  readonly warmupRequests: number;
}): Promise<ScenarioMeasurement> => {
  const stableWarmupPayload = buildAuthorizeBenchmarkPayload({
    basePayload: input.basePayload,
    runId: input.runId,
    sampleIndex: 0,
    scenario: input.scenario === 'cache-miss' ? 'cache-hit' : input.scenario,
  });

  for (let index = 0; index < input.warmupRequests; index += 1) {
    if (input.scenario === 'recompute') {
      await emitUserScopeInvalidation({
        pool: input.pool,
        instanceId: input.basePayload.instanceId,
        keycloakSubject: input.keycloakSubject,
        scenarioRunId: input.runId,
        sampleIndex: index,
      });
      await sleep(input.invalidationDelayMs);
    }

    const warmupPayload =
      input.scenario === 'cache-miss'
        ? buildAuthorizeBenchmarkPayload({
            basePayload: input.basePayload,
            runId: `${input.runId}-warmup`,
            sampleIndex: index,
            scenario: 'cache-miss',
          })
        : stableWarmupPayload;
    await invokeAuthorize({
      baseUrl: input.baseUrl,
      context: input.context,
      payload: warmupPayload,
    });
  }

  const samplesMs = new Array<number>(input.measuredRequests);
  const observedStatuses = new Array<string>(input.measuredRequests);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const sampleIndex = cursor;
      cursor += 1;

      if (sampleIndex >= input.measuredRequests) {
        return;
      }

      if (input.scenario === 'recompute') {
        await emitUserScopeInvalidation({
          pool: input.pool,
          instanceId: input.basePayload.instanceId,
          keycloakSubject: input.keycloakSubject,
          scenarioRunId: input.runId,
          sampleIndex,
        });
        await sleep(input.invalidationDelayMs);
      }

      const payload = buildAuthorizeBenchmarkPayload({
        basePayload: input.basePayload,
        runId: input.runId,
        sampleIndex,
        scenario: input.scenario,
      });

      const result = await invokeAuthorize({
        baseUrl: input.baseUrl,
        context: input.context,
        payload,
      });

      samplesMs[sampleIndex] = result.durationMs;
      observedStatuses[sampleIndex] = result.cacheStatus ?? 'unknown';
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, input.scenarioConcurrency) }, async () => worker())
  );

  assertScenarioStatuses({
    observedStatuses,
    scenario: input.scenario,
  });

  const summary = summarizeDurations(samplesMs);
  return {
    scenario: input.scenario,
    samplesMs,
    summary,
    accepted: summary.p95Ms < scenarioThresholdMs(input.scenario),
  };
};
