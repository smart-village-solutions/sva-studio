import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  checkDocumentationIntegrity,
  type DocumentationIntegrityInput,
  type DocumentationIssue,
} from './documentation-integrity';

const MANIFEST_PATH = 'config/documentation/wiki-publication-paths.txt';
const WIKI_WORKFLOW_PATH = '.github/workflows/wiki-sync.yml';

const splitNullTerminated = (value: string): string[] => value.split('\0').filter(Boolean);

const gitTrackedPaths = (rootDir: string, pathspecs: readonly string[] = []): string[] =>
  splitNullTerminated(
    execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...pathspecs],
      {
        cwd: rootDir,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      }
    )
  );

export const loadDocumentationIntegrityInput = (
  rootDir = process.cwd()
): DocumentationIntegrityInput => {
  const manifestEntries = readFileSync(path.join(rootDir, MANIFEST_PATH), 'utf8')
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '' && !entry.startsWith('#'));
  const trackedPaths = new Set(gitTrackedPaths(rootDir));
  const publishedPaths = new Set(gitTrackedPaths(rootDir, manifestEntries));
  const files = new Map<string, string>();

  for (const repositoryPath of publishedPaths) {
    if (repositoryPath.endsWith('.md')) {
      files.set(repositoryPath, readFileSync(path.join(rootDir, repositoryPath), 'utf8'));
    }
  }

  return {
    files,
    manifestEntries,
    publishedPaths,
    trackedPaths,
    wikiWorkflow: readFileSync(path.join(rootDir, WIKI_WORKFLOW_PATH), 'utf8'),
  };
};

export const formatDocumentationIssue = (issue: DocumentationIssue): string =>
  `${issue.path}:${issue.line}: ${issue.reason}`;

export const runDocumentationCheck = (rootDir = process.cwd()): number => {
  const issues = checkDocumentationIntegrity(loadDocumentationIntegrityInput(rootDir));
  if (issues.length === 0) {
    console.log(
      'Dokumentationsprüfung erfolgreich: Links, Indizes und Publikationsgrenzen sind konsistent.'
    );
    return 0;
  }

  for (const issue of issues) {
    console.error(formatDocumentationIssue(issue));
  }
  console.error(`\nDokumentationsprüfung fehlgeschlagen (${issues.length} Befunde).`);
  return 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runDocumentationCheck());
}
