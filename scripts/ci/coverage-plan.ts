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
