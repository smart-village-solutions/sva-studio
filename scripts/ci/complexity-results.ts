import type {
  AnalyzedFile,
  ComplexityBaseline,
  ComplexityBaselineEntry,
  ComplexityMetricKey,
  ComplexityModule,
  ComplexityPolicy,
  ComplexityThresholds,
  MetricViolation,
  TrackedFinding,
} from './complexity-policy.ts';

interface ModuleSummary {
  module: ComplexityModule;
  fileCount: number;
  maxFileLines: number;
  maxFunctionLines: number;
  maxCyclomaticComplexity: number;
  maxPublicExports: number;
}

function getEffectiveThresholds(
  policy: ComplexityPolicy,
  moduleConfig: ComplexityModule
): ComplexityThresholds {
  const baseThresholds = policy.classThresholds[moduleConfig.class];
  return {
    ...baseThresholds,
    ...moduleConfig.overrides,
  };
}

function toFindingId(moduleId: string, filePath: string, metric: ComplexityMetricKey): string {
  return `${moduleId}:${filePath}:${metric}`;
}

function baselineMetricValue(
  baseline: ComplexityBaseline,
  filePath: string,
  metric: ComplexityMetricKey
): number | null {
  const entry = baseline.files[filePath];
  if (!entry) {
    return null;
  }

  switch (metric) {
    case 'fileLines':
      return entry.fileLines;
    case 'functionLines':
      return entry.functionLines;
    case 'cyclomaticComplexity':
      return entry.cyclomaticComplexity;
    case 'publicExports':
      return entry.publicExports;
  }
}

export function collectViolations(
  policy: ComplexityPolicy,
  baseline: ComplexityBaseline,
  analyzedFiles: AnalyzedFile[]
): MetricViolation[] {
  const violations: MetricViolation[] = [];

  for (const analyzedFile of analyzedFiles) {
    const thresholds = getEffectiveThresholds(policy, analyzedFile.module);
    const metricValues: Record<ComplexityMetricKey, number> = {
      fileLines: analyzedFile.metrics.fileLines,
      functionLines: analyzedFile.metrics.maxFunctionLines,
      cyclomaticComplexity: analyzedFile.metrics.maxCyclomaticComplexity,
      publicExports: analyzedFile.metrics.publicExports,
    };

    for (const metric of Object.keys(metricValues) as ComplexityMetricKey[]) {
      const current = metricValues[metric];
      const threshold = thresholds[metric];
      if (current <= threshold) {
        continue;
      }

      const findingId = toFindingId(analyzedFile.module.id, analyzedFile.metrics.filePath, metric);
      const previous = baselineMetricValue(baseline, analyzedFile.metrics.filePath, metric);
      violations.push({
        findingId,
        moduleId: analyzedFile.module.id,
        moduleLabel: analyzedFile.module.label,
        moduleClass: analyzedFile.module.class,
        filePath: analyzedFile.metrics.filePath,
        metric,
        current,
        threshold,
        trend: previous === null ? null : current - previous,
        trackedFinding: policy.trackedFindings[findingId] ?? null,
      });
    }
  }

  return violations.sort((left, right) => {
    if (left.trackedFinding && !right.trackedFinding) {
      return 1;
    }

    if (!left.trackedFinding && right.trackedFinding) {
      return -1;
    }

    if (left.moduleId !== right.moduleId) {
      return left.moduleId.localeCompare(right.moduleId);
    }

    if (left.filePath !== right.filePath) {
      return left.filePath.localeCompare(right.filePath);
    }

    return left.metric.localeCompare(right.metric);
  });
}

export function buildBaseline(analyzedFiles: AnalyzedFile[]): ComplexityBaseline {
  const files = analyzedFiles.reduce<Record<string, ComplexityBaselineEntry>>(
    (acc, analyzedFile) => {
      acc[analyzedFile.metrics.filePath] = {
        moduleId: analyzedFile.module.id,
        filePath: analyzedFile.metrics.filePath,
        fileLines: analyzedFile.metrics.fileLines,
        functionLines: analyzedFile.metrics.maxFunctionLines,
        cyclomaticComplexity: analyzedFile.metrics.maxCyclomaticComplexity,
        publicExports: analyzedFile.metrics.publicExports,
      };
      return acc;
    },
    {}
  );

  return { files };
}

function formatTrend(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  if (value === 0) {
    return '0';
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function buildModuleSummaries(analyzedFiles: AnalyzedFile[]): ModuleSummary[] {
  const summaryMap = new Map<string, ModuleSummary>();

  for (const analyzedFile of analyzedFiles) {
    const existing = summaryMap.get(analyzedFile.module.id);
    if (existing) {
      existing.fileCount += 1;
      existing.maxFileLines = Math.max(existing.maxFileLines, analyzedFile.metrics.fileLines);
      existing.maxFunctionLines = Math.max(
        existing.maxFunctionLines,
        analyzedFile.metrics.maxFunctionLines
      );
      existing.maxCyclomaticComplexity = Math.max(
        existing.maxCyclomaticComplexity,
        analyzedFile.metrics.maxCyclomaticComplexity
      );
      existing.maxPublicExports = Math.max(
        existing.maxPublicExports,
        analyzedFile.metrics.publicExports
      );
      continue;
    }

    summaryMap.set(analyzedFile.module.id, {
      module: analyzedFile.module,
      fileCount: 1,
      maxFileLines: analyzedFile.metrics.fileLines,
      maxFunctionLines: analyzedFile.metrics.maxFunctionLines,
      maxCyclomaticComplexity: analyzedFile.metrics.maxCyclomaticComplexity,
      maxPublicExports: analyzedFile.metrics.publicExports,
    });
  }

  return Array.from(summaryMap.values()).sort((left, right) =>
    left.module.id.localeCompare(right.module.id)
  );
}

export function generateReport(
  analyzedFiles: AnalyzedFile[],
  violations: MetricViolation[]
): string {
  const trackedViolations = violations.filter((violation) => violation.trackedFinding);
  const untrackedViolations = violations.filter((violation) => !violation.trackedFinding);
  const moduleRows = buildModuleSummaries(analyzedFiles).map(
    (summary) =>
      `| ${summary.module.label} | ${summary.module.class} | ${summary.fileCount} | ${summary.module.owner} | ${summary.module.reviewCadence} | ${summary.maxFileLines} | ${summary.maxFunctionLines} | ${summary.maxCyclomaticComplexity} | ${summary.maxPublicExports} |`
  );

  const reportLines = [
    '## Complexity Summary',
    '',
    '| Module | Klasse | Dateien | Owner | Review-Zyklus | Max Dateizeilen | Max Funktionslänge | Max Cyclomatic | Max Public Exports |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |',
    ...moduleRows,
  ];

  if (untrackedViolations.length > 0) {
    reportLines.push(
      '',
      '### Neue Findings ohne Ticket',
      '',
      '| Modul | Datei | Metrik | Ist | Soll | Trend |',
      '| --- | --- | --- | ---: | ---: | ---: |',
      ...untrackedViolations.map(
        (violation) =>
          `| ${violation.moduleLabel} | ${violation.filePath} | ${violation.metric} | ${violation.current} | ${violation.threshold} | ${formatTrend(violation.trend)} |`
      )
    );
  }

  if (trackedViolations.length > 0) {
    reportLines.push(
      '',
      '### Getrackte Findings',
      '',
      '| Modul | Datei | Metrik | Ist | Soll | Trend | Ticket | Status |',
      '| --- | --- | --- | ---: | ---: | ---: | --- | --- |',
      ...trackedViolations.map((violation) => {
        const trackedFinding = violation.trackedFinding as TrackedFinding;
        return `| ${violation.moduleLabel} | ${violation.filePath} | ${violation.metric} | ${violation.current} | ${violation.threshold} | ${formatTrend(violation.trend)} | ${trackedFinding.ticketSystem}:${trackedFinding.ticketId} | ${trackedFinding.status} |`;
      })
    );
  }

  reportLines.push(
    '',
    `Ausgewertete Dateien: ${analyzedFiles.length}`,
    `Neue Findings: ${untrackedViolations.length}`,
    `Getrackte Findings: ${trackedViolations.length}`
  );

  return reportLines.join('\n') + '\n';
}
