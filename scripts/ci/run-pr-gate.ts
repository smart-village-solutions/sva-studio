import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { classifyPrScope, resolveChangedFiles, type GateMode } from './pr-scope.ts';

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

const runCommand = (command: string): void => {
  console.log(`\n$ ${command}`);
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
  });
};

const runAffectedCommand = (base: string, command: string): void => {
  runCommand(`NX_BASE=${base} ${command}`);
};

const runQualityGates = (base: string, mode: GateMode): void => {
  if (mode === 'full') {
    runCommand('pnpm test:eslint');
    runCommand('pnpm test:unit');
    runCommand('pnpm test:types');
    return;
  }

  if (mode === 'affected') {
    runAffectedCommand(base, 'pnpm test:eslint:affected');
    runAffectedCommand(base, 'pnpm test:unit:affected');
    runAffectedCommand(base, 'pnpm test:types:affected');
  }
};

const runCoverageGate = (base: string, mode: GateMode): void => {
  if (mode === 'full') {
    runCommand('pnpm test:coverage');
  } else if (mode === 'affected') {
    runAffectedCommand(base, 'pnpm test:coverage:affected');
  }

  runCommand(`pnpm patch-coverage-gate --base=${base}`);
  runCommand(`pnpm sonar-new-code-gate --base=${base}`);
  runCommand('env COVERAGE_GATE_REQUIRE_SUMMARIES=0 pnpm coverage-gate');
  runCommand('pnpm complexity-gate');
};

const runIntegrationGate = (base: string, mode: GateMode): void => {
  if (mode === 'full') {
    runCommand('pnpm test:integration');
    return;
  }

  if (mode === 'affected') {
    runCommand(
      `env -u NO_COLOR pnpm nx affected --target=test:integration --base=${base} --exclude=monitoring-client --output-style=stream`
    );
  }
};

const runAppBuildGate = (mode: GateMode): void => {
  if (mode !== 'skip') {
    runCommand('pnpm nx run sva-studio-react:build');
  }
};

const runE2EGate = (mode: GateMode): void => {
  if (mode !== 'skip') {
    runCommand('pnpm test:e2e');
  }
};

export const runPrGate = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const decision = classifyPrScope(changedFiles);

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

  runCommand('pnpm check:file-placement');

  if (!decision.codeRelevant) {
    console.log('Keine code-relevanten Änderungen im PR-Scope. Weitere PR-Gates werden als No-op übersprungen.');
    return 0;
  }

  runCommand('pnpm check:toolchain-consistency');
  runCommand('pnpm clean:generated-source-artifacts');
  runCommand('pnpm check:plugin-ui-boundary');

  runQualityGates(options.base, decision.qualityGateMode);
  runCoverageGate(options.base, decision.coverageMode);
  runIntegrationGate(options.base, decision.integrationMode);
  runAppBuildGate(decision.appBuildMode);
  runE2EGate(decision.e2eMode);

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPrGate(process.argv.slice(2)));
}
