import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  compareStudioChangelogEntriesDescending,
  parseStudioChangelogEntryDocument,
  parseStudioChangelogEntryPathPrNumber,
  STUDIO_CHANGELOG_ENTRY_LIMIT,
  STUDIO_CHANGELOG_ENTRY_PATTERN,
  isStudioChangelogEntry,
  type StudioChangelogEntry,
} from '../../apps/sva-studio-react/src/lib/studio-changelog.shared.ts';
import { resolveStudioChangelogWorkspaceRoot } from './studio-changelog-entry-files.ts';

const stableTagPattern = /^studio-v(\d+)\.(\d+)\.(\d+)$/u;
const revisionPattern = /^(?:HEAD|[a-f0-9]{40}|studio-v\d+\.\d+\.\d+)$/u;

const git = (repositoryRoot: string, args: readonly string[]): string =>
  execFileSync('git', [...args], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export const findLatestStableStudioTag = (repositoryRoot: string): string | null => {
  const tags = git(repositoryRoot, ['tag', '--list', 'studio-v*']).split('\n').filter((tag) => stableTagPattern.test(tag));
  tags.sort((left, right) => {
    const leftVersion = left.match(stableTagPattern)!.slice(1).map(Number);
    const rightVersion = right.match(stableTagPattern)!.slice(1).map(Number);
    for (let index = 0; index < 3; index += 1) {
      const difference = rightVersion[index]! - leftVersion[index]!;
      if (difference !== 0) return difference;
    }
    return 0;
  });
  return tags[0] ?? null;
};

const resolveCommit = (repositoryRoot: string, ref: string): string => {
  if (!revisionPattern.test(ref)) throw new Error(`Ungültige Studio-Release-Revision: ${ref}`);
  const commit = git(repositoryRoot, ['rev-parse', '--verify', `${ref}^{commit}`]);
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error(`Revision ${ref} ist kein Commit.`);
  return commit;
};

const listEntryFilesAtCommit = (repositoryRoot: string, commit: string): readonly string[] =>
  git(repositoryRoot, ['ls-tree', '-r', '--name-only', commit, '--', 'docs/changelog/entries'])
    .split('\n')
    .filter((filePath) => STUDIO_CHANGELOG_ENTRY_PATTERN.test(filePath));

type GeneratorOptions = { outputPath: string; format: 'json' | 'notes'; baseRef?: string; headRef: string };

const parseOptions = (args: readonly string[]): GeneratorOptions => {
  const options: GeneratorOptions = {
    outputPath: path.join('apps/sva-studio-react/.generated', 'studio-changelog.json'),
    format: 'json',
    headRef: 'HEAD',
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[++index];
    if (!value) throw new Error(`Fehlender Wert für ${argument}`);
    if (argument === '--output') options.outputPath = value;
    else if (argument === '--base-ref') options.baseRef = value;
    else if (argument === '--head-ref') options.headRef = value;
    else if (argument === '--format' && (value === 'json' || value === 'notes')) options.format = value;
    else throw new Error(`Ungültige Generator-Option: ${argument} ${value}`);
  }
  return options;
};

export const collectEntriesForArtifact = (
  entries: readonly StudioChangelogEntry[]
): readonly StudioChangelogEntry[] =>
  entries
    .slice()
    .sort(compareStudioChangelogEntriesDescending)
    .slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);

export const collectEntriesFromWorkspaceRoot = (
  repositoryRoot: string,
  baseRef = findLatestStableStudioTag(repositoryRoot),
  headRef = 'HEAD'
): readonly StudioChangelogEntry[] => {
  if (!baseRef) return [];
  const baseCommit = resolveCommit(repositoryRoot, baseRef);
  const headCommit = resolveCommit(repositoryRoot, headRef);
  const publishedEntries = new Set(listEntryFilesAtCommit(repositoryRoot, baseCommit));
  const seenPrNumbers = new Set<number>();

  const entries = listEntryFilesAtCommit(repositoryRoot, headCommit)
    .filter((filePath) => !publishedEntries.has(filePath))
    .map((filePath) => {
      const expectedPrNumber = parseStudioChangelogEntryPathPrNumber(filePath);
      const entry = parseStudioChangelogEntryDocument(filePath, git(repositoryRoot, ['show', `${headCommit}:${filePath}`]));
      if (entry.prNumber !== expectedPrNumber) {
        throw new Error(`Dateiname ${filePath} und JSON-prNumber ${entry.prNumber} stimmen nicht überein.`);
      }
      if (seenPrNumbers.has(entry.prNumber)) {
        throw new Error(`Doppelter Studio-Changelog-Eintrag für PR ${entry.prNumber}.`);
      }

      seenPrNumbers.add(entry.prNumber);
      return entry;
    });

  return entries.sort(compareStudioChangelogEntriesDescending);
};

export const renderStudioReleaseNotes = (entries: readonly StudioChangelogEntry[]): string =>
  entries.length === 0
    ? 'Keine neuen Änderungen für Nutzer.\n'
    : `${entries.map((entry) => `### PR #${entry.prNumber}\n\n${entry.body}`).join('\n\n')}\n`;

export const assertPrebuiltStudioChangelog = (source: string, expectedCommit: string | undefined): void => {
  const artifact: unknown = JSON.parse(source);
  if (!expectedCommit || !/^[a-f0-9]{40}$/u.test(expectedCommit) ||
      typeof artifact !== 'object' || artifact === null || Array.isArray(artifact)) {
    throw new Error('Das vorbereitete Studio-Changelog gehört nicht zum Image-Quellcommit.');
  }
  const candidate = artifact as { sourceCommit?: unknown; entries?: unknown };
  if (candidate.sourceCommit !== expectedCommit || !Array.isArray(candidate.entries) ||
      !candidate.entries.every(isStudioChangelogEntry)) {
    throw new Error('Das vorbereitete Studio-Changelog gehört nicht zum Image-Quellcommit.');
  }
};

const main = (): void => {
  const repositoryRoot = resolveStudioChangelogWorkspaceRoot();
  const options = parseOptions(process.argv.slice(2));
  const outputPath = path.resolve(process.cwd(), options.outputPath);
  if (process.env.STUDIO_CHANGELOG_PREBUILT === 'true') {
    const expectedCommit = process.env.VITE_GIT_SHA;
    assertPrebuiltStudioChangelog(readFileSync(outputPath, 'utf8'), expectedCommit);
    console.log(JSON.stringify({ outputPath, sourceCommit: expectedCommit, prebuilt: true }, null, 2));
    return;
  }
  const baseRef = options.baseRef ?? findLatestStableStudioTag(repositoryRoot);
  if (options.format === 'notes' && !baseRef) {
    throw new Error('Release Notes erfordern einen verifizierten stabilen Studio-Basistag.');
  }
  const entries = collectEntriesFromWorkspaceRoot(repositoryRoot, baseRef, options.headRef);
  const sourceCommit = resolveCommit(repositoryRoot, options.headRef);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, options.format === 'notes'
    ? renderStudioReleaseNotes(entries)
    : `${JSON.stringify({ sourceCommit, entries: collectEntriesForArtifact(entries) }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ baseRef, headRef: options.headRef, format: options.format, outputPath }, null, 2));
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
