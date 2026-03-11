import { performance } from 'node:perf_hooks';

import type { AuthorizeRequest, EffectivePermission } from '@sva/core';
import { evaluateAuthorizeDecision } from '../src/iam-authorization.server';

const sortNumeric = (values: readonly number[]) => [...values].sort((a, b) => a - b);

const percentile = (values: readonly number[], p: number) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = sortNumeric(values);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

const toFixed = (value: number) => Number(value.toFixed(4));

const makePermissions = (count: number): EffectivePermission[] =>
  Array.from({ length: count }, (_, index) => ({
    action: index % 2 === 0 ? 'content.read' : `content.${index}`,
    resourceType: index % 3 === 0 ? 'content' : 'other',
    organizationId: index % 5 === 0 ? '22222222-2222-2222-8222-222222222222' : undefined,
    sourceRoleIds: [`role-${index}`],
  }));

const run = () => {
  const request: AuthorizeRequest = {
    instanceId: 'de-musterhausen',
    action: 'content.read',
    resource: {
      type: 'content',
      id: 'article-1',
      organizationId: '22222222-2222-2222-8222-222222222222',
    },
    context: {
      organizationId: '22222222-2222-2222-8222-222222222222',
      requestId: 'bench-request',
      traceId: 'bench-trace',
    },
  };

  const permissions = makePermissions(512);
  const warmupRuns = 2_000;
  const benchmarkRuns = 20_000;

  for (let i = 0; i < warmupRuns; i += 1) {
    evaluateAuthorizeDecision(request, permissions);
  }

  const durationsMs: number[] = [];
  for (let i = 0; i < benchmarkRuns; i += 1) {
    const startedAt = performance.now();
    evaluateAuthorizeDecision(request, permissions);
    durationsMs.push(performance.now() - startedAt);
  }

  const total = durationsMs.reduce((sum, current) => sum + current, 0);
  const metrics = {
    scenario: 'authorize-rbac-v1-evaluator',
    runs: benchmarkRuns,
    warmupRuns,
    permissionsEvaluated: permissions.length,
    avgMs: toFixed(total / durationsMs.length),
    p50Ms: toFixed(percentile(durationsMs, 50)),
    p95Ms: toFixed(percentile(durationsMs, 95)),
    p99Ms: toFixed(percentile(durationsMs, 99)),
    maxMs: toFixed(Math.max(...durationsMs)),
    targetP95Ms: 50,
    withinTarget: percentile(durationsMs, 95) < 50,
    measuredAt: new Date().toISOString(),
  };

  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
};

run();
