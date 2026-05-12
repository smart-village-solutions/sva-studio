import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export type GateMode = 'skip' | 'affected' | 'full';

export interface PrScopeDecision {
  changedFiles: string[];
  codeRelevant: boolean;
  qualityGateMode: GateMode;
  coverageMode: GateMode;
  integrationMode: GateMode;
  e2eMode: GateMode;
  appBuildMode: GateMode;
  escalationReasons: string[];
}

interface PrScopeCliOptions {
  base: string;
  head: string;
  githubOutput: boolean;
  json: boolean;
}

const nonCodeRelevantPatterns = [
  /^docs\//u,
  /^.+\.md$/u,
  /^\.github\/agents\//u,
  /^\.github\/prompts\//u,
  /^\.github\/ISSUE_TEMPLATE\//u,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/u,
];

const qualityEscalationPatterns = [
  /^pnpm-lock\.yaml$/u,
  /^nx\.json$/u,
  /^tsconfig\.base\.json$/u,
  /^eslint\.config\.mjs$/u,
  /^vitest\.config\.ts$/u,
  /^vitest\.workspace\.ts$/u,
  /^package\.json$/u,
  /^\.github\/workflows\//u,
  /^scripts\/ci\//u,
];

const integrationRelevantPatterns = [
  /^apps\/sva-studio-react\//u,
  /^packages\/(?:auth-runtime|core|data|data-repositories|instance-registry|routing|server-runtime|sva-mainserver)\//u,
];

const integrationEscalationPatterns = [
  /^apps\/sva-studio-react\/(?:package\.json|playwright\.config\.ts|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^packages\/(?:auth-runtime|core|data|data-repositories|instance-registry|routing|server-runtime|sva-mainserver)\/(?:package\.json|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\/(?:app-e2e|runtime-gates|quality-gates)\.yml$/u,
];

const e2eRelevantPatterns = [
  /^apps\/sva-studio-react\//u,
  /^packages\/(?:auth-runtime|routing|server-runtime|sva-mainserver|studio-ui-react)\//u,
];

const e2eEscalationPatterns = [
  /^apps\/sva-studio-react\/playwright\.config\.ts$/u,
  /^apps\/sva-studio-react\/package\.json$/u,
  /^packages\/(?:auth-runtime|routing|server-runtime|sva-mainserver|studio-ui-react)\/(?:package\.json|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\/app-e2e\.yml$/u,
];

const appBuildRelevantPatterns = [
  /^apps\/sva-studio-react\//u,
  /^packages\/(?:routing|studio-ui-react)\//u,
];

const appBuildEscalationPatterns = [
  /^package\.json$/u,
  /^pnpm-lock\.yaml$/u,
  /^nx\.json$/u,
  /^tsconfig\.base\.json$/u,
  /^vitest\.config\.ts$/u,
  /^vitest\.workspace\.ts$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\//u,
];

const matchesAnyPattern = (filePath: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(filePath));

export const isNonCodeRelevantPath = (filePath: string): boolean =>
  matchesAnyPattern(filePath, nonCodeRelevantPatterns);

export const classifyPrScope = (changedFiles: readonly string[]): PrScopeDecision => {
  const normalizedFiles = [...new Set(changedFiles.map((file) => file.trim()).filter(Boolean))].sort();
  const codeRelevantFiles = normalizedFiles.filter((file) => !isNonCodeRelevantPath(file));
  const escalationReasons = codeRelevantFiles.filter((file) =>
    matchesAnyPattern(file, qualityEscalationPatterns)
  );

  if (codeRelevantFiles.length === 0) {
    return {
      changedFiles: normalizedFiles,
      codeRelevant: false,
      qualityGateMode: 'skip',
      coverageMode: 'skip',
      integrationMode: 'skip',
      e2eMode: 'skip',
      appBuildMode: 'skip',
      escalationReasons: [],
    };
  }

  const qualityGateMode: GateMode = escalationReasons.length > 0 ? 'full' : 'affected';
  const coverageMode: GateMode = escalationReasons.length > 0 ? 'full' : 'affected';
  const integrationMode: GateMode = codeRelevantFiles.some((file) =>
    matchesAnyPattern(file, integrationEscalationPatterns)
  )
    ? 'full'
    : codeRelevantFiles.some((file) => matchesAnyPattern(file, integrationRelevantPatterns))
      ? 'affected'
      : 'skip';
  const e2eMode: GateMode = codeRelevantFiles.some((file) => matchesAnyPattern(file, e2eEscalationPatterns))
    ? 'full'
    : codeRelevantFiles.some((file) => matchesAnyPattern(file, e2eRelevantPatterns))
      ? 'affected'
      : 'skip';
  const appBuildMode: GateMode = codeRelevantFiles.some((file) =>
    matchesAnyPattern(file, appBuildEscalationPatterns)
  )
    ? 'full'
    : codeRelevantFiles.some((file) => matchesAnyPattern(file, appBuildRelevantPatterns))
      ? 'affected'
      : 'skip';

  return {
    changedFiles: normalizedFiles,
    codeRelevant: true,
    qualityGateMode,
    coverageMode,
    integrationMode,
    e2eMode,
    appBuildMode,
    escalationReasons,
  };
};

export const resolveChangedFiles = (
  base: string,
  head = 'HEAD',
  runGitCommand: (
    args: readonly string[],
    options?: { encoding: BufferEncoding }
  ) => string = (args, options) =>
    execFileSync('git', [...args], { encoding: options?.encoding ?? 'utf8' }).trim()
): string[] => {
  let output = '';

  try {
    output = runGitCommand(['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`], {
      encoding: 'utf8',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('no merge base')) {
      throw error;
    }

    output = runGitCommand(['diff', '--name-only', '--diff-filter=ACMR', `${base}..${head}`], {
      encoding: 'utf8',
    });
  }

  if (output.length === 0) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const parseCliOptions = (args: readonly string[]): PrScopeCliOptions => {
  let base = 'origin/main';
  let head = 'HEAD';
  let githubOutput = false;
  let json = false;

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
      continue;
    }

    if (argument === '--github-output') {
      githubOutput = true;
      continue;
    }

    if (argument === '--json') {
      json = true;
      continue;
    }
  }

  return { base, head, githubOutput, json };
};

const appendGithubOutput = (decision: PrScopeDecision, base: string, head: string): void => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT ist nicht gesetzt.');
  }

  const lines = [
    `base=${base}`,
    `head=${head}`,
    `code_relevant=${decision.codeRelevant ? 'true' : 'false'}`,
    `quality_gate_mode=${decision.qualityGateMode}`,
    `coverage_mode=${decision.coverageMode}`,
    `integration_mode=${decision.integrationMode}`,
    `e2e_mode=${decision.e2eMode}`,
    `app_build_mode=${decision.appBuildMode}`,
    `escalation_reasons=${decision.escalationReasons.join(',')}`,
  ];

  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
};

export const runPrScopeCli = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const decision = classifyPrScope(changedFiles);

  if (options.githubOutput) {
    appendGithubOutput(decision, options.base, options.head);
  }

  if (options.json || !options.githubOutput) {
    console.log(
      JSON.stringify(
        {
          ...decision,
          base: options.base,
          head: options.head,
        },
        null,
        2
      )
    );
  }

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPrScopeCli(process.argv.slice(2)));
}
