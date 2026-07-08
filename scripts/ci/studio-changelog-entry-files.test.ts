import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  listStudioChangelogEntryFiles,
  resolveStudioChangelogWorkspaceRoot,
} from './studio-changelog-entry-files.ts';

const temporaryDirectories: string[] = [];

describe('studio-changelog-entry-files', () => {
  afterEach(() => {
    while (temporaryDirectories.length > 0) {
      const directoryPath = temporaryDirectories.pop();
      if (directoryPath) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
      }
    }
  });

  it('resolves the workspace root by walking up to the changelog entry directory', () => {
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-changelog-root-'));
    temporaryDirectories.push(rootDirectory);

    const appDirectory = path.join(rootDirectory, 'apps', 'sva-studio-react');
    fs.mkdirSync(path.join(rootDirectory, 'docs', 'changelog', 'entries'), { recursive: true });
    fs.mkdirSync(appDirectory, { recursive: true });

    expect(resolveStudioChangelogWorkspaceRoot(appDirectory)).toBe(rootDirectory);
  });

  it('lists only changelog entry json files from the repository directory', () => {
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-changelog-entries-'));
    temporaryDirectories.push(rootDirectory);

    const entryDirectory = path.join(rootDirectory, 'docs', 'changelog', 'entries');
    fs.mkdirSync(entryDirectory, { recursive: true });
    fs.writeFileSync(path.join(entryDirectory, '.gitkeep'), '', 'utf8');
    fs.writeFileSync(path.join(entryDirectory, 'pr-2.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(entryDirectory, 'pr-10.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(entryDirectory, 'notes.json'), '{}', 'utf8');

    expect(listStudioChangelogEntryFiles(rootDirectory)).toEqual([
      'docs/changelog/entries/pr-10.json',
      'docs/changelog/entries/pr-2.json',
    ]);
  });
});
