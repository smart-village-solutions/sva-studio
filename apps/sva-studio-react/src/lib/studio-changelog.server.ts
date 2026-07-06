import path from 'node:path';
import { readFile } from 'node:fs/promises';

import {
  compareStudioChangelogEntriesDescending,
  isStudioChangelogEntry,
  STUDIO_CHANGELOG_ARTIFACT_RELATIVE_PATH,
  STUDIO_CHANGELOG_ENTRY_LIMIT,
  type StudioChangelogEntry,
} from './studio-changelog.shared';

type LoadStudioChangelogEntriesInput = {
  readCatalogFile?: (filePath: string) => Promise<string>;
  resolveCatalogPaths?: () => readonly string[];
};

const isMissingCatalogError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as NodeJS.ErrnoException;
  if (candidate.code === 'ENOENT') {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /enoent|not found|nicht gefunden|no such file/i.test(error.message);
};

const resolveStudioChangelogCatalogPaths = (): readonly string[] => [
  path.resolve(process.cwd(), '.output/server', STUDIO_CHANGELOG_ARTIFACT_RELATIVE_PATH),
  path.resolve(process.cwd(), 'apps/sva-studio-react/.output/server', STUDIO_CHANGELOG_ARTIFACT_RELATIVE_PATH),
  path.resolve(process.cwd(), '.generated/studio-changelog.json'),
  path.resolve(process.cwd(), 'apps/sva-studio-react/.generated/studio-changelog.json'),
];

const parseStudioChangelogCatalog = (filePath: string, source: string): readonly StudioChangelogEntry[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Studio-Changelog-Katalog ${filePath} enthält kein gültiges JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Studio-Changelog-Katalog ${filePath} muss ein JSON-Objekt enthalten.`);
  }

  const candidate = parsed as { entries?: unknown };
  if (!Array.isArray(candidate.entries)) {
    throw new Error(`Studio-Changelog-Katalog ${filePath} muss ein entries-Array enthalten.`);
  }

  const entries = candidate.entries.filter(isStudioChangelogEntry);
  if (entries.length !== candidate.entries.length) {
    throw new Error(`Studio-Changelog-Katalog ${filePath} enthält ungültige Einträge.`);
  }

  return entries;
};

export const loadStudioChangelogEntries = async ({
  readCatalogFile = (filePath) => readFile(filePath, 'utf8'),
  resolveCatalogPaths = resolveStudioChangelogCatalogPaths,
}: LoadStudioChangelogEntriesInput = {}): Promise<readonly StudioChangelogEntry[]> => {
  const attemptedPaths: string[] = [];
  let lastMissingFileError: unknown;

  for (const filePath of resolveCatalogPaths()) {
    attemptedPaths.push(filePath);
    try {
      const source = await readCatalogFile(filePath);
      const entries = parseStudioChangelogCatalog(filePath, source);
      const seenPrNumbers = new Set<number>();

      for (const entry of entries) {
        if (seenPrNumbers.has(entry.prNumber)) {
          throw new Error(`Doppelter Studio-Changelog-Eintrag für PR ${entry.prNumber}.`);
        }
        seenPrNumbers.add(entry.prNumber);
      }

      return entries
        .slice()
        .sort(compareStudioChangelogEntriesDescending)
        .slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);
    } catch (error) {
      if (isMissingCatalogError(error)) {
        lastMissingFileError = error;
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Studio-Changelog-Katalog konnte aus ${attemptedPaths.join(', ')} nicht geladen werden: ${
      lastMissingFileError instanceof Error ? lastMissingFileError.message : String(lastMissingFileError)
    }`
  );
};
