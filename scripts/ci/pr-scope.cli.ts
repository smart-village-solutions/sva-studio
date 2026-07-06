import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { classifyPrScope, resolveChangedFiles, type PrScopeDecision } from './pr-scope.ts';

interface PrScopeCliOptions {
  base: string;
  head: string;
  githubOutput: boolean;
  json: boolean;
}

const parseCliOptions = (args: readonly string[]): PrScopeCliOptions => {
  let base = 'origin/main';
  let head = 'HEAD';
  let githubOutput = false;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--base' || argument === '--head') {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Fehlender Wert für ${argument}`);
      }
      if (argument === '--base') {
        base = value;
      } else {
        head = value;
      }
      index += 1;
      continue;
    }

    if (argument === '--github-output') {
      githubOutput = true;
      continue;
    }

    if (argument === '--json') {
      json = true;
    }
  }

  return { base, head, githubOutput, json };
};

const createGithubOutputLines = (decision: PrScopeDecision, base: string, head: string): string[] => [
  `base=${base}`,
  `head=${head}`,
  `code_relevant=${decision.codeRelevant ? 'true' : 'false'}`,
  `quality_gate_mode=${decision.qualityGateMode}`,
  `coverage_mode=${decision.coverageMode}`,
  `coverage_regression_projects=${decision.coverageRegressionProjects.join(',')}`,
  `integration_mode=${decision.integrationMode}`,
  `e2e_mode=${decision.e2eMode}`,
  `a11y_mode=${decision.a11yMode}`,
  `runtime_verify_mode=${decision.runtimeVerifyMode}`,
  `app_build_mode=${decision.appBuildMode}`,
  `escalation_reasons=${decision.escalationReasons.join(',')}`,
];

const appendGithubOutput = (decision: PrScopeDecision, base: string, head: string): void => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT ist nicht gesetzt.');
  }

  fs.appendFileSync(outputPath, `${createGithubOutputLines(decision, base, head).join('\n')}\n`, 'utf8');
};

export const runPrScopeCli = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const decision = classifyPrScope(changedFiles);

  if (options.githubOutput) {
    appendGithubOutput(decision, options.base, options.head);
  }

  if (options.json || !options.githubOutput) {
    console.log(JSON.stringify({ ...decision, base: options.base, head: options.head }, null, 2));
  }

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPrScopeCli(process.argv.slice(2)));
}
