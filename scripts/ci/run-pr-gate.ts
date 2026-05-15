import { execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { classifyPrScope, resolveChangedFiles, type GateMode } from './pr-scope.ts';
import { runAffectedUnitGate, type DurationEntry } from './affected-unit-gate.ts';

interface RunPrGateOptions {
  base: string;
  head: string;
}

const parseCliOptions = (args: readonly string[]): RunPrGateOptions => {
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
    stdio: 'inherit',
    env: process.env,
  });
  return performance.now() - startedAt;
};

const runAffectedCommand = (base: string, command: string): number => {
  return runCommand(`NX_BASE=${base} ${command}`);
};

const recordDuration = (durations: DurationEntry[], label: string, durationMs: number): void => {
  durations.push({ label, durationMs });
};

const runQualityGates = (base: string, head: string, mode: GateMode, durations: DurationEntry[]): void => {
  if (mode === 'full') {
    recordDuration(durations, 'lint', runCommand('pnpm test:eslint'));
    recordDuration(durations, 'unit', runCommand('pnpm test:unit'));
    recordDuration(durations, 'types', runCommand('pnpm test:types'));
    return;
  }

  if (mode === 'affected') {
    recordDuration(durations, 'lint:affected', runAffectedCommand(base, 'pnpm test:eslint:affected'));
    for (const entry of runAffectedUnitGate({ base, head })) {
      recordDuration(durations, entry.label, entry.durationMs);
    }
    recordDuration(durations, 'types:affected', runAffectedCommand(base, 'pnpm test:types:affected'));
  }
};

const runCoverageGate = (base: string, mode: GateMode, durations: DurationEntry[]): void => {
  if (mode === 'full') {
    recordDuration(durations, 'coverage', runCommand('pnpm test:coverage'));
  } else if (mode === 'affected') {
    recordDuration(durations, 'coverage:affected', runAffectedCommand(base, 'pnpm test:coverage:affected'));
  }

  recordDuration(durations, 'patch-coverage', runCommand(`pnpm patch-coverage-gate --base=${base}`));
  recordDuration(durations, 'sonar-new-code', runCommand(`pnpm sonar-new-code-gate --base=${base}`));
  recordDuration(durations, 'coverage-gate', runCommand('env COVERAGE_GATE_REQUIRE_SUMMARIES=0 pnpm coverage-gate'));
  recordDuration(durations, 'complexity', runCommand('pnpm complexity-gate'));
};

const runIntegrationGate = (base: string, mode: GateMode, durations: DurationEntry[]): void => {
  if (mode === 'full') {
    recordDuration(durations, 'integration', runCommand('pnpm test:integration'));
    return;
  }

  if (mode === 'affected') {
    recordDuration(
      durations,
      'integration:affected',
      runCommand(
        `env -u NO_COLOR pnpm nx affected --target=test:integration --base=${base} --exclude=monitoring-client --output-style=stream`
      )
    );
  }
};

const runOpsGate = (durations: DurationEntry[]): void => {
  recordDuration(durations, 'ops:critical', runCommand('pnpm test:ops:critical'));
};

const runAppBuildGate = (mode: GateMode, durations: DurationEntry[]): void => {
  if (mode !== 'skip') {
    recordDuration(durations, 'app-build', runCommand('pnpm nx run sva-studio-react:build'));
  }
};

const runE2EGate = (mode: GateMode, durations: DurationEntry[]): void => {
  if (mode !== 'skip') {
    recordDuration(durations, 'app-e2e', runCommand('pnpm test:e2e'));
  }
};

export const formatDurationSummary = (durations: readonly DurationEntry[]): string =>
  durations.map((entry) => `- ${entry.label}: ${(entry.durationMs / 1000).toFixed(2)}s`).join('\n');

export const runPrGate = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const decision = classifyPrScope(changedFiles);
  const durations: DurationEntry[] = [];

  console.log(
    JSON.stringify(
      {
        base: options.base,
        head: options.head,
        changedFiles,
        decision,
      },
      null,
      2
    )
  );

  recordDuration(durations, 'file-placement', runCommand('pnpm check:file-placement'));

  if (!decision.codeRelevant) {
    console.log('Keine code-relevanten Änderungen im PR-Scope. Weitere PR-Gates werden als No-op übersprungen.');
    console.log('\nPR gate summary:');
    console.log(formatDurationSummary(durations));
    return 0;
  }

  recordDuration(durations, 'toolchain-consistency', runCommand('pnpm check:toolchain-consistency'));
  recordDuration(durations, 'clean-generated-source-artifacts', runCommand('pnpm clean:generated-source-artifacts'));
  recordDuration(durations, 'plugin-ui-boundary', runCommand('pnpm check:plugin-ui-boundary'));

  runQualityGates(options.base, options.head, decision.qualityGateMode, durations);
  runCoverageGate(options.base, decision.coverageMode, durations);
  runIntegrationGate(options.base, decision.integrationMode, durations);
  runOpsGate(durations);
  runAppBuildGate(decision.appBuildMode, durations);
  runE2EGate(decision.e2eMode, durations);

  console.log('\nPR gate summary:');
  console.log(formatDurationSummary(durations));

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPrGate(process.argv.slice(2)));
}
