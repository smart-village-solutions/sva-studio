import { execFileSync } from 'node:child_process';

export type GateMode = 'skip' | 'affected' | 'full';

export interface PrScopeDecision {
  changedFiles: string[];
  codeRelevant: boolean;
  qualityGateMode: GateMode;
  coverageMode: GateMode;
  integrationMode: GateMode;
  e2eMode: GateMode;
  a11yMode: GateMode;
  runtimeVerifyMode: GateMode;
  appBuildMode: GateMode;
  escalationReasons: string[];
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
];

const coverageFullEscalationPatterns = [
  ...qualityEscalationPatterns,
  /^package\.json$/u,
  /^\.github\/workflows\/(?:runtime-gates|quality-gates)\.yml$/u,
];

const coverageAffectedPatterns = [
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

const pluginUiBuildRelevantPatterns = [
  /^packages\/plugin-news\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-events\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-faq\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-poi\/src\/.*\.(?:ts|tsx)$/u,
  /^packages\/plugin-waste-management\/src\/.*\.(?:ts|tsx)$/u,
];

const pluginUiA11yRelevantPatterns = [
  /^packages\/plugin-news\/src\/.*\.tsx$/u,
  /^packages\/plugin-events\/src\/.*\.tsx$/u,
  /^packages\/plugin-faq\/src\/.*\.tsx$/u,
  /^packages\/plugin-poi\/src\/.*\.tsx$/u,
  /^packages\/plugin-waste-management\/src\/.*\.tsx$/u,
];

const pluginUiE2eRelevantPatterns = [
  /^packages\/plugin-news\/src\/(?!index\.ts$|plugin\.translations(?:\.|$)).*\.(?:ts|tsx)$/u,
  /^packages\/plugin-events\/src\/(?!index\.ts$|plugin\.translations(?:\.|$)).*\.(?:ts|tsx)$/u,
  /^packages\/plugin-faq\/src\/(?!index\.ts$).*\.(?:ts|tsx)$/u,
  /^packages\/plugin-poi\/src\/(?!index\.ts$|plugin\.translations(?:\.|$)).*\.(?:ts|tsx)$/u,
  /^packages\/plugin-waste-management\/src\/(?!index\.ts$|plugin\.translations(?:\.|$)).*\.(?:ts|tsx)$/u,
];

const e2eRelevantPatterns = [
  /^apps\/sva-studio-react\//u,
  /^packages\/(?:auth-runtime|routing|server-runtime|sva-mainserver|studio-ui-react)\//u,
  ...pluginUiE2eRelevantPatterns,
];

const e2eEscalationPatterns = [
  /^apps\/sva-studio-react\/playwright\.config\.ts$/u,
  /^apps\/sva-studio-react\/package\.json$/u,
  /^packages\/(?:auth-runtime|routing|server-runtime|sva-mainserver|studio-ui-react)\/(?:package\.json|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\/app-e2e\.yml$/u,
];

const a11yRelevantPatterns = [
  /^apps\/sva-studio-react\/src\/(?:components|routes|providers)\//u,
  /^packages\/routing\//u,
  /^packages\/studio-ui-react\/src\/.*\.(?:ts|tsx)$/u,
  ...pluginUiA11yRelevantPatterns,
];

const a11yEscalationPatterns = [
  /^apps\/sva-studio-react\/(?:package\.json|vitest\.a11y\.config\.ts|vitest\.config\.ts)$/u,
  /^packages\/studio-ui-react\/(?:package\.json|vite\.config\.ts|vitest\.config\.ts)$/u,
  /^scripts\/ci\//u,
  /^\.github\/workflows\/quality-gates\.yml$/u,
];

const runtimeVerifyRelevantPatterns = [
  /^apps\/sva-studio-react\/src\/server\.ts$/u,
  /^apps\/sva-studio-react\/src\/lib\/.+\.server\.ts$/u,
  /^apps\/sva-studio-react\/package\.json$/u,
  /^apps\/sva-studio-react\/vite\.config\.ts$/u,
];

const runtimeVerifyEscalationPatterns = [
  /^scripts\/ci\/verify-runtime-artifact\.sh$/u,
  /^\.github\/workflows\/main-build\.yml$/u,
];

const appBuildRelevantPatterns = [
  /^apps\/sva-studio-react\//u,
  /^packages\/(?:routing|studio-ui-react)\//u,
  ...pluginUiBuildRelevantPatterns,
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
      a11yMode: 'skip',
      runtimeVerifyMode: 'skip',
      appBuildMode: 'skip',
      escalationReasons: [],
    };
  }

  const qualityGateMode: GateMode = escalationReasons.length > 0 ? 'full' : 'affected';
  const coverageMode: GateMode = codeRelevantFiles.some((file) =>
    matchesAnyPattern(file, coverageFullEscalationPatterns)
  )
    ? 'full'
    : codeRelevantFiles.some((file) => matchesAnyPattern(file, coverageAffectedPatterns))
      ? 'affected'
      : 'skip';
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
  const a11yMode: GateMode = codeRelevantFiles.some((file) =>
    matchesAnyPattern(file, a11yEscalationPatterns)
  )
    ? 'full'
    : codeRelevantFiles.some((file) => matchesAnyPattern(file, a11yRelevantPatterns))
      ? 'affected'
      : 'skip';
  const runtimeVerifyMode: GateMode = codeRelevantFiles.some((file) =>
    matchesAnyPattern(file, runtimeVerifyEscalationPatterns)
  )
    ? 'full'
    : codeRelevantFiles.some((file) => matchesAnyPattern(file, runtimeVerifyRelevantPatterns))
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
    a11yMode,
    runtimeVerifyMode,
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
  const runDiff = (range: string): string =>
    runGitCommand(['diff', '--name-only', '--diff-filter=ACDMR', range], {
      encoding: 'utf8',
    });

  let output = '';

  try {
    output = runDiff(`${base}...${head}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('no merge base')) {
      output = runDiff(`${base}..${head}`);
    } else {
      const baseRef = process.env.GITHUB_BASE_REF?.trim();
      const looksLikePromisorAuthIssue =
        message.includes('could not read Username') ||
        message.includes('promisor remote') ||
        message.includes('could not fetch');

      if (!looksLikePromisorAuthIssue || !baseRef) {
        throw error;
      }

      const fallbackBase = `origin/${baseRef}`;
      try {
        output = runDiff(`${fallbackBase}...${head}`);
      } catch {
        output = runDiff(`${fallbackBase}..${head}`);
      }
    }
  }

  if (output.length === 0) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};
