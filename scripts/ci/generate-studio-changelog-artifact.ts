import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  compareStudioChangelogEntriesDescending,
  parseStudioChangelogEntryDocument,
  parseStudioChangelogEntryPathPrNumber,
  STUDIO_CHANGELOG_ARTIFACT_RELATIVE_PATH,
  STUDIO_CHANGELOG_ENTRY_DIRECTORY,
  STUDIO_CHANGELOG_ENTRY_LIMIT,
  type StudioChangelogEntry,
} from '../../apps/sva-studio-react/src/lib/studio-changelog.shared.ts';

const parseOutputPath = (args: readonly string[]): string => {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--output') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert fuer --output');
      }
      return value;
    }
  }

  return path.join('apps/sva-studio-react/public', STUDIO_CHANGELOG_ARTIFACT_RELATIVE_PATH);
};

const listRepositoryEntryFiles = (): readonly string[] => {
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

const collectEntries = (): readonly StudioChangelogEntry[] => {
  const seenPrNumbers = new Set<number>();

  const entries = listRepositoryEntryFiles().map((filePath) => {
    const expectedPrNumber = parseStudioChangelogEntryPathPrNumber(filePath);
    const entry = parseStudioChangelogEntryDocument(filePath, readFileSync(filePath, 'utf8'));
    if (entry.prNumber !== expectedPrNumber) {
      throw new Error(`Dateiname ${filePath} und JSON-prNumber ${entry.prNumber} stimmen nicht ueberein.`);
    }
    if (seenPrNumbers.has(entry.prNumber)) {
      throw new Error(`Doppelter Studio-Changelog-Eintrag fuer PR ${entry.prNumber}.`);
    }

    seenPrNumbers.add(entry.prNumber);

    const mergedAt = readMergedAtFromGit(filePath);
    if (Number.isNaN(Date.parse(mergedAt))) {
      throw new Error(`Datei ${filePath} liefert keinen gueltigen ISO-Zeitstempel fuer mergedAt.`);
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
  const outputPath = path.resolve(process.cwd(), parseOutputPath(process.argv.slice(2)));
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ entries: collectEntries() }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath }, null, 2));
};

main();
