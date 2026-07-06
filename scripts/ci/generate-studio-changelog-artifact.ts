import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  compareStudioChangelogEntriesDescending,
  parseStudioChangelogEntryDocument,
  parseStudioChangelogEntryPathPrNumber,
  STUDIO_CHANGELOG_ENTRY_DIRECTORY,
  STUDIO_CHANGELOG_ENTRY_LIMIT,
  type StudioChangelogEntry,
} from '../../apps/sva-studio-react/src/lib/studio-changelog.shared.ts';

const resolveRepositoryRoot = (): string =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();

const parseOutputPath = (args: readonly string[]): string => {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--output') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --output');
      }
      return value;
    }
  }

  return path.join('apps/sva-studio-react/.generated', 'studio-changelog.json');
};

const listRepositoryEntryFiles = (repositoryRoot: string): readonly string[] => {
  const output = execFileSync('git', ['-C', repositoryRoot, 'ls-files', `${STUDIO_CHANGELOG_ENTRY_DIRECTORY}/*.json`], {
    encoding: 'utf8',
  }).trim();

  return output.length === 0 ? [] : output.split('\n').map((line) => line.trim()).filter(Boolean);
};

const readMergedAtFromGit = (repositoryRoot: string, filePath: string): string => {
  const gitArguments = [
    '-C',
    repositoryRoot,
    'log',
    '--first-parent',
    '--diff-filter=A',
    '-1',
    '--format=%cI',
    '--',
    filePath,
  ];
  const mergedAt = execFileSync('git', gitArguments, { encoding: 'utf8' }).trim();

  if (mergedAt.length > 0) {
    return mergedAt;
  }

  return execFileSync('git', ['-C', repositoryRoot, 'log', '-1', '--format=%cI', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
};

const collectEntries = (repositoryRoot: string): readonly StudioChangelogEntry[] => {
  const seenPrNumbers = new Set<number>();

  const entries = listRepositoryEntryFiles(repositoryRoot).map((filePath) => {
    const expectedPrNumber = parseStudioChangelogEntryPathPrNumber(filePath);
    const entry = parseStudioChangelogEntryDocument(filePath, readFileSync(path.join(repositoryRoot, filePath), 'utf8'));
    if (entry.prNumber !== expectedPrNumber) {
      throw new Error(`Dateiname ${filePath} und JSON-prNumber ${entry.prNumber} stimmen nicht überein.`);
    }
    if (seenPrNumbers.has(entry.prNumber)) {
      throw new Error(`Doppelter Studio-Changelog-Eintrag für PR ${entry.prNumber}.`);
    }

    seenPrNumbers.add(entry.prNumber);

    const mergedAt = readMergedAtFromGit(repositoryRoot, filePath);
    if (Number.isNaN(Date.parse(mergedAt))) {
      throw new Error(`Datei ${filePath} liefert keinen gültigen ISO-Zeitstempel für mergedAt.`);
    }

    return {
      prNumber: entry.prNumber,
      body: entry.body,
      mergedAt,
    };
  });

  return entries.sort(compareStudioChangelogEntriesDescending).slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);
};

const main = (): void => {
  const repositoryRoot = resolveRepositoryRoot();
  const outputPath = path.resolve(process.cwd(), parseOutputPath(process.argv.slice(2)));
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ entries: collectEntries(repositoryRoot) }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath }, null, 2));
};

main();
