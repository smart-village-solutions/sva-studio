import type {
  CoverageBaseline,
  CoveragePolicy,
  FileCoverageMetrics,
  GateError,
  MetricFloors,
} from './coverage-policy.ts';
import { mergeGlobal, selectProjectsForGlobalFloors } from './coverage-metrics.ts';

export function evaluateFloors(
  policy: CoveragePolicy,
  projects: Record<string, MetricFloors>,
  requireSummaries: boolean
): GateError[] {
  const exemptProjects = new Set<string>(policy.exemptProjects ?? []);
  const metrics = policy.metrics;
  const errors: GateError[] = [];
  const expectedProjects = Object.keys(policy.perProjectFloors ?? {}).filter(
    (name) => !exemptProjects.has(name)
  );

  if (requireSummaries) {
    const missingSummaryErrors = expectedProjects
      .filter((projectName) => !projects[projectName])
      .map<GateError>((projectName) => ({
        scope: 'project',
        message: `[${projectName}] missing coverage-summary.json`,
      }));
    errors.push(...missingSummaryErrors);
  }

  const activeProjects = Object.entries(projects).filter(([name]) => !exemptProjects.has(name));
  const projectFloorErrors = activeProjects.flatMap(([projectName, values]) => {
    const floorConfig = policy.perProjectFloors?.[projectName] ?? policy.globalFloors;
    const criticalFloors = policy.criticalProjects?.[projectName]?.minimumFloors ?? {};
    return metrics.flatMap((metric) => {
      const floor = Math.max(
        Number(floorConfig[metric] ?? policy.globalFloors[metric] ?? 0),
        Number(criticalFloors[metric] ?? 0)
      );
      const current = Number(values[metric] ?? 0);
      if (current >= floor) {
        return [];
      }

      return [
        {
          scope: 'project' as const,
          message: `[${projectName}] ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`,
        },
      ];
    });
  });
  errors.push(...projectFloorErrors);

  if (requireSummaries) {
    const globalProjects = selectProjectsForGlobalFloors(policy, activeProjects);
    if (globalProjects.length === 0) {
      return errors;
    }
    const globalCoverage = mergeGlobal(globalProjects.map(([, values]) => values));
    const globalFloorErrors = metrics.flatMap((metric) => {
      const floor = Number(policy.globalFloors?.[metric] ?? 0);
      const current = Number(globalCoverage[metric] ?? 0);
      if (current >= floor) {
        return [];
      }

      return [
        {
          scope: 'global' as const,
          message: `[global] ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`,
        },
      ];
    });
    errors.push(...globalFloorErrors);
  }

  return errors;
}

export function evaluateCriticalHotspots(
  policy: CoveragePolicy,
  projects: Record<string, MetricFloors>,
  fileCoverageByProject: Record<string, Record<string, FileCoverageMetrics>>,
  requireSummaries: boolean
): GateError[] {
  const criticalProjects = policy.criticalProjects ?? {};
  const errors: GateError[] = [];

  for (const [projectName, criticalPolicy] of Object.entries(criticalProjects)) {
    const activeProject = Boolean(projects[projectName]);
    if (!activeProject && !requireSummaries) {
      continue;
    }

    const hotspotFloors = criticalPolicy.hotspotFloors ?? [];
    if (hotspotFloors.length === 0) {
      continue;
    }

    const fileCoverage = fileCoverageByProject[projectName];
    if (!fileCoverage) {
      if (activeProject || requireSummaries) {
        errors.push({
          scope: 'project',
          message: `[${projectName}] missing lcov.info for critical hotspot coverage evaluation`,
        });
      }
      continue;
    }

    for (const hotspot of hotspotFloors) {
      const hotspotCoverage = fileCoverage[hotspot.path];
      if (!hotspotCoverage) {
        errors.push({
          scope: 'project',
          message: `[${projectName}] missing hotspot coverage for ${hotspot.path}`,
        });
        continue;
      }

      for (const metric of ['lines', 'functions', 'branches'] as const) {
        const floor = hotspot.metrics[metric];
        if (floor === undefined) {
          continue;
        }

        const current = Number(hotspotCoverage[metric] ?? 0);
        if (current >= floor) {
          continue;
        }

        errors.push({
          scope: 'project',
          message: `[${projectName}] hotspot ${hotspot.path} ${metric} below floor: ${current.toFixed(2)} < ${floor.toFixed(2)}`,
        });
      }
    }
  }

  return errors;
}

export function evaluateRegressions(
  policy: CoveragePolicy,
  baseline: CoverageBaseline,
  projects: Record<string, MetricFloors>,
  evaluateRegressionDrops: boolean,
  regressionProjectFilter: readonly string[] = []
): GateError[] {
  // Partial affected runs only generate a subset of project summaries. In that mode we
  // skip baseline-drop checks entirely instead of reporting false regressions for every
  // untouched project that intentionally has no coverage output in this invocation.
  if (!evaluateRegressionDrops) {
    return [];
  }

  const exemptProjects = new Set<string>(policy.exemptProjects ?? []);
  const regressionProjects =
    regressionProjectFilter.length > 0 ? new Set(regressionProjectFilter) : null;
  const maxAllowedDrop = Number(policy.maxAllowedDropPctPoints ?? 0);
  const metrics = policy.metrics;
  const activeProjects = Object.entries(projects).filter(([name]) => {
    if (exemptProjects.has(name)) {
      return false;
    }

    if (regressionProjects && !regressionProjects.has(name)) {
      return false;
    }

    return true;
  });

  return activeProjects.flatMap(([projectName, values]) => {
    const baselineValues = baseline.projects?.[projectName] ?? null;
    if (!baselineValues) {
      return [];
    }

    return metrics.flatMap((metric) => {
      if (typeof baselineValues[metric] !== 'number') {
        return [];
      }

      const drop = Number(baselineValues[metric]) - Number(values[metric] ?? 0);
      if (drop <= maxAllowedDrop) {
        return [];
      }

      return [
        {
          scope: 'project' as const,
          message: `[${projectName}] ${metric} dropped by ${drop.toFixed(2)}pp (allowed ${maxAllowedDrop.toFixed(2)}pp)`,
        },
      ];
    });
  });
}
