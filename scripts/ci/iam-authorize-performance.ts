export type AuthorizeBenchmarkScenario = 'cache-hit' | 'cache-miss' | 'recompute';

export type AuthorizeBenchmarkPayload = {
  readonly instanceId: string;
  readonly action: string;
  readonly resource: {
    readonly type: string;
    readonly id?: string;
    readonly organizationId?: string;
  };
  readonly context?: {
    readonly organizationId?: string;
    readonly geoUnitId?: string;
    readonly geoHierarchy?: readonly string[];
    readonly requestId?: string;
  };
};

export type DurationSummary = {
  readonly count: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly avgMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
};

export type ScenarioMeasurement = {
  readonly scenario: AuthorizeBenchmarkScenario;
  readonly samplesMs: readonly number[];
  readonly summary: DurationSummary;
  readonly accepted: boolean;
};

export type AuthorizePerformanceReport = {
  readonly generatedAt: string;
  readonly target: {
    readonly baseUrl: string;
    readonly instanceId: string;
    readonly keycloakSubject: string;
  };
  readonly configuration: {
    readonly concurrency: number;
    readonly measuredRequests: number;
    readonly warmupRequests: number;
  };
  readonly scenarios: readonly ScenarioMeasurement[];
};

const buildBenchmarkGeoHierarchyUuid = (runId: string, sampleIndex: number): string => {
  const seed = `${runId}-${sampleIndex}`;
  const hex = Array.from(seed)
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(32, '0')
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const sortedCopy = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = sortedCopy(values);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
};

export const summarizeDurations = (values: readonly number[]): DurationSummary => {
  if (values.length === 0) {
    return {
      count: 0,
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
    };
  }

  const sorted = sortedCopy(values);
  const total = sorted.reduce((sum, current) => sum + current, 0);

  return {
    count: sorted.length,
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    avgMs: total / sorted.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
  };
};

export const buildAuthorizeBenchmarkPayload = (input: {
  readonly basePayload: AuthorizeBenchmarkPayload;
  readonly runId: string;
  readonly sampleIndex: number;
  readonly scenario: AuthorizeBenchmarkScenario;
}): AuthorizeBenchmarkPayload => {
  const requestId = `bench-${input.runId}-${input.scenario}-${input.sampleIndex}`;
  if (input.scenario !== 'cache-miss') {
    return {
      ...input.basePayload,
      context: {
        ...input.basePayload.context,
        requestId,
      },
    };
  }

  return {
    ...input.basePayload,
    context: {
      ...input.basePayload.context,
      requestId,
      geoHierarchy: [buildBenchmarkGeoHierarchyUuid(input.runId, input.sampleIndex)],
    },
  };
};

const scenarioLabel = (scenario: AuthorizeBenchmarkScenario): string => {
  switch (scenario) {
    case 'cache-hit':
      return 'Cache-Hit';
    case 'cache-miss':
      return 'Cache-Miss';
    case 'recompute':
      return 'Recompute';
  }
};

const formatMs = (value: number): string => `${value.toFixed(2)} ms`;

export const renderAuthorizePerformanceMarkdownReport = (
  report: AuthorizePerformanceReport
): string => {
  const cacheHit = report.scenarios.find((scenario) => scenario.scenario === 'cache-hit');
  const cacheHitVerdict =
    cacheHit && cacheHit.summary.p95Ms < 100 ? 'erfüllt' : 'nicht erfüllt';

  const lines = [
    '# Performance-Nachweis IAM Authorize',
    '',
    '## Kontext',
    '',
    `- Zeitpunkt: ${report.generatedAt}`,
    `- Zielumgebung: ${report.target.baseUrl}`,
    `- Instanzkontext: ${report.target.instanceId}`,
    `- Keycloak-Subject: ${report.target.keycloakSubject}`,
    `- Parallelität: ${report.configuration.concurrency}`,
    `- Mess-Requests je Szenario: ${report.configuration.measuredRequests}`,
    `- Warm-up-Requests je Szenario: ${report.configuration.warmupRequests}`,
    '',
    '## Ergebnisübersicht',
    '',
    '| Szenario | Samples | p50 | p95 | p99 | Bewertung |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.scenarios.map(
      (scenario) =>
        `| ${scenarioLabel(scenario.scenario)} | ${scenario.summary.count} | ${formatMs(scenario.summary.p50Ms)} | ${formatMs(scenario.summary.p95Ms)} | ${formatMs(scenario.summary.p99Ms)} | ${scenario.accepted ? 'erfüllt' : 'nicht erfüllt'} |`
    ),
    '',
    '## Abnahmeaussage',
    '',
    `- p95 < 100 ms im Cache-Hit-Szenario: ${cacheHitVerdict}`,
    '',
    '## Rohbeobachtungen',
    '',
  ];

  for (const scenario of report.scenarios) {
    lines.push(`### ${scenarioLabel(scenario.scenario)}`);
    lines.push('');
    lines.push(`- Minimum: ${formatMs(scenario.summary.minMs)}`);
    lines.push(`- Durchschnitt: ${formatMs(scenario.summary.avgMs)}`);
    lines.push(`- Maximum: ${formatMs(scenario.summary.maxMs)}`);
    lines.push(`- Bewertung: ${scenario.accepted ? 'erfüllt' : 'nicht erfüllt'}`);
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
};
