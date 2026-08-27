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

const gitDeletedPaths = (rootDir: string): ReadonlySet<string> =>
  new Set(
    splitNullTerminated(
      execFileSync('git', ['ls-files', '-z', '--deleted'], {
        cwd: rootDir,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      })
    )
  );

const manifestLines = (content: string): string[] => content.replace(/\n$/u, '').split('\n');

const isValidManifestEntry = (entry: string): boolean =>
  entry !== '' && entry === entry.trim() && !entry.startsWith('#');

export const loadDocumentationIntegrityInput = (
  rootDir = process.cwd()
): DocumentationIntegrityInput => {
  const manifestEntries = manifestLines(readFileSync(path.join(rootDir, MANIFEST_PATH), 'utf8'));
  const validManifestEntries = manifestEntries.filter(isValidManifestEntry);
  const deletedPaths = gitDeletedPaths(rootDir);
  const trackedPaths = new Set(
    gitTrackedPaths(rootDir).filter((repositoryPath) => !deletedPaths.has(repositoryPath))
  );
  const publishedPaths = new Set(
    gitTrackedPaths(rootDir, validManifestEntries).filter(
      (repositoryPath) => !deletedPaths.has(repositoryPath)
    )
  );
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
    validateWikiNavigation: true,
    wikiWorkflow: readFileSync(path.join(rootDir, WIKI_WORKFLOW_PATH), 'utf8'),
  };
};

export const formatDocumentationIssue = (issue: DocumentationIssue): string =>
  `${issue.path}:${issue.line}: ${issue.reason}`;

export const runDocumentationCheck = (rootDir = process.cwd()): number => {
  const issues = checkDocumentationIntegrity(loadDocumentationIntegrityInput(rootDir));
  if (issues.length === 0) {
    console.log(
      'Dokumentationsprüfung erfolgreich: Links, Indizes und gerenderte Wiki-Publikation sind konsistent.'
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
