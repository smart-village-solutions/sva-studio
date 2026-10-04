import path from 'node:path';
import type {
  CoverageMetric,
  CoveragePolicy,
  CoverageSummary,
  MetricFloors,
} from './coverage-policy.ts';

export function toMetricValues(summary: CoverageSummary, projectRoot?: string): MetricFloors {
  if (projectRoot) {
    const normalizedProjectRoot = `${path.resolve(projectRoot)}${path.sep}`;
    const counters = Object.entries(summary).reduce<
      Record<CoverageMetric, { total: number; covered: number }>
    >(
      (acc, [filePath, metrics]) => {
        if (
          filePath === 'total' ||
          !path.resolve(filePath).startsWith(normalizedProjectRoot) ||
          !metrics
        ) {
          return acc;
        }

        for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
          acc[metric].total += Number(metrics[metric]?.total ?? 0);
          acc[metric].covered += Number(metrics[metric]?.covered ?? 0);
        }

        return acc;
      },
      {
        lines: { total: 0, covered: 0 },
        statements: { total: 0, covered: 0 },
        functions: { total: 0, covered: 0 },
        branches: { total: 0, covered: 0 },
      }
    );

    const hasScopedEntries = Object.values(counters).some(({ total }) => total > 0);
    if (hasScopedEntries) {
      return {
        lines: toPct(counters.lines.covered, counters.lines.total),
        statements: toPct(counters.statements.covered, counters.statements.total),
        functions: toPct(counters.functions.covered, counters.functions.total),
        branches: toPct(counters.branches.covered, counters.branches.total),
      };
    }
  }

  const total = summary.total ?? {};
  return {
    lines: Number(total.lines?.pct ?? 0),
    statements: Number(total.statements?.pct ?? 0),
    functions: Number(total.functions?.pct ?? 0),
    branches: Number(total.branches?.pct ?? 0),
  };
}

export function mergeGlobal(projectMetricsList: MetricFloors[]): MetricFloors {
  if (projectMetricsList.length === 0) {
    return { lines: 0, statements: 0, functions: 0, branches: 0 };
  }

  const totals = projectMetricsList.reduce<MetricFloors>(
    (acc, current) => ({
      lines: acc.lines + current.lines,
      statements: acc.statements + current.statements,
      functions: acc.functions + current.functions,
      branches: acc.branches + current.branches,
    }),
    { lines: 0, statements: 0, functions: 0, branches: 0 }
  );

  return {
    lines: totals.lines / projectMetricsList.length,
    statements: totals.statements / projectMetricsList.length,
    functions: totals.functions / projectMetricsList.length,
    branches: totals.branches / projectMetricsList.length,
  };
}

export function selectProjectsForGlobalFloors(
  policy: CoveragePolicy,
  activeProjects: Array<[string, MetricFloors]>
): Array<[string, MetricFloors]> {
  const explicitlyFlooredProjects = new Set(Object.keys(policy.perProjectFloors ?? {}));
  return activeProjects.filter(([projectName]) => !explicitlyFlooredProjects.has(projectName));
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function toPct(hit: number, found: number): number {
  if (found === 0) {
    return 100;
  }

  return Number(((hit / found) * 100).toFixed(2));
}

export function generateReport(
  policy: CoveragePolicy,
  projects: Record<string, MetricFloors>
): string {
  const sortedProjects = Object.entries(projects).sort(([a], [b]) => a.localeCompare(b));
  const exemptProjects = new Set<string>(policy.exemptProjects ?? []);
  const activeProjects = sortedProjects.filter(([name]) => !exemptProjects.has(name));
  const globalProjects = selectProjectsForGlobalFloors(policy, activeProjects);
  const globalCoverage = mergeGlobal(globalProjects.map(([, values]) => values));
  const globalLabel =
    globalProjects.length > 0
      ? 'Global coverage (default-floor projects avg)'
      : 'Global coverage (no default-floor projects)';

  const header = [
    '## Coverage Summary',
    '',
    '| Project | Lines | Statements | Functions | Branches |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  const rows = sortedProjects.map(
    ([projectName, values]) =>
      `| ${projectName} | ${formatPct(values.lines)} | ${formatPct(values.statements)} | ${formatPct(values.functions)} | ${formatPct(values.branches)} |`
  );
  const footer = [
    '',
    globalProjects.length > 0
      ? `${globalLabel}: lines ${formatPct(globalCoverage.lines)}, statements ${formatPct(globalCoverage.statements)}, functions ${formatPct(globalCoverage.functions)}, branches ${formatPct(globalCoverage.branches)}`
      : `${globalLabel}: n/a`,
  ];

  return [...header, ...rows, ...footer].join('\n') + '\n';
}
