import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { resolveChangedFiles } from './pr-scope.ts';

const CHANGELOG_ENTRY_DIRECTORY = 'docs/changelog/entries';
const CHANGELOG_ENTRY_PATTERN = /^docs\/changelog\/entries\/pr-(\d+)\.json$/u;
const RAW_HTML_PATTERN = /<([a-z][\w-]*)(?:\s[^>]*)?>/iu;
const DEFAULT_LIMIT = 20;

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

const parseEntryPathPrNumber = (filePath: string): number => {
  const match = filePath.match(CHANGELOG_ENTRY_PATTERN);
  if (!match) {
    throw new Error(`Dateiname ${filePath} liegt nicht im erwarteten Format docs/changelog/entries/pr-<nummer>.json.`);
  }

  return Number(match[1]);
};

const isNonEmptyBody = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const assertNoRawHtml = (body: string): void => {
  if (RAW_HTML_PATTERN.test(body)) {
    throw new Error('body darf kein rohes HTML enthalten.');
  }
};

const parseStudioChangelogEntry = (filePath: string, source: string): StudioChangelogEntry => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Datei ${filePath} enthaelt kein gueltiges JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Datei ${filePath} muss ein JSON-Objekt enthalten.`);
  }

  const candidate = parsed as { prNumber?: unknown; body?: unknown };
  if (!Number.isInteger(candidate.prNumber) || Number(candidate.prNumber) <= 0) {
    throw new Error(`Datei ${filePath} muss ein positives Integer-Feld prNumber enthalten.`);
  }
  if (!isNonEmptyBody(candidate.body)) {
    throw new Error(`Datei ${filePath} muss ein body-Feld enthalten, das nicht leer ist.`);
  }

  assertNoRawHtml(candidate.body);

  return {
    prNumber: Number(candidate.prNumber),
    body: candidate.body.trim(),
  };
};

export const validateStudioChangelogPullRequest = ({
  changedFiles,
  expectedPrNumber,
  readFile,
}: PullRequestValidationInput): PullRequestValidationResult => {
  const entryFiles = [...new Set(changedFiles.filter((filePath) => CHANGELOG_ENTRY_PATTERN.test(filePath)))];

  if (entryFiles.length !== 1) {
    throw new Error('Der Pull Request muss genau eine Changelog-Datei unter docs/changelog/entries/ aendern oder anlegen.');
  }

  const entryPath = entryFiles[0]!;
  const fileNamePrNumber = parseEntryPathPrNumber(entryPath);
  if (fileNamePrNumber !== expectedPrNumber) {
    throw new Error(
      `Dateiname ${entryPath} passt nicht zur erwarteten PR-Nummer ${expectedPrNumber}.`
    );
  }

  const entry = parseStudioChangelogEntry(entryPath, readFile(entryPath));
  if (entry.prNumber !== expectedPrNumber) {
    throw new Error(`Datei ${entryPath} enthaelt prNumber ${entry.prNumber}, erwartet war ${expectedPrNumber}.`);
  }

  return { entryPath, entry };
};

export const collectStudioChangelogEntries = ({
  entryFiles,
  readFile,
  readMergedAt,
}: RepositoryValidationInput): StudioChangelogRepositoryEntry[] => {
  return [...entryFiles]
    .map((entryPath) => {
      const expectedPrNumber = parseEntryPathPrNumber(entryPath);
      const entry = parseStudioChangelogEntry(entryPath, readFile(entryPath));
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
    })
    .sort((left, right) => {
      const mergedAtDiff = right.mergedAt.localeCompare(left.mergedAt);
      return mergedAtDiff !== 0 ? mergedAtDiff : right.prNumber - left.prNumber;
    })
    .slice(0, DEFAULT_LIMIT);
};

export const validateStudioChangelogRepository = (input: RepositoryValidationInput): StudioChangelogRepositoryEntry[] => {
  const allEntries = input.entryFiles.map((entryPath) => {
    const expectedPrNumber = parseEntryPathPrNumber(entryPath);
    const entry = parseStudioChangelogEntry(entryPath, input.readFile(entryPath));
    if (entry.prNumber !== expectedPrNumber) {
      throw new Error(`Dateiname ${entryPath} und JSON-prNumber ${entry.prNumber} stimmen nicht ueberein.`);
    }

    const mergedAt = input.readMergedAt(entryPath);
    if (Number.isNaN(Date.parse(mergedAt))) {
      throw new Error(`Datei ${entryPath} liefert keinen gueltigen ISO-Zeitstempel fuer mergedAt.`);
    }

    return { ...entry, mergedAt };
  });
  const seenPrNumbers = new Set<number>();

  for (const entry of allEntries) {
    if (seenPrNumbers.has(entry.prNumber)) {
      throw new Error(`Duplicate changelog entry for PR ${entry.prNumber}.`);
    }
    seenPrNumbers.add(entry.prNumber);
  }

  return collectStudioChangelogEntries(input);
};

const readEntryFile = (filePath: string): string => readFileSync(filePath, 'utf8');

const listRepositoryEntryFiles = (): string[] => {
  const output = execFileSync('git', ['ls-files', `${CHANGELOG_ENTRY_DIRECTORY}/*.json`], {
    encoding: 'utf8',
  }).trim();

  return output.length === 0 ? [] : output.split('\n').map((line) => line.trim()).filter(Boolean);
};

const readMergedAtFromGit = (filePath: string): string => {
  const mergedAt = execFileSync('git', ['log', '-1', '--format=%cI', '--', filePath], {
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
