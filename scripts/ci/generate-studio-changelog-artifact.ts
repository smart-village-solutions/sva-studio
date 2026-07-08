import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  compareStudioChangelogEntriesDescending,
  parseStudioChangelogEntryDocument,
  parseStudioChangelogEntryPathPrNumber,
  STUDIO_CHANGELOG_ENTRY_DIRECTORY,
  STUDIO_CHANGELOG_ENTRY_LIMIT,
  type StudioChangelogEntry,
} from '../../apps/sva-studio-react/src/lib/studio-changelog.shared.ts';
import {
  listStudioChangelogEntryFiles,
  resolveStudioChangelogWorkspaceRoot,
} from './studio-changelog-entry-files.ts';

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

export const collectEntriesForArtifact = (
  entries: readonly StudioChangelogEntry[]
): readonly StudioChangelogEntry[] =>
  entries
    .slice()
    .sort(compareStudioChangelogEntriesDescending)
    .slice(0, STUDIO_CHANGELOG_ENTRY_LIMIT);

export const collectEntriesFromWorkspaceRoot = (repositoryRoot: string): readonly StudioChangelogEntry[] => {
  const seenPrNumbers = new Set<number>();

  const entries = listStudioChangelogEntryFiles(repositoryRoot).map((filePath) => {
    const expectedPrNumber = parseStudioChangelogEntryPathPrNumber(filePath);
    const entry = parseStudioChangelogEntryDocument(filePath, readFileSync(path.join(repositoryRoot, filePath), 'utf8'));
    if (entry.prNumber !== expectedPrNumber) {
      throw new Error(`Dateiname ${filePath} und JSON-prNumber ${entry.prNumber} stimmen nicht überein.`);
    }
    if (seenPrNumbers.has(entry.prNumber)) {
      throw new Error(`Doppelter Studio-Changelog-Eintrag für PR ${entry.prNumber}.`);
    }

    seenPrNumbers.add(entry.prNumber);
    return entry;
  });

  return collectEntriesForArtifact(entries);
};

const main = (): void => {
  const repositoryRoot = resolveStudioChangelogWorkspaceRoot();
  const outputPath = path.resolve(process.cwd(), parseOutputPath(process.argv.slice(2)));
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ entries: collectEntriesFromWorkspaceRoot(repositoryRoot) }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath }, null, 2));
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
