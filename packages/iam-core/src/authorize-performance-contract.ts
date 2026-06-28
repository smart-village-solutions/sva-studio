export const authorizePerformanceScenarios = ['cache-hit', 'cache-miss', 'recompute'] as const;

export type AuthorizePerformanceScenario = (typeof authorizePerformanceScenarios)[number];

export type AuthorizePerformanceRequest = {
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly organizationId?: string;
  readonly measuredRequests?: number;
  readonly warmupRequests?: number;
};

export type AuthorizePerformanceEvaluation = 'accepted' | 'rejected';

export type AuthorizePerformancePayload = {
  readonly instanceId: string;
  readonly action: string;
  readonly resource: {
    readonly type: string;
    readonly id?: string;
    readonly organizationId?: string;
    readonly attributes?: Readonly<Record<string, unknown>>;
  };
  readonly context?: {
    readonly organizationId?: string;
    readonly requestId?: string;
    readonly attributes?: Readonly<Record<string, unknown>>;
  };
};

export type AuthorizePerformanceDurationSummary = {
  readonly count: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly avgMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
};

export type AuthorizePerformanceScenarioResult = {
  readonly scenario: AuthorizePerformanceScenario;
  readonly samplesMs: readonly number[];
  readonly summary: AuthorizePerformanceDurationSummary;
  readonly evaluation: AuthorizePerformanceEvaluation;
  readonly evaluationLabel: string;
  readonly observedCacheStatuses: readonly string[];
};

export type AuthorizePerformanceReportReference = {
  readonly jsonPath?: string;
  readonly markdownPath?: string;
};

export type AuthorizePerformanceRunResult = {
  readonly generatedAt: string;
  readonly measuredOn: 'server';
  readonly actor: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
  };
  readonly request: {
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId?: string;
    readonly organizationId?: string;
  };
  readonly configuration: {
    readonly measuredRequests: number;
    readonly warmupRequests: number;
  };
  readonly scenarios: readonly AuthorizePerformanceScenarioResult[];
  readonly report?: AuthorizePerformanceReportReference;
};

export type AuthorizePerformanceRunResponse = {
  readonly data: AuthorizePerformanceRunResult | null;
};

const sortedCopy = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

const buildBenchmarkGeoHierarchyUuid = (runId: string, sampleIndex: number): string => {
  const seed = `${runId}-${sampleIndex}`;
  const hex = Array.from(seed)
    .map((character) => (character.codePointAt(0) ?? 0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(32, '0')
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = sortedCopy(values);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
};

export const summarizeAuthorizePerformanceDurations = (
  values: readonly number[]
): AuthorizePerformanceDurationSummary => {
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

export const buildAuthorizePerformancePayload = (input: {
  readonly basePayload: AuthorizePerformancePayload;
  readonly runId: string;
  readonly sampleIndex: number;
  readonly scenario: AuthorizePerformanceScenario;
}): AuthorizePerformancePayload => {
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
      attributes: {
        ...input.basePayload.context?.attributes,
        geoHierarchy: [buildBenchmarkGeoHierarchyUuid(input.runId, input.sampleIndex)],
      },
    },
  };
};

const scenarioLabel = (scenario: AuthorizePerformanceScenario): string => {
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
  report: AuthorizePerformanceRunResult
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
    `- Instanzkontext: ${report.actor.instanceId}`,
    `- Keycloak-Subject: ${report.actor.keycloakSubject}`,
    `- Action: ${report.request.action}`,
    `- Resource-Typ: ${report.request.resourceType}`,
    `- Resource-ID: ${report.request.resourceId ?? 'n. v.'}`,
    `- Organisationskontext: ${report.request.organizationId ?? 'n. v.'}`,
    `- Mess-Requests je Szenario: ${report.configuration.measuredRequests}`,
    `- Warm-up-Requests je Szenario: ${report.configuration.warmupRequests}`,
    '',
    '## Ergebnisübersicht',
    '',
    '| Szenario | Samples | p50 | p95 | p99 | Bewertung |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.scenarios.map(
      (scenario) =>
        `| ${scenarioLabel(scenario.scenario)} | ${scenario.summary.count} | ${formatMs(scenario.summary.p50Ms)} | ${formatMs(scenario.summary.p95Ms)} | ${formatMs(scenario.summary.p99Ms)} | ${scenario.evaluationLabel} |`
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
    lines.push(`- Bewertung: ${scenario.evaluationLabel}`);
    lines.push(`- Cache-Status: ${scenario.observedCacheStatuses.join(', ')}`);
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
};
