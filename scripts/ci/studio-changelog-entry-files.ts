import fs from 'node:fs';
import path from 'node:path';

import {
  parseStudioChangelogEntryPathPrNumber,
  STUDIO_CHANGELOG_ENTRY_DIRECTORY,
  STUDIO_CHANGELOG_ENTRY_PATTERN,
} from '../../apps/sva-studio-react/src/lib/studio-changelog.shared.ts';

const toPosixPath = (filePath: string): string => filePath.split(path.sep).join(path.posix.sep);

const hasStudioChangelogEntryDirectory = (directoryPath: string): boolean =>
  fs.existsSync(path.join(directoryPath, STUDIO_CHANGELOG_ENTRY_DIRECTORY));

export const resolveStudioChangelogWorkspaceRoot = (startDirectory = process.cwd()): string => {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (hasStudioChangelogEntryDirectory(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(
        `Workspace-Wurzel mit ${STUDIO_CHANGELOG_ENTRY_DIRECTORY} konnte ab ${startDirectory} nicht gefunden werden.`
      );
    }

    currentDirectory = parentDirectory;
  }
};

export const listStudioChangelogEntryFiles = (workspaceRoot: string): readonly string[] => {
  const entryDirectory = path.join(workspaceRoot, STUDIO_CHANGELOG_ENTRY_DIRECTORY);
  if (!fs.existsSync(entryDirectory)) {
    return [];
  }

  return fs
    .readdirSync(entryDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.posix.join(STUDIO_CHANGELOG_ENTRY_DIRECTORY, toPosixPath(entry.name)))
    .filter((entryPath) => STUDIO_CHANGELOG_ENTRY_PATTERN.test(entryPath))
    .sort((left, right) => parseStudioChangelogEntryPathPrNumber(right) - parseStudioChangelogEntryPathPrNumber(left));
};
