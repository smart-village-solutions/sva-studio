import { performance } from 'node:perf_hooks';

import type { IdentityListedUser } from '../src/identity-provider-port';
import { collectSyncCandidates } from '../src/iam-account-management/user-import-sync-handler';
import { logger } from '../src/iam-account-management/shared';

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

const summarize = (values: readonly number[]) => ({
  avgMs: toFixed(average(values)),
  p50Ms: toFixed(percentile(values, 50)),
  p95Ms: toFixed(percentile(values, 95)),
  p99Ms: toFixed(percentile(values, 99)),
  maxMs: toFixed(Math.max(...values)),
});

const createUsers = (count: number, expectedInstanceId: string): IdentityListedUser[] =>
  Array.from({ length: count }, (_, index) => {
    const isMatching = index % 5 === 0;
    const instanceId = isMatching
      ? expectedInstanceId
      : `99999999-9999-4999-8999-${String(index % 8).padStart(12, '0')}`;
    return {
      externalId: `subject-${index}`,
      username: `user-${index}`,
      email: `user-${index}@example.test`,
      firstName: 'Batch',
      lastName: `User ${index}`,
      enabled: true,
      attributes: {
        instanceId: [instanceId],
      },
    };
  });

const measureScenario = (
  listedUsers: readonly IdentityListedUser[],
  expectedInstanceId: string,
  debugEnabled: boolean
) => {
  const originalIsLevelEnabled = logger.isLevelEnabled.bind(logger);
  const originalDebug = logger.debug.bind(logger);

  let debugCalls = 0;

  logger.isLevelEnabled = (level: string) => (level === 'debug' ? debugEnabled : originalIsLevelEnabled(level));
  logger.debug = () => {
    debugCalls += 1;
  };

  const warmupRuns = 50;
  const benchmarkRuns = 300;
  try {
    for (let index = 0; index < warmupRuns; index += 1) {
      collectSyncCandidates(listedUsers, expectedInstanceId);
    }

    const durationsMs: number[] = [];
    for (let index = 0; index < benchmarkRuns; index += 1) {
      const startedAt = performance.now();
      collectSyncCandidates(listedUsers, expectedInstanceId);
      durationsMs.push(performance.now() - startedAt);
    }

    return {
      debugEnabled,
      runs: benchmarkRuns,
      warmupRuns,
      debugCalls,
      ...summarize(durationsMs),
      targetP95Ms: 25,
      withinTarget: percentile(durationsMs, 95) < 25,
    };
  } finally {
    logger.isLevelEnabled = originalIsLevelEnabled;
    logger.debug = originalDebug;
  }
};

const run = () => {
  const expectedInstanceId = '11111111-1111-4111-8111-111111111111';
  const listedUsers = createUsers(10_000, expectedInstanceId);
  const skippedUsers = listedUsers.length - Math.floor(listedUsers.length / 5);

  const debugOff = measureScenario(listedUsers, expectedInstanceId, false);
  const debugOn = measureScenario(listedUsers, expectedInstanceId, true);

  const metrics = {
    scenario: 'iam-user-import-sync-batch-skip-logging',
    measuredAt: new Date().toISOString(),
    batch: {
      totalUsers: listedUsers.length,
      matchingUsers: listedUsers.length - skippedUsers,
      skippedUsers,
      skippedDebugLogCap: 20,
      distinctMismatchedInstanceIds: 8,
    },
    debugOff,
    debugOn,
    overhead: {
      avgMs: toFixed(debugOn.avgMs - debugOff.avgMs),
      p95Ms: toFixed(debugOn.p95Ms - debugOff.p95Ms),
    },
  };

  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
};

run();
