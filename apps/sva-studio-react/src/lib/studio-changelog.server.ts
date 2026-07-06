import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const CHANGELOG_ENTRY_DIRECTORY = 'docs/changelog/entries';
const CHANGELOG_ENTRY_PATTERN = /^docs\/changelog\/entries\/pr-(\d+)\.json$/u;
const RAW_HTML_PATTERN = /<([a-z][\w-]*)(?:\s[^>]*)?>/iu;
const ENTRY_LIMIT = 20;

export type StudioChangelogEntry = {
  prNumber: number;
  body: string;
  mergedAt: string;
};

type StudioChangelogEntryDocument = {
  prNumber: number;
  body: string;
};

type LoadStudioChangelogEntriesInput = {
  listEntryFiles?: () => Promise<readonly string[]>;
  readEntryFile?: (filePath: string) => Promise<string>;
  readMergedAt?: (filePath: string) => Promise<string>;
};

const parsePrNumberFromPath = (filePath: string): number => {
  const match = filePath.match(CHANGELOG_ENTRY_PATTERN);
  if (!match) {
    throw new Error(`Studio-Changelog-Datei ${filePath} liegt nicht im erwarteten Format.`);
  }

  return Number(match[1]);
};

const parseStudioChangelogEntryDocument = (filePath: string, source: string): StudioChangelogEntryDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Studio-Changelog-Datei ${filePath} enthaelt kein gueltiges JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Studio-Changelog-Datei ${filePath} muss ein JSON-Objekt enthalten.`);
  }

  const candidate = parsed as { prNumber?: unknown; body?: unknown };
  if (!Number.isInteger(candidate.prNumber) || Number(candidate.prNumber) <= 0) {
    throw new Error(`Studio-Changelog-Datei ${filePath} braucht ein positives Integer-Feld prNumber.`);
  }
  if (typeof candidate.body !== 'string' || candidate.body.trim().length === 0) {
    throw new Error(`Studio-Changelog-Datei ${filePath} braucht ein nicht leeres body-Feld.`);
  }
  if (RAW_HTML_PATTERN.test(candidate.body)) {
    throw new Error(`Studio-Changelog-Datei ${filePath} darf kein raw HTML enthalten.`);
  }

  return {
    prNumber: Number(candidate.prNumber),
    body: candidate.body.trim(),
  };
};

const listEntryFilesFromGit = async (): Promise<readonly string[]> => {
  const { stdout } = await execFileAsync('git', ['ls-files', `${CHANGELOG_ENTRY_DIRECTORY}/*.json`], {
    encoding: 'utf8',
  });

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const readMergedAtFromGit = async (filePath: string): Promise<string> => {
  const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI', '--', filePath], {
    encoding: 'utf8',
  });

  return stdout.trim();
};

export const loadStudioChangelogEntries = async ({
  listEntryFiles = listEntryFilesFromGit,
  readEntryFile = (filePath) => readFile(filePath, 'utf8'),
  readMergedAt = readMergedAtFromGit,
}: LoadStudioChangelogEntriesInput = {}): Promise<readonly StudioChangelogEntry[]> => {
  const entryFiles = await listEntryFiles();
  const entries = await Promise.all(
    entryFiles.map(async (filePath) => {
      const pathPrNumber = parsePrNumberFromPath(filePath);
      const document = parseStudioChangelogEntryDocument(filePath, await readEntryFile(filePath));
      if (document.prNumber !== pathPrNumber) {
        throw new Error(
          `Studio-Changelog-Datei ${filePath} hat prNumber ${document.prNumber}, erwartet war ${pathPrNumber}.`
        );
      }

      const mergedAt = await readMergedAt(filePath);
      if (Number.isNaN(Date.parse(mergedAt))) {
        throw new Error(`Studio-Changelog-Datei ${filePath} hat keinen gueltigen mergedAt-Zeitstempel.`);
      }

      return {
        prNumber: document.prNumber,
        body: document.body,
        mergedAt,
      };
    })
  );

  const seenPrNumbers = new Set<number>();
  for (const entry of entries) {
    if (seenPrNumbers.has(entry.prNumber)) {
      throw new Error(`Duplicate studio changelog entry for PR ${entry.prNumber}.`);
    }
    seenPrNumbers.add(entry.prNumber);
  }

  return entries
    .sort((left, right) => {
      const mergedAtDiff = right.mergedAt.localeCompare(left.mergedAt);
      return mergedAtDiff !== 0 ? mergedAtDiff : right.prNumber - left.prNumber;
    })
    .slice(0, ENTRY_LIMIT);
};
