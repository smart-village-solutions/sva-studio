import { execSync } from 'node:child_process';

const allowedRootMarkdown = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'DEBUGGING.md',
  'DEVELOPMENT_RULES.md',
  'AGENTS.md',
  'SECURITY.md',
]);

const movedDebugScripts = new Set([
  'debug_test.py',
  'debug_test.ts',
  'test_session_loading.py',
  'test_session_loading.ts',
  'test-otel-phase1.ts',
  'test-otel-provider-creation.mjs',
  'test-otel-provider-creation.ts',
  'test-otlp-direct.ts',
]);

const legacyDocs = [
  /^docs\/STAGING-TODOS\.md$/,
  /^docs\/SECTION_7_VALIDATION_REPORT\.md$/,
  /^docs\/CURRENT_STATUS_2026-02-10\.md$/,
  /^docs\/DEBUG_SESSION_SUMMARY\.md$/,
  /^docs\/FIX-IMPLEMENTATION-PLAN\.md$/,
  /^docs\/IMPLEMENTATION-SUMMARY\.md$/,
  /^docs\/MILESTONE_1_PROGRESS\.md$/,
  /^docs\/BUILD-PROBLEM-ANALYSE\.md$/,
  /^docs\/PR-45-AGENT-REVIEW-COMPLETE\.md$/,
  /^docs\/pr-45-.*\.md$/,
  /^docs\/pr45-.*\.md$/,
];

export interface FilePlacementOptions {
  stagedOnly?: boolean;
}

export const getTrackedFiles = (
  options: FilePlacementOptions = {},
  runCommand: (command: string) => string = (command) =>
    execSync(command, { encoding: 'utf8' }).trim()
): string[] => {
  const command = options.stagedOnly
    ? 'git diff --cached --name-only --diff-filter=ACMR'
    : 'git ls-files';

  const output = runCommand(command);
  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const isInWrongDocsFolder = (filePath: string): boolean => {
  if (filePath.startsWith('docs/staging/')) {
    return !/^docs\/staging\/\d{4}-\d{2}\/.+/.test(filePath);
  }

  if (filePath.startsWith('docs/pr/')) {
    return !/^docs\/pr\/\d+\/.+/.test(filePath);
  }

  return false;
};

export const findFilePlacementViolations = (files: readonly string[]): string[] => {
  const violations: string[] = [];

  for (const file of files) {
    if (/^[^/]+\.md$/.test(file) && !allowedRootMarkdown.has(file)) {
      violations.push(`${file}: root-level markdown is not allowed`);
    }

    if (movedDebugScripts.has(file)) {
      violations.push(`${file}: move to scripts/debug/(auth|otel)/`);
    }

    if (/^(PR_CHECKLIST\.md|TEST-RESULTS\.md)$/.test(file)) {
      violations.push(`${file}: move to docs/reports/`);
    }

    if (legacyDocs.some((pattern) => pattern.test(file))) {
      violations.push(`${file}: move to docs/staging/YYYY-MM/ or docs/pr/<id>/`);
    }

    if (isInWrongDocsFolder(file)) {
      violations.push(
        `${file}: invalid docs folder naming (expected docs/staging/YYYY-MM/... or docs/pr/<number>/...)`
      );
    }
  }

  return violations;
};

export const runFilePlacementCheck = (
  args: readonly string[],
  runCommand?: (command: string) => string
): number => {
  const stagedOnly = args.includes('--staged');
  const files = getTrackedFiles({ stagedOnly }, runCommand);
  const violations = findFilePlacementViolations(files);

  if (violations.length > 0) {
    console.error('\nFile placement policy violations:\n');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error('\nRun: pnpm check:file-placement\n');
    return 1;
  }

  console.log(
    `File placement check passed (${files.length} files scanned${stagedOnly ? ', staged-only' : ''}).`
  );
  return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runFilePlacementCheck(process.argv.slice(2)));
}
