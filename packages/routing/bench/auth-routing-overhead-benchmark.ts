import { performance } from 'node:perf_hooks';

import {
  authRoutePaths,
  verifyAuthRouteHandlerCoverage,
  wrapHandlersWithJsonErrorBoundary,
} from '../src/auth.routes.server';

const sortNumeric = (values: readonly number[]) => [...values].sort((a, b) => a - b);

const percentile = (values: readonly number[], p: number) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = sortNumeric(values);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

const average = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const toFixed = (value: number) => Number(value.toFixed(4));

const createEmptyHandlers = () =>
  Object.fromEntries(authRoutePaths.map((path) => [path, {}])) as Record<string, Record<string, never>>;

const measureSync = (runs: number, execute: () => void): number[] => {
  const durationsMs: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now();
    execute();
    durationsMs.push(performance.now() - startedAt);
  }
  return durationsMs;
};

const measureAsync = async (runs: number, execute: () => Promise<void>): Promise<number[]> => {
  const durationsMs: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now();
    await execute();
    durationsMs.push(performance.now() - startedAt);
  }
  return durationsMs;
};

const summarize = (values: readonly number[]) => ({
  avgMs: toFixed(average(values)),
  p50Ms: toFixed(percentile(values, 50)),
  p95Ms: toFixed(percentile(values, 95)),
  p99Ms: toFixed(percentile(values, 99)),
  maxMs: toFixed(Math.max(...values)),
});

const run = async () => {
  const guardWarmupRuns = 2_000;
  const guardBenchmarkRuns = 20_000;
  const handlerWarmupRuns = 2_000;
  const handlerBenchmarkRuns = 20_000;

  const guardHandlers = createEmptyHandlers();
  const noopLogger = { warn: () => undefined };

  for (let index = 0; index < guardWarmupRuns; index += 1) {
    verifyAuthRouteHandlerCoverage(authRoutePaths, guardHandlers, noopLogger);
  }
  const guardDurationsMs = measureSync(guardBenchmarkRuns, () => {
    verifyAuthRouteHandlerCoverage(authRoutePaths, guardHandlers, noopLogger);
  });

  const response = new Response(null, { status: 204 });
  const request = new Request('http://localhost/api/v1/iam/users', { method: 'GET' });
  const rawHandler = async () => response;
  const wrappedHandler = wrapHandlersWithJsonErrorBoundary({ GET: rawHandler }).GET;
  if (!wrappedHandler) {
    throw new Error('wrapped_get_handler_missing');
  }

  for (let index = 0; index < handlerWarmupRuns; index += 1) {
    await rawHandler();
    await wrappedHandler({ request });
  }
  const rawDurationsMs = await measureAsync(handlerBenchmarkRuns, async () => {
    await rawHandler();
  });
  const wrappedDurationsMs = await measureAsync(handlerBenchmarkRuns, async () => {
    await wrappedHandler({ request });
  });

  const metrics = {
    scenario: 'auth-routing-error-boundary-and-startup-guard-overhead',
    measuredAt: new Date().toISOString(),
    guard: {
      runs: guardBenchmarkRuns,
      warmupRuns: guardWarmupRuns,
      routeCount: authRoutePaths.length,
      ...summarize(guardDurationsMs),
      targetP95Ms: 1,
      withinTarget: percentile(guardDurationsMs, 95) < 1,
    },
    successHandler: {
      runs: handlerBenchmarkRuns,
      warmupRuns: handlerWarmupRuns,
      raw: summarize(rawDurationsMs),
      wrapped: summarize(wrappedDurationsMs),
      overhead: {
        avgMs: toFixed(average(wrappedDurationsMs) - average(rawDurationsMs)),
        p95Ms: toFixed(percentile(wrappedDurationsMs, 95) - percentile(rawDurationsMs, 95)),
      },
      targetP95Ms: 1,
      withinTarget: percentile(wrappedDurationsMs, 95) < 1,
    },
  };

  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
};

void run();
