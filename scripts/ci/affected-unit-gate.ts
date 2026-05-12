import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isNonCodeRelevantPath, resolveChangedFiles } from './pr-scope.ts';

export type AppUnitSlice = 'hooks' | 'routes' | 'server' | 'ui';

export interface DurationEntry {
  label: string;
  durationMs: number;
}

export interface AppUnitExecutionPlan {
  mode: 'aggregate' | 'skip' | 'slices';
  reason: string;
  slices: AppUnitSlice[];
}

interface AffectedUnitGateOptions {
  base: string;
  head: string;
}

const APP_PROJECT = 'sva-studio-react';
const require = createRequire(import.meta.url);

const APP_UI_PATTERNS = [/^apps\/sva-studio-react\/src\/(?:components|providers|i18n)\//u];
const APP_ROUTES_PATTERNS = [/^apps\/sva-studio-react\/src\/(?:routes|routing)\//u];
const APP_SERVER_PATTERNS = [
  /^apps\/sva-studio-react\/src\/server(?:\.test)?\.(?:ts|tsx)$/u,
  /^apps\/sva-studio-react\/src\/lib\/.*(?:\.server|-server)(?:\.test)?\.(?:ts|tsx)$/u,
];
const APP_HOOKS_PATTERNS = [
  /^apps\/sva-studio-react\/src\/hooks\//u,
];
const APP_AGGREGATE_PATTERNS = [
  /^apps\/sva-studio-react\/(?:package\.json|tsconfig\.json|vite\.config\.ts|vitest(?:\..+)?\.config\.ts|playwright\.config\.ts)$/u,
  /^apps\/sva-studio-react\/(?:e2e|scripts)\//u,
  /^apps\/sva-studio-react\/src\/lib\//u,
  /^apps\/sva-studio-react\/src\/(?:main|routeTreeGen|router)\.(?:ts|tsx)$/u,
];

const matchesAnyPattern = (filePath: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(filePath));

const parseCliOptions = (args: readonly string[]): AffectedUnitGateOptions => {
  let base = 'origin/main';
  let head = 'HEAD';

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--base') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --base');
      }
      base = value;
      index += 1;
      continue;
    }

    if (argument === '--head') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --head');
      }
      head = value;
      index += 1;
    }
  }

  return { base, head };
};

const runCommand = (command: string): number => {
  console.log(`\n$ ${command}`);
  const startedAt = performance.now();
  execSync(command, {
    env: process.env,
    stdio: 'inherit',
  });
  return performance.now() - startedAt;
};

const getAffectedUnitProjects = (base: string, head: string): string[] => {
  const nxPackageJson = require.resolve('nx/package.json');
  const nxEntrypoint = path.join(path.dirname(nxPackageJson), 'dist', 'bin', 'nx.js');
  const output = execFileSync(
    process.execPath,
    [nxEntrypoint, 'show', 'projects', '--affected', '--withTarget=test:unit', '--base', base, '--head', head, '--json'],
    {
      encoding: 'utf8',
      env: process.env,
    }
  ).trim();

  if (output.length === 0) {
    return [];
  }

  return JSON.parse(output) as string[];
};

const classifyAppUnitSlice = (filePath: string): AppUnitSlice | null => {
  if (matchesAnyPattern(filePath, APP_UI_PATTERNS)) {
    return 'ui';
  }
  if (matchesAnyPattern(filePath, APP_ROUTES_PATTERNS)) {
    return 'routes';
  }
  if (matchesAnyPattern(filePath, APP_SERVER_PATTERNS)) {
    return 'server';
  }
  if (matchesAnyPattern(filePath, APP_HOOKS_PATTERNS)) {
    return 'hooks';
  }
  return null;
};

export const planAppUnitExecution = (
  changedFiles: readonly string[],
  affectedProjects: readonly string[]
): AppUnitExecutionPlan => {
  if (!affectedProjects.includes(APP_PROJECT)) {
    return {
      mode: 'skip',
      reason: 'app-not-affected',
      slices: [],
    };
  }

  const codeRelevantFiles = changedFiles.filter((filePath) => !isNonCodeRelevantPath(filePath));
  const nonAppFiles = codeRelevantFiles.filter((filePath) => !filePath.startsWith('apps/sva-studio-react/'));

  if (nonAppFiles.length > 0) {
    return {
      mode: 'aggregate',
      reason: 'mixed-workspace-change',
      slices: [],
    };
  }

  const appFiles = codeRelevantFiles.filter((filePath) => filePath.startsWith('apps/sva-studio-react/'));
  if (appFiles.length === 0) {
    return {
      mode: 'aggregate',
      reason: 'app-affected-via-dependency',
      slices: [],
    };
  }

  const classifiedSlices = appFiles.map(classifyAppUnitSlice);
  const slices = [...new Set(classifiedSlices)].filter((slice): slice is AppUnitSlice => slice !== null);

  if (
    appFiles.some(
      (filePath, index) =>
        classifiedSlices[index] === null && matchesAnyPattern(filePath, APP_AGGREGATE_PATTERNS)
    )
  ) {
    return {
      mode: 'aggregate',
      reason: 'aggregate-app-file',
      slices: [],
    };
  }

  if (slices.length === 0 || classifiedSlices.some((slice) => slice === null)) {
    return {
      mode: 'aggregate',
      reason: 'unclear-app-slice',
      slices: [],
    };
  }

  return {
    mode: 'slices',
    reason: 'app-only-sliceable-change',
    slices: slices.sort(),
  };
};

export const runAffectedUnitGate = (
  options: AffectedUnitGateOptions,
  reportDuration?: (entry: DurationEntry) => void
): DurationEntry[] => {
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const affectedProjects = getAffectedUnitProjects(options.base, options.head);
  const durationEntries: DurationEntry[] = [];
  const appPlan = planAppUnitExecution(changedFiles, affectedProjects);
  const nonAppProjects = affectedProjects.filter((project) => project !== APP_PROJECT);

  const recordDuration = (label: string, durationMs: number): void => {
    const entry = { label, durationMs };
    durationEntries.push(entry);
    reportDuration?.(entry);
  };

  console.log(
    JSON.stringify(
      {
        base: options.base,
        head: options.head,
        changedFiles,
        affectedProjects,
        appPlan,
      },
      null,
      2
    )
  );

  if (affectedProjects.length === 0) {
    console.log('Keine betroffenen Unit-Projekte erkannt.');
    return durationEntries;
  }

  if (nonAppProjects.length > 0) {
    recordDuration(
      'unit:affected-workspace',
      runCommand(
        `env -u NO_COLOR pnpm nx affected --target=test:unit --base=${options.base} --head=${options.head} --parallel=1 --exclude=${APP_PROJECT} --output-style=stream`
      )
    );
  }

  if (appPlan.mode === 'skip') {
    return durationEntries;
  }

  if (appPlan.mode === 'aggregate') {
    recordDuration('unit:app', runCommand(`pnpm nx run ${APP_PROJECT}:test:unit`));
    return durationEntries;
  }

  for (const slice of appPlan.slices) {
    recordDuration(`unit:app:${slice}`, runCommand(`pnpm nx run ${APP_PROJECT}:test:unit:${slice}`));
  }

  return durationEntries;
};

const formatDuration = (durationMs: number): string => `${(durationMs / 1000).toFixed(2)}s`;

export const runAffectedUnitGateCli = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const durationEntries = runAffectedUnitGate(options);

  if (durationEntries.length > 0) {
    console.log('\nAffected unit summary:');
    for (const entry of durationEntries) {
      console.log(`- ${entry.label}: ${formatDuration(entry.durationMs)}`);
    }
  }

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runAffectedUnitGateCli(process.argv.slice(2)));
}
