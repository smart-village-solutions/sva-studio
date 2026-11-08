import { execFileSync } from 'node:child_process';
import { readJson } from './coverage-policy.ts';
import type { CoveragePartitionEvidence } from './coverage-shard-evidence.ts';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { validateCoverageShardEvidence } from './coverage-shard-evidence.ts';

const findFiles = (directory: string, fileName: string): string[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(entryPath, fileName));
    } else if (entry.name === fileName) {
      files.push(entryPath);
    }
    if (files.length > 1) return files;
  }
  return files;
};

export const validateDownloadedCoverage = (rootDir: string, headSha: string): void => {
  const [feedbackPath, duplicate] = findFiles(rootDir, 'coverage-coverage-complete.json');
  if (!feedbackPath) {
    throw new Error('Coverage-Gesamtevidenz fehlt.');
  }
  if (duplicate) {
    throw new Error('Coverage-Gesamtevidenz ist mehrfach vorhanden.');
  }
  const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf8')) as CiFeedbackEvidence;
  if (feedback.schemaVersion !== 2 || feedback.headSha !== headSha || !feedback.plan) {
    throw new Error('Coverage-Gesamtevidenz ist ungültig oder veraltet.');
  }
  const expectedProjects = [...feedback.plan.directProjects, ...feedback.plan.remainingProjects];
  validateCoverageShardEvidence({
    rootDir,
    evidenceDirectory: path.join(rootDir, 'artifacts', 'ci-feedback', 'coverage-shards'),
    headSha,
    expectedProjects,
  });
};

interface VitestJsonResult {
  success: boolean;
  numFailedTests: number;
  numFailedTestSuites: number;
  testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
}

export const validateCoverageTestResults = (
  results: readonly VitestJsonResult[],
  expectedFiles: readonly string[],
  rootDir = process.cwd()
): void => {
  const actual = results.flatMap((result) => {
    if (!result.success || result.numFailedTests !== 0 || result.numFailedTestSuites !== 0)
      throw new Error('Coverage-Testlauf ist fehlgeschlagen.');
    return result.testResults.map((file) => path.relative(rootDir, file.name));
  });
  if (new Set(actual).size !== actual.length) throw new Error('Doppelte Coverage-Testdatei.');
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...expectedFiles].sort()))
    throw new Error('Coverage-Testmenge ist unvollständig oder fremd.');
};

export const mergeProjectCoverage = (
  project: string,
  entries: readonly CoveragePartitionEvidence[],
  directory: string,
  rootDir: string
): void => {
  const projectRoot = entries[0].plan.projectRoots.find(({ name }) => name === project)?.root;
  if (!projectRoot) throw new Error(`Projektroot fehlt: ${project}`);
  const reportEntries = entries.flatMap((entry) =>
    entry.reports
      .filter((report) => report.project === project)
      .map((report) => ({ ...report, partition: entry.partition }))
  );
  const blobs = reportEntries.filter((report) => report.kind === 'blob');
  const coverageDir = path.join(rootDir, projectRoot, 'coverage');
  fs.mkdirSync(coverageDir, { recursive: true });
  if (blobs.length === 0) {
    for (const report of reportEntries)
      fs.copyFileSync(
        path.join(directory, `coverage-partition-${report.partition}`, report.path),
        path.join(coverageDir, path.basename(report.path))
      );
    return;
  }
  const inputDir = path.join(rootDir, 'artifacts', 'coverage-merge-inputs', project);
  fs.rmSync(inputDir, { recursive: true, force: true });
  fs.mkdirSync(inputDir, { recursive: true });
  for (const blob of blobs)
    fs.copyFileSync(
      path.join(directory, `coverage-partition-${blob.partition}`, blob.path),
      path.join(inputDir, path.basename(blob.path))
    );
  const cwd = path.join(rootDir, projectRoot);
  const config = project === 'sva-studio-react' ? 'vitest.coverage.config.ts' : 'vitest.config.ts';
  const filters = project === 'sva-studio-react' ? [] : ['tests'];
  // Nx must build the configuration's runtime package imports on a fresh runner.
  execFileSync(
    'pnpm',
    [
      'nx',
      'run',
      `${project}:test:coverage`,
      `--mergeReports=${inputDir}`,
      '--reporter=json',
      '--outputFile.json=coverage/test-results.json',
    ],
    { cwd: rootDir, stdio: 'inherit' }
  );
  const discovered = JSON.parse(
    execFileSync(
      'pnpm',
      ['exec', 'vitest', 'list', ...filters, '--config', config, '--filesOnly', '--json'],
      { cwd, encoding: 'utf8' }
    )
  ) as { file: string }[];
  const results = reportEntries
    .filter((report) => report.kind === 'tests')
    .map((report) =>
      readJson<VitestJsonResult>(
        path.join(directory, `coverage-partition-${report.partition}`, report.path)
      )
    );
  validateCoverageTestResults(
    results,
    discovered.map(({ file }) => path.relative(rootDir, file)),
    rootDir
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [rootDir, headSha] = process.argv.slice(2);
  if (!rootDir || !headSha) {
    console.error('usage: validate-downloaded-coverage.ts <root-dir> <head-sha>');
    process.exit(2);
  }
  try {
    validateDownloadedCoverage(rootDir, headSha);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
