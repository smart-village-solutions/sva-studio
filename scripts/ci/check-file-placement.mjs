#!/usr/bin/env node
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const stagedOnly = args.has('--staged');

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
  'test_session_loading.py',
  'test-otel-phase1.ts',
  'test-otel-provider-creation.mjs',
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

function getFiles() {
  const cmd = stagedOnly
    ? 'git diff --cached --name-only --diff-filter=ACMR'
    : 'git ls-files';

  const out = execSync(cmd, { encoding: 'utf8' }).trim();
  if (!out) return [];
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

function inWrongDocsFolder(path) {
  if (path.startsWith('docs/staging/')) {
    return !/^docs\/staging\/\d{4}-\d{2}\/.+/.test(path);
  }
  if (path.startsWith('docs/pr/')) {
    return !/^docs\/pr\/\d+\/.+/.test(path);
  }
  return false;
}

const files = getFiles();
const violations = [];

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

  if (inWrongDocsFolder(file)) {
    violations.push(`${file}: invalid docs folder naming (expected docs/staging/YYYY-MM/... or docs/pr/<number>/...)`);
  }
}

if (violations.length > 0) {
  console.error('\nFile placement policy violations:\n');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error('\nRun: pnpm check:file-placement\n');
  process.exit(1);
}

console.log(`File placement check passed (${files.length} files scanned${stagedOnly ? ', staged-only' : ''}).`);
