import { readFileSync } from 'node:fs';

import {
  compareStudioChangelogEntriesDescending,
  parseStudioChangelogEntryDocument,
  parseStudioChangelogEntryPathPrNumber,
  STUDIO_CHANGELOG_ENTRY_LIMIT,
  STUDIO_CHANGELOG_ENTRY_PATTERN,
} from '../../apps/sva-studio-react/src/lib/studio-changelog.shared.ts';
import { resolveChangedFiles } from './pr-scope.ts';
import {
  listStudioChangelogEntryFiles,
  resolveStudioChangelogWorkspaceRoot,
} from './studio-changelog-entry-files.ts';

type StudioChangelogEntry = {
  prNumber: number;
  body: string;
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
        throw new Error('Ungültiger Wert für --mode. Erlaubt sind pr oder repo.');
      }
      mode = value;
      index += 1;
      continue;
    }

    if (argument === '--base') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --base');
      }
      base = value;
      index += 1;
      continue;
    }

    if (argument === '--head') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --head');
      }
      head = value;
      index += 1;
      continue;
    }

    if (argument === '--pr-number') {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('Fehlender oder ungültiger Wert für --pr-number');
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
      `Der Pull Request muss eine Changelog-Datei unter ${expectedEntryPath} ändern oder anlegen.`
    );
  }

  for (const entryPath of entryFiles) {
    const fileNamePrNumber = parseStudioChangelogEntryPathPrNumber(entryPath);
    if (entryPath !== expectedEntryPath && fileNamePrNumber >= expectedPrNumber) {
      throw new Error(
        `Zusätzliche Studio-Changelog-Dateien müssen ältere PRs betreffen. ${entryPath} ist nicht älter als PR ${expectedPrNumber}.`
      );
    }
    const entry = parseStudioChangelogEntryDocument(entryPath, readFile(entryPath));
    if (entry.prNumber !== fileNamePrNumber) {
      throw new Error(`Dateiname ${entryPath} und JSON-prNumber ${entry.prNumber} stimmen nicht überein.`);
    }
  }

  if (!entryFiles.includes(expectedEntryPath)) {
    throw new Error(
      `Der Pull Request muss die Changelog-Datei ${expectedEntryPath} enthalten. Ältere Einträge dürfen zusätzlich angepasst werden.`
    );
  }

  const entry = parseStudioChangelogEntryDocument(expectedEntryPath, readFile(expectedEntryPath));
  if (entry.prNumber !== expectedPrNumber) {
    throw new Error(
      `Datei ${expectedEntryPath} enthält prNumber ${entry.prNumber}, erwartet war ${expectedPrNumber}.`
    );
  }

  return { entryPath: expectedEntryPath, entry };
};

const normalizeStudioChangelogRepositoryEntries = ({
  entryFiles,
  readFile,
}: RepositoryValidationInput): StudioChangelogEntry[] =>
  [...entryFiles].map((entryPath) => {
    const expectedPrNumber = parseStudioChangelogEntryPathPrNumber(entryPath);
    const entry = parseStudioChangelogEntryDocument(entryPath, readFile(entryPath));
    if (entry.prNumber !== expectedPrNumber) {
      throw new Error(`Dateiname ${entryPath} und JSON-prNumber ${entry.prNumber} stimmen nicht überein.`);
    }

    return entry;
  });

export const collectStudioChangelogEntries = ({
  entryFiles,
  readFile,
}: RepositoryValidationInput): StudioChangelogEntry[] => {
  return normalizeStudioChangelogRepositoryEntries({
    entryFiles,
    readFile,
  })
    .sort(compareStudioChangelogEntriesDescending)
    .slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);
};

export const validateStudioChangelogRepository = (input: RepositoryValidationInput): StudioChangelogEntry[] => {
  const allEntries = normalizeStudioChangelogRepositoryEntries(input);
  const seenPrNumbers = new Set<number>();

  for (const entry of allEntries) {
    if (seenPrNumbers.has(entry.prNumber)) {
      throw new Error(`Doppelter Studio-Changelog-Eintrag für PR ${entry.prNumber}.`);
    }
    seenPrNumbers.add(entry.prNumber);
  }

  return allEntries.sort(compareStudioChangelogEntriesDescending).slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);
};

const readEntryFile = (filePath: string): string => readFileSync(filePath, 'utf8');

export const runStudioChangelogCheck = (args: readonly string[]): number => {
  const options = parseCliOptions(args);

  if (options.mode === 'pr') {
    if (options.prNumber === null) {
      throw new Error('PR-Modus erfordert --pr-number <Nummer>.');
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
    entryFiles: listStudioChangelogEntryFiles(resolveStudioChangelogWorkspaceRoot()),
    readFile: readEntryFile,
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
