import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const allowedRootMarkdown = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'DEBUGGING.md',
  'DEVELOPMENT_RULES.md',
  'AGENTS.md',
  'CLAUDE.md',
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

const ignoredDirectories = new Set(['.git', '.nx', 'node_modules', 'dist', 'build', 'coverage']);

export const isGeneratedSourceArtifact = (filePath: string): boolean =>
  /^packages\/[^/]+\/src\/.+\.(?:js|d\.ts|d\.ts\.map)$/.test(filePath);

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

export const findGeneratedSourceArtifacts = (rootDir: string): string[] => {
  const packagesDir = path.join(rootDir, 'packages');
  const artifacts: string[] = [];
  if (!fs.existsSync(packagesDir)) {
    return artifacts;
  }

  const walkSourceTree = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          walkSourceTree(path.join(dir, entry.name));
        }
        continue;
      }

      const entryPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, entryPath).split(path.sep).join('/');
      if (isGeneratedSourceArtifact(relativePath)) {
        artifacts.push(relativePath);
      }
    }
  };

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) {
      continue;
    }

    const sourceDir = path.join(packagesDir, entry.name, 'src');
    if (fs.existsSync(sourceDir)) {
      walkSourceTree(sourceDir);
    }
  }

  artifacts.sort();
  return artifacts;
};

export const runFilePlacementCheck = (
  args: readonly string[],
  runCommand?: (command: string) => string
): number => {
  const stagedOnly = args.includes('--staged');
  const files = getTrackedFiles({ stagedOnly }, runCommand);
  const violations = findFilePlacementViolations(files);
  const generatedArtifacts = findGeneratedSourceArtifacts(process.cwd());

  for (const artifact of generatedArtifacts) {
    violations.push(`${artifact}: generated JS/type artifact must be removed from package source tree`);
  }

  if (violations.length > 0) {
    console.error('\nFile placement policy violations:\n');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error('\nRun: pnpm clean:generated-source-artifacts && pnpm check:file-placement\n');
    return 1;
  }

  console.log(
    `File placement check passed (${files.length} files scanned${stagedOnly ? ', staged-only' : ''}).`
  );
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runFilePlacementCheck(process.argv.slice(2)));
}
