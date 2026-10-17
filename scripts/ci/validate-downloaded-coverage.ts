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
