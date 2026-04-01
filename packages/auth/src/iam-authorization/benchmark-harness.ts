import { performance } from 'node:perf_hooks';

export type BenchmarkMetrics = {
  readonly scenario: string;
  readonly samples: number;
  readonly warmupRuns: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly avgMs: number;
  readonly maxMs: number;
};

const sortNumeric = (values: readonly number[]) => [...values].sort((left, right) => left - right);

const percentile = (values: readonly number[], percentileValue: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = sortNumeric(values);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

const toFixed = (value: number) => Number(value.toFixed(4));

export const runTimedScenario = async (input: {
  scenario: string;
  warmupRuns: number;
  samples: number;
  execute: () => Promise<void> | void;
}): Promise<BenchmarkMetrics> => {
  for (let index = 0; index < input.warmupRuns; index += 1) {
    await input.execute();
  }

  const durationsMs: number[] = [];
  for (let index = 0; index < input.samples; index += 1) {
    const startedAt = performance.now();
    await input.execute();
    durationsMs.push(performance.now() - startedAt);
  }

  const total = durationsMs.reduce((sum, current) => sum + current, 0);

  return {
    scenario: input.scenario,
    samples: input.samples,
    warmupRuns: input.warmupRuns,
    p50Ms: toFixed(percentile(durationsMs, 50)),
    p95Ms: toFixed(percentile(durationsMs, 95)),
    p99Ms: toFixed(percentile(durationsMs, 99)),
    avgMs: toFixed(total / durationsMs.length),
    maxMs: toFixed(Math.max(...durationsMs)),
  };
};
