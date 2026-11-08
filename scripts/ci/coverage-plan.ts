import path from 'node:path';
import { readJson, type CoveragePolicy } from './coverage-policy.ts';
import {
  loadNxProjectsWithTarget,
  loadNxProjectRoots,
  loadWorkspaceProjectRoots,
} from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';
import type { BaseHeadCliOptions } from './base-head-cli-options.ts';
import {
  planChangedProjectsWithFallback,
  type ChangedProjectPlan,
  type ProjectRoot,
} from './changed-project-plan.ts';

export interface ResolvedCoveragePlan {
  changedFiles: string[];
  affectedProjects: string[];
  changedProjectPlan: ChangedProjectPlan;
  projectRoots: ProjectRoot[];
}

interface CoveragePlanDependencies {
  resolveChangedFiles: (base: string, head: string) => string[];
  getCoverageProjects: (base: string, head: string, full: boolean) => string[];
  loadNxProjectRoots: () => ProjectRoot[];
  loadWorkspaceProjectRoots: () => ProjectRoot[];
}

export const resolveCoveragePlan = (
  options: BaseHeadCliOptions,
  full: boolean,
  fullProjects: string[],
  dependencies: CoveragePlanDependencies
): ResolvedCoveragePlan => {
  try {
    const changedFiles = dependencies.resolveChangedFiles(options.base, options.head);
    const affectedProjects = dependencies.getCoverageProjects(options.base, options.head, full);
    const projectRoots = dependencies.loadNxProjectRoots();
    return {
      changedFiles,
      affectedProjects,
      projectRoots,
      changedProjectPlan: planChangedProjectsWithFallback(
        changedFiles,
        affectedProjects,
        () => projectRoots,
        fullProjects
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Base-/Head-Scope ist ungültig; verwende vollständigen Coverage-Fallback: ${message}`
    );
    const projectRoots = dependencies.loadWorkspaceProjectRoots();
    const knownProjects = new Set(projectRoots.map((project) => project.name));
    const missingProjectRoots = fullProjects.filter((project) => !knownProjects.has(project));
    if (missingProjectRoots.length > 0) {
      throw new Error(
        `Coverage-Fallback kann Projektroots nicht auflösen: ${missingProjectRoots.join(', ')}`,
        { cause: error }
      );
    }

    return {
      changedFiles: [],
      affectedProjects: fullProjects,
      projectRoots,
      changedProjectPlan: {
        mode: 'full-fallback',
        reason: 'invalid-base-head-or-project-graph',
        directProjects: [],
        remainingProjects: fullProjects,
        unmappedFiles: [],
      },
    };
  }
};

export const coveragePartitions = [
  'app-1',
  'app-2',
  'app-3',
  'app-4',
  'waste-1',
  'waste-2',
  'direct-1',
  'direct-2',
  'direct-3',
  'direct-4',
  'remaining-1',
  'remaining-2',
  'remaining-3',
  'remaining-4',
] as const;
export type CoveragePartition = (typeof coveragePartitions)[number];

export const parseCoveragePartition = (value: string): CoveragePartition => {
  if (!coveragePartitions.includes(value as CoveragePartition))
    throw new Error(`Ungültige Coverage-Partition: ${value}`);
  return value as CoveragePartition;
};

export const selectCoveragePartition = (plan: ResolvedCoveragePlan, value: string): string[] => {
  const partition = parseCoveragePartition(value);
  if (partition.startsWith('app-'))
    return plan.affectedProjects.filter((project) => project === 'sva-studio-react');
  if (partition.startsWith('waste-'))
    return plan.affectedProjects.filter((project) => project === 'plugin-waste-management');
  const projects = partition.startsWith('direct-')
    ? plan.changedProjectPlan.directProjects
    : plan.changedProjectPlan.remainingProjects;
  return [...new Set(projects)]
    .filter((project) => project !== 'sva-studio-react' && project !== 'plugin-waste-management')
    .sort()
    .filter((_project, index) => index % 4 === Number(partition.slice(-1)) - 1);
};

/** Preserve the full fallback while prioritizing every changed project we can map. */
export const prioritizeChangedCoverageProjects = (
  plan: ResolvedCoveragePlan
): ResolvedCoveragePlan => {
  const mapped = plan.projectRoots
    .filter(({ root }) => plan.changedFiles.some((file) => file.startsWith(`${root}/`)))
    .map(({ name }) => name);
  const plannedProjects =
    plan.changedProjectPlan.mode === 'full-fallback'
      ? [...plan.changedProjectPlan.directProjects, ...plan.changedProjectPlan.remainingProjects]
      : plan.affectedProjects;
  const affectedProjects = [...new Set(plannedProjects)].sort();
  const directProjects = affectedProjects.filter((project) => mapped.includes(project));
  return {
    ...plan,
    affectedProjects,
    projectRoots: [...plan.projectRoots].sort((left, right) => left.name.localeCompare(right.name)),
    changedProjectPlan: {
      ...plan.changedProjectPlan,
      directProjects,
      remainingProjects: affectedProjects.filter((project) => !directProjects.includes(project)),
    },
  };
};

export const excludeCoverageExemptProjects = (
  projects: readonly string[],
  exemptProjects: readonly string[]
): string[] => {
  const exemptions = new Set(exemptProjects);
  return projects.filter((project) => !exemptions.has(project));
};

export const buildAppCoverageCommand = (): string => `pnpm nx run sva-studio-react:test:coverage`;

export const buildCoverageProjectCommand = (project: string): string =>
  `env -u NO_COLOR pnpm nx run ${project}:test:coverage --nxBail --output-style=stream`;

export const buildEarlyCoverageGateCommand = (projects: readonly string[]): string =>
  `COVERAGE_GATE_EVALUATE_REGRESSIONS=1 COVERAGE_GATE_PROJECT_FILTER=${projects.join(',')} pnpm coverage-gate`;

export const resolveCurrentCoveragePlan = (options: BaseHeadCliOptions): ResolvedCoveragePlan => {
  const full = process.env.NX_RUN_FULL === '1';
  const coveragePolicy = readJson<CoveragePolicy>(
    path.join(process.cwd(), 'tooling/testing/coverage-policy.json')
  );
  const getPolicyCoveredProjects = (base: string, head: string, runFull: boolean): string[] =>
    excludeCoverageExemptProjects(
      loadNxProjectsWithTarget('test:coverage', base, head, runFull),
      coveragePolicy.exemptProjects
    );
  const fullProjects = getPolicyCoveredProjects(options.base, options.head, true);
  return prioritizeChangedCoverageProjects(
    resolveCoveragePlan(options, full, fullProjects, {
      resolveChangedFiles,
      getCoverageProjects: getPolicyCoveredProjects,
      loadNxProjectRoots,
      loadWorkspaceProjectRoots,
    })
  );
};

export const buildCoveragePartitionCommand = (project: string, partition: string): string => {
  parseCoveragePartition(partition);
  const base =
    project === 'sva-studio-react'
      ? buildAppCoverageCommand()
      : buildCoverageProjectCommand(project);
  const heavy = partition.startsWith('app-') || partition.startsWith('waste-');
  const count = partition.startsWith('app-') ? 4 : 2;
  const shard = heavy
    ? ` --shard=${partition.slice(-1)}/${count} --reporter=blob --outputFile.blob=coverage/${partition}.blob.json --maxWorkers=1`
    : '';
  return `${base} --reporter=json --outputFile.json=coverage/test-results.json${shard}`;
};
