import { execFileSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface DurationEntry {
  label: string;
  durationMs: number;
}

interface AffectedCoverageGateOptions {
  base: string;
  head: string;
}

const APP_PROJECT = 'sva-studio-react';
const APP_VITEST_CONFIG = 'apps/sva-studio-react/vitest.config.ts';
const require = createRequire(import.meta.url);

const parseCliOptions = (args: readonly string[]): AffectedCoverageGateOptions => {
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

const getAffectedCoverageProjects = (base: string, head: string): string[] => {
  const nxPackageJson = require.resolve('nx/package.json');
  const nxEntrypoint = path.join(path.dirname(nxPackageJson), 'dist', 'bin', 'nx.js');
  const output = execFileSync(
    process.execPath,
    [nxEntrypoint, 'show', 'projects', '--affected', '--withTarget=test:coverage', '--base', base, '--head', head, '--json'],
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

export const buildAppCoverageCommand = (): string =>
  `pnpm exec vitest run --config ${APP_VITEST_CONFIG} --coverage --reporter=verbose`;

export const runAffectedCoverageGate = (
  options: AffectedCoverageGateOptions,
  reportDuration?: (entry: DurationEntry) => void
): DurationEntry[] => {
  const affectedProjects = getAffectedCoverageProjects(options.base, options.head);
  const durationEntries: DurationEntry[] = [];
  const nonAppProjects = affectedProjects.filter((project) => project !== APP_PROJECT);
  const appAffected = affectedProjects.includes(APP_PROJECT);

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
        affectedProjects,
        appAffected,
      },
      null,
      2
    )
  );

  if (affectedProjects.length === 0) {
    console.log('Keine betroffenen Coverage-Projekte erkannt.');
    return durationEntries;
  }

  if (nonAppProjects.length > 0) {
    recordDuration(
      'coverage:affected-workspace',
      runCommand(
        `env -u NO_COLOR pnpm nx affected --target=test:coverage --base=${options.base} --head=${options.head} --parallel=1 --exclude=${APP_PROJECT} --output-style=stream`
      )
    );
  }

  if (appAffected) {
    recordDuration('coverage:app', runCommand(buildAppCoverageCommand()));
  }

  return durationEntries;
};

const formatDuration = (durationMs: number): string => `${(durationMs / 1000).toFixed(2)}s`;

export const runAffectedCoverageGateCli = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const durationEntries = runAffectedCoverageGate(options);

  if (durationEntries.length > 0) {
    console.log('\nAffected coverage summary:');
    for (const entry of durationEntries) {
      console.log(`- ${entry.label}: ${formatDuration(entry.durationMs)}`);
    }
  }

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runAffectedCoverageGateCli(process.argv.slice(2)));
}
