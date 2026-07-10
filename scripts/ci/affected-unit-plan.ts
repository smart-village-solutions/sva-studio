import { isNonCodeRelevantPath } from './pr-scope.ts';

export type AppUnitSlice = 'hooks' | 'routes' | 'server' | 'ui';

export interface AppUnitExecutionPlan {
  mode: 'aggregate' | 'skip' | 'slices';
  reason: string;
  slices: AppUnitSlice[];
}

const APP_PROJECT = 'sva-studio-react';
const APP_VITEST_CONFIG = 'apps/sva-studio-react/vitest.config.ts';
const APP_UI_PATTERNS = [/^apps\/sva-studio-react\/src\/(?:components|providers|i18n)\//u];
const APP_ROUTES_PATTERNS = [/^apps\/sva-studio-react\/src\/(?:routes|routing)\//u];
const APP_SERVER_PATTERNS = [
  /^apps\/sva-studio-react\/src\/server(?:\.test)?\.(?:ts|tsx)$/u,
  /^apps\/sva-studio-react\/src\/lib\/.*(?:\.server|-server)(?:\.test)?\.(?:ts|tsx)$/u,
];
const APP_HOOKS_PATTERNS = [
  /^apps\/sva-studio-react\/src\/hooks\//u,
  /^apps\/sva-studio-react\/src\/lib\//u,
];
const APP_AGGREGATE_PATTERNS = [
  /^apps\/sva-studio-react\/(?:package\.json|tsconfig\.json|vite\.config\.ts|vitest(?:\..+)?\.config\.ts|playwright\.config\.ts)$/u,
  /^apps\/sva-studio-react\/(?:e2e|scripts)\//u,
  /^apps\/sva-studio-react\/src\/(?:main|routeTreeGen|router)\.(?:ts|tsx)$/u,
];
const APP_INFRA_ONLY_NON_APP_PATTERNS = [
  /^\.github\/(?:actions|workflows)\//u,
  /^compose(?:\.[^/]+)?\.ya?ml$/u,
  /^deploy\/compose\.(?:dev|staging|prod)\.yaml$/u,
  /^docs\//u,
  /^(?:Dockerfile|entrypoint\.sh|migrate-entrypoint\.sh|otel-bootstrap\.mjs|provisioner-entrypoint\.sh)$/u,
  /^scripts\/ci\//u,
];
const APP_SLICE_CONFIG_FILES: Record<AppUnitSlice, string> = {
  hooks: 'apps/sva-studio-react/vitest.hooks.config.ts',
  routes: 'apps/sva-studio-react/vitest.routes.config.ts',
  server: 'apps/sva-studio-react/vitest.server.config.ts',
  ui: 'apps/sva-studio-react/vitest.ui.config.ts',
};

const matchesAnyPattern = (filePath: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(filePath));

const classifyAppUnitSlice = (filePath: string): AppUnitSlice | null => {
  if (matchesAnyPattern(filePath, APP_UI_PATTERNS)) return 'ui';
  if (matchesAnyPattern(filePath, APP_ROUTES_PATTERNS)) return 'routes';
  if (matchesAnyPattern(filePath, APP_SERVER_PATTERNS)) return 'server';
  if (matchesAnyPattern(filePath, APP_HOOKS_PATTERNS)) return 'hooks';
  return null;
};

export const buildAppUnitCommand = (slice?: AppUnitSlice): string => {
  const configFile = slice ? APP_SLICE_CONFIG_FILES[slice] : APP_VITEST_CONFIG;
  return `pnpm exec vitest run --config ${configFile} --reporter=verbose`;
};

export const planAppUnitExecution = (
  changedFiles: readonly string[],
  affectedProjects: readonly string[]
): AppUnitExecutionPlan => {
  if (!affectedProjects.includes(APP_PROJECT)) {
    return { mode: 'skip', reason: 'app-not-affected', slices: [] };
  }

  const codeRelevantFiles = changedFiles.filter((filePath) => !isNonCodeRelevantPath(filePath));
  const nonAppFiles = codeRelevantFiles.filter(
    (filePath) => !filePath.startsWith('apps/sva-studio-react/')
  );
  if (nonAppFiles.length > 0) {
    return nonAppFiles.every((filePath) =>
      matchesAnyPattern(filePath, APP_INFRA_ONLY_NON_APP_PATTERNS)
    )
      ? { mode: 'skip', reason: 'non-app-infra-change', slices: [] }
      : { mode: 'aggregate', reason: 'mixed-workspace-change', slices: [] };
  }

  const appFiles = codeRelevantFiles.filter((filePath) =>
    filePath.startsWith('apps/sva-studio-react/')
  );
  if (appFiles.length === 0) {
    return { mode: 'aggregate', reason: 'app-affected-via-dependency', slices: [] };
  }

  const classifiedSlices = appFiles.map(classifyAppUnitSlice);
  const slices = [...new Set(classifiedSlices)].filter(
    (slice): slice is AppUnitSlice => slice !== null
  );
  const hasAggregateFile = appFiles.some(
    (filePath, index) =>
      classifiedSlices[index] === null && matchesAnyPattern(filePath, APP_AGGREGATE_PATTERNS)
  );
  if (hasAggregateFile) {
    return { mode: 'aggregate', reason: 'aggregate-app-file', slices: [] };
  }
  if (slices.length === 0 || classifiedSlices.some((slice) => slice === null)) {
    return { mode: 'aggregate', reason: 'unclear-app-slice', slices: [] };
  }
  return { mode: 'slices', reason: 'app-only-sliceable-change', slices: slices.sort() };
};
