export interface ProjectRoot {
  name: string;
  root: string;
}

export interface ChangedProjectPlan {
  mode: 'changed-first' | 'affected-fallback';
  reason: string;
  directProjects: string[];
  remainingProjects: string[];
  unmappedFiles: string[];
}

type ProjectRootLoader = () => readonly ProjectRoot[];

const TOOLING_PROJECT = 'tooling-testing';
const TOOLING_PATH_PATTERNS = [
  /^\.github\/(?:actions|workflows)\//u,
  /^scripts\//u,
  /^(?:package\.json|tsconfig\.scripts\.json)$/u,
];
const NON_CODE_PATH_PATTERNS = [
  /^docs\//u,
  /^openspec\//u,
  /\.md$/u,
  /^\.github\/(?:agents|prompts|ISSUE_TEMPLATE)\//u,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/u,
];

const normalizePath = (filePath: string): string => filePath.replaceAll('\\', '/');

const isInsideRoot = (filePath: string, root: string): boolean =>
  filePath === root || filePath.startsWith(`${root}/`);

const compareRootsBySpecificity = (left: ProjectRoot, right: ProjectRoot): number =>
  right.root.length - left.root.length || left.name.localeCompare(right.name);

const mapFileToProject = (
  filePath: string,
  projects: readonly ProjectRoot[],
  affectedProjects: ReadonlySet<string>
): string | null => {
  const project = projects.find(
    (candidate) => affectedProjects.has(candidate.name) && isInsideRoot(filePath, candidate.root)
  );
  if (project) {
    return project.name;
  }

  if (
    affectedProjects.has(TOOLING_PROJECT) &&
    TOOLING_PATH_PATTERNS.some((pattern) => pattern.test(filePath))
  ) {
    return TOOLING_PROJECT;
  }

  return null;
};

export const planChangedProjects = (
  changedFiles: readonly string[],
  affectedProjectNames: readonly string[],
  projectRoots: readonly ProjectRoot[]
): ChangedProjectPlan => {
  const affectedProjects = [...new Set(affectedProjectNames)].sort();
  const affectedSet = new Set(affectedProjects);
  const sortedRoots = projectRoots
    .map((project) => ({ ...project, root: normalizePath(project.root).replace(/\/$/u, '') }))
    .filter((project) => project.root.length > 0)
    .sort(compareRootsBySpecificity);
  const directProjects = new Set<string>();
  const unmappedFiles: string[] = [];

  for (const rawFilePath of changedFiles) {
    const filePath = normalizePath(rawFilePath);
    if (NON_CODE_PATH_PATTERNS.some((pattern) => pattern.test(filePath))) {
      continue;
    }

    const projectName = mapFileToProject(filePath, sortedRoots, affectedSet);
    if (projectName) {
      directProjects.add(projectName);
    } else {
      unmappedFiles.push(filePath);
    }
  }

  const direct = [...directProjects].sort();
  const remaining = affectedProjects.filter((project) => !directProjects.has(project));
  const mode = direct.length > 0 ? 'changed-first' : 'affected-fallback';
  const reason =
    mode === 'changed-first'
      ? unmappedFiles.length > 0
        ? 'mapped-projects-first-with-conservative-remainder'
        : 'directly-changed-projects-first'
      : affectedProjects.length === 0
        ? 'no-affected-projects'
        : 'no-safe-direct-project-mapping';

  return {
    mode,
    reason,
    directProjects: direct,
    remainingProjects: remaining,
    unmappedFiles: unmappedFiles.sort(),
  };
};

export const planChangedProjectsWithFallback = (
  changedFiles: readonly string[],
  affectedProjectNames: readonly string[],
  loadProjectRoots: ProjectRootLoader
): ChangedProjectPlan => {
  try {
    return planChangedProjects(changedFiles, affectedProjectNames, loadProjectRoots());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Nx-Projektgraph konnte nicht geladen werden; verwende vollständigen affected-Fallback: ${message}`
    );

    return {
      mode: 'affected-fallback',
      reason: 'nx-project-graph-unavailable',
      directProjects: [],
      remainingProjects: [...new Set(affectedProjectNames)].sort(),
      unmappedFiles: [...new Set(changedFiles.map(normalizePath))].sort(),
    };
  }
};
