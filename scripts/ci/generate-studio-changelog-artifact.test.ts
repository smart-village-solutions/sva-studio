import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectEntriesForArtifact,
  collectEntriesFromWorkspaceRoot,
} from './generate-studio-changelog-artifact.ts';

const temporaryDirectories: string[] = [];

describe('generate-studio-changelog-artifact', () => {
  afterEach(() => {
    while (temporaryDirectories.length > 0) {
      const directoryPath = temporaryDirectories.pop();
      if (directoryPath) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
      }
    }
  });

  it('sorts artifact entries by descending pr number and limits them to 20', () => {
    const result = collectEntriesForArtifact([
      { prNumber: 2, body: 'Zwei' },
      { prNumber: 25, body: 'Fuenfundzwanzig' },
      { prNumber: 1, body: 'Eins' },
      ...Array.from({ length: 22 }, (_, index) => ({
        prNumber: index + 3,
        body: `Eintrag ${index + 3}`,
      })),
    ]);

    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({ prNumber: 25, body: 'Fuenfundzwanzig' });
    expect(result.at(-1)?.prNumber).toBe(6);
  });

  it('collects artifact entries directly from the workspace changelog directory without git metadata', () => {
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-changelog-artifact-'));
    temporaryDirectories.push(rootDirectory);

    const entryDirectory = path.join(rootDirectory, 'docs', 'changelog', 'entries');
    fs.mkdirSync(entryDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(entryDirectory, 'pr-12.json'),
      JSON.stringify({ prNumber: 12, body: 'Eintrag 12' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(entryDirectory, 'pr-13.json'),
      JSON.stringify({ prNumber: 13, body: 'Eintrag 13' }),
      'utf8'
    );

    expect(collectEntriesFromWorkspaceRoot(rootDirectory)).toEqual([
      { prNumber: 13, body: 'Eintrag 13' },
      { prNumber: 12, body: 'Eintrag 12' },
    ]);
  });
});
