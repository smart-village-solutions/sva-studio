import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
  compareStudioChangelogEntriesDescending,
  parseStudioChangelogEntryDocument,
  parseStudioChangelogEntryPathPrNumber,
  STUDIO_CHANGELOG_ENTRY_DIRECTORY,
  STUDIO_CHANGELOG_ENTRY_LIMIT,
  STUDIO_CHANGELOG_ENTRY_PATTERN,
} from '../../apps/sva-studio-react/src/lib/studio-changelog.shared.ts';
import { resolveChangedFiles } from './pr-scope.ts';

type StudioChangelogEntry = {
  prNumber: number;
  body: string;
};

type StudioChangelogRepositoryEntry = StudioChangelogEntry & {
  mergedAt: string;
};

type PullRequestValidationResult = {
  entryPath: string;
  entry: StudioChangelogEntry;
};

type PullRequestValidationInput = {
  changedFiles: readonly string[];
  expectedPrNumber: number;
  readFile: (filePath: string) => string;
};

type RepositoryValidationInput = {
  entryFiles: readonly string[];
  readFile: (filePath: string) => string;
  readMergedAt: (filePath: string) => string;
};

type CliOptions = {
  mode: 'pr' | 'repo';
  base: string;
  head: string;
  prNumber: number | null;
};

const parseCliOptions = (args: readonly string[]): CliOptions => {
  let mode: 'pr' | 'repo' = 'repo';
  let base = 'origin/main';
  let head = 'HEAD';
  let prNumber: number | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--mode') {
      const value = args[index + 1];
      if (value !== 'pr' && value !== 'repo') {
        throw new Error('Ungueltiger Wert fuer --mode. Erlaubt sind pr oder repo.');
      }
      mode = value;
      index += 1;
      continue;
    }

    if (argument === '--base') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert fuer --base');
      }
      base = value;
      index += 1;
      continue;
    }

    if (argument === '--head') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert fuer --head');
      }
      head = value;
      index += 1;
      continue;
    }

    if (argument === '--pr-number') {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('Fehlender oder ungueltiger Wert fuer --pr-number');
      }
      prNumber = value;
      index += 1;
    }
  }

  return { mode, base, head, prNumber };
};

export const validateStudioChangelogPullRequest = ({
  changedFiles,
  expectedPrNumber,
  readFile,
}: PullRequestValidationInput): PullRequestValidationResult => {
  const entryFiles = [...new Set(changedFiles.filter((filePath) => STUDIO_CHANGELOG_ENTRY_PATTERN.test(filePath)))];
  const expectedEntryPath = `docs/changelog/entries/pr-${expectedPrNumber}.json`;

  if (entryFiles.length === 0) {
    throw new Error(
      `Der Pull Request muss eine Changelog-Datei unter ${expectedEntryPath} aendern oder anlegen.`
    );
  }

  for (const entryPath of entryFiles) {
    const fileNamePrNumber = parseStudioChangelogEntryPathPrNumber(entryPath);
    const entry = parseStudioChangelogEntryDocument(entryPath, readFile(entryPath));
    if (entry.prNumber !== fileNamePrNumber) {
      throw new Error(`Dateiname ${entryPath} und JSON-prNumber ${entry.prNumber} stimmen nicht ueberein.`);
    }
  }

  if (!entryFiles.includes(expectedEntryPath)) {
    throw new Error(
      `Der Pull Request muss die Changelog-Datei ${expectedEntryPath} enthalten. Aeltere Eintraege duerfen zusaetzlich angepasst werden.`
    );
  }

  const entry = parseStudioChangelogEntryDocument(expectedEntryPath, readFile(expectedEntryPath));
  if (entry.prNumber !== expectedPrNumber) {
    throw new Error(
      `Datei ${expectedEntryPath} enthaelt prNumber ${entry.prNumber}, erwartet war ${expectedPrNumber}.`
    );
  }

  return { entryPath: expectedEntryPath, entry };
};

const normalizeStudioChangelogRepositoryEntries = ({
  entryFiles,
  readFile,
  readMergedAt,
}: RepositoryValidationInput): StudioChangelogRepositoryEntry[] =>
  [...entryFiles].map((entryPath) => {
    const expectedPrNumber = parseStudioChangelogEntryPathPrNumber(entryPath);
    const entry = parseStudioChangelogEntryDocument(entryPath, readFile(entryPath));
    if (entry.prNumber !== expectedPrNumber) {
      throw new Error(`Dateiname ${entryPath} und JSON-prNumber ${entry.prNumber} stimmen nicht ueberein.`);
    }

    const mergedAt = readMergedAt(entryPath);
    if (Number.isNaN(Date.parse(mergedAt))) {
      throw new Error(`Datei ${entryPath} liefert keinen gueltigen ISO-Zeitstempel fuer mergedAt.`);
    }

    return {
      ...entry,
      mergedAt,
    };
  });

export const collectStudioChangelogEntries = ({
  entryFiles,
  readFile,
  readMergedAt,
}: RepositoryValidationInput): StudioChangelogRepositoryEntry[] => {
  return normalizeStudioChangelogRepositoryEntries({
    entryFiles,
    readFile,
    readMergedAt,
  })
    .sort(compareStudioChangelogEntriesDescending)
    .slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);
};

export const validateStudioChangelogRepository = (input: RepositoryValidationInput): StudioChangelogRepositoryEntry[] => {
  const allEntries = normalizeStudioChangelogRepositoryEntries(input);
  const seenPrNumbers = new Set<number>();

  for (const entry of allEntries) {
    if (seenPrNumbers.has(entry.prNumber)) {
      throw new Error(`Doppelter Studio-Changelog-Eintrag fuer PR ${entry.prNumber}.`);
    }
    seenPrNumbers.add(entry.prNumber);
  }

  return allEntries.sort(compareStudioChangelogEntriesDescending).slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);
};

const readEntryFile = (filePath: string): string => readFileSync(filePath, 'utf8');

const listRepositoryEntryFiles = (): string[] => {
  const output = execFileSync('git', ['ls-files', `${STUDIO_CHANGELOG_ENTRY_DIRECTORY}/*.json`], {
    encoding: 'utf8',
  }).trim();

  return output.length === 0 ? [] : output.split('\n').map((line) => line.trim()).filter(Boolean);
};

const readMergedAtFromGit = (filePath: string): string => {
  const mergedAt = execFileSync('git', ['log', '--diff-filter=A', '-1', '--format=%cI', '--', filePath], {
    encoding: 'utf8',
  }).trim();

  if (mergedAt.length > 0) {
    return mergedAt;
  }

  return execFileSync('git', ['log', '-1', '--format=%cI', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
};

export const runStudioChangelogCheck = (args: readonly string[]): number => {
  const options = parseCliOptions(args);

  if (options.mode === 'pr') {
    if (options.prNumber === null) {
      throw new Error('PR-Modus erfordert --pr-number <nummer>.');
    }

    const changedFiles = resolveChangedFiles(options.base, options.head);
    const result = validateStudioChangelogPullRequest({
      changedFiles,
      expectedPrNumber: options.prNumber,
      readFile: readEntryFile,
    });

    console.log(
      JSON.stringify(
        {
          mode: 'pr',
          validatedEntry: result.entryPath,
          prNumber: result.entry.prNumber,
        },
        null,
        2
      )
    );
    return 0;
  }

  const entries = validateStudioChangelogRepository({
    entryFiles: listRepositoryEntryFiles(),
    readFile: readEntryFile,
    readMergedAt: readMergedAtFromGit,
  });

  console.log(
    JSON.stringify(
      {
        mode: 'repo',
        validatedEntries: entries.length,
      },
      null,
      2
    )
  );
  return 0;
};

if (import.meta.url === new URL(process.argv[1]!, 'file://').href) {
  process.exit(runStudioChangelogCheck(process.argv.slice(2)));
}
