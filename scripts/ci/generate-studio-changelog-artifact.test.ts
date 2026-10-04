import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectEntriesForArtifact,
  collectEntriesFromWorkspaceRoot,
  findLatestStableStudioTag,
  renderStudioReleaseNotes,
  assertPrebuiltStudioChangelog,
} from './generate-studio-changelog-artifact.ts';

const temporaryDirectories: string[] = [];
const git = (directory: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();

const commitEntries = (directory: string, message: string): string => {
  git(directory, 'add', 'docs/changelog/entries');
  git(directory, '-c', 'user.name=Studio Test', '-c', 'user.email=studio@example.test', 'commit', '-qm', message);
  return git(directory, 'rev-parse', 'HEAD');
};

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

  it('selects only entries added since the latest stable Production tag', () => {
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-changelog-artifact-'));
    temporaryDirectories.push(rootDirectory);
    git(rootDirectory, 'init', '-q');

    const entryDirectory = path.join(rootDirectory, 'docs', 'changelog', 'entries');
    fs.mkdirSync(entryDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(entryDirectory, 'pr-12.json'),
      JSON.stringify({ prNumber: 12, body: 'Eintrag 12' }),
      'utf8'
    );
    commitEntries(rootDirectory, 'Production baseline');
    expect(findLatestStableStudioTag(rootDirectory)).toBeNull();
    expect(collectEntriesFromWorkspaceRoot(rootDirectory)).toEqual([]);
    git(rootDirectory, 'tag', 'studio-v0.10.4');
    git(rootDirectory, 'tag', 'studio-v0.11.0-beta.1');
    fs.writeFileSync(path.join(entryDirectory, 'pr-13.json'), JSON.stringify({ prNumber: 13, body: 'Eintrag 13' }));
    const candidate = commitEntries(rootDirectory, 'Next release');
    fs.writeFileSync(path.join(entryDirectory, 'pr-99.json'), JSON.stringify({ prNumber: 99, body: 'Future feature' }));
    commitEntries(rootDirectory, 'Future main work');

    expect(findLatestStableStudioTag(rootDirectory)).toBe('studio-v0.10.4');
    expect(collectEntriesFromWorkspaceRoot(rootDirectory, 'studio-v0.10.4', candidate))
      .toEqual([{ prNumber: 13, body: 'Eintrag 13' }]);
    expect(() => collectEntriesFromWorkspaceRoot(rootDirectory, 'studio-v0.99.0', candidate)).toThrow();
    expect(() => collectEntriesFromWorkspaceRoot(rootDirectory, 'studio-v0.10.4', 'feature/foreign'))
      .toThrow(/Ungültige Studio-Release-Revision/u);
  });

  it('does not announce a released hotfix again on the next main release', () => {
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-changelog-hotfix-'));
    temporaryDirectories.push(rootDirectory);
    git(rootDirectory, 'init', '-q');
    const entryDirectory = path.join(rootDirectory, 'docs', 'changelog', 'entries');
    fs.mkdirSync(entryDirectory, { recursive: true });
    fs.writeFileSync(path.join(entryDirectory, 'pr-12.json'), JSON.stringify({ prNumber: 12, body: 'Baseline' }));
    const baseline = commitEntries(rootDirectory, 'Production baseline');
    git(rootDirectory, 'tag', 'studio-v0.10.4');
    fs.writeFileSync(path.join(entryDirectory, 'pr-20.json'), JSON.stringify({ prNumber: 20, body: 'Main feature' }));
    const mainCandidate = commitEntries(rootDirectory, 'Main feature');
    git(rootDirectory, 'checkout', '-qb', 'hotfix', baseline);
    fs.writeFileSync(path.join(entryDirectory, 'pr-15.json'), JSON.stringify({ prNumber: 15, body: 'Hotfix' }));
    commitEntries(rootDirectory, 'Hotfix');
    git(rootDirectory, 'tag', 'studio-v0.10.5');
    git(rootDirectory, 'checkout', '-q', mainCandidate);
    fs.writeFileSync(path.join(entryDirectory, 'pr-15.json'), JSON.stringify({ prNumber: 15, body: 'Hotfix' }));
    commitEntries(rootDirectory, 'Merge hotfix into main');

    expect(findLatestStableStudioTag(rootDirectory)).toBe('studio-v0.10.5');
    expect(collectEntriesFromWorkspaceRoot(rootDirectory)).toEqual([{ prNumber: 20, body: 'Main feature' }]);
  });

  it('renders release notes from the same selected entries', () => {
    expect(renderStudioReleaseNotes([{ prNumber: 20, body: 'Neue Suche' }]))
      .toBe('### PR #20\n\nNeue Suche\n');
    expect(renderStudioReleaseNotes(Array.from({ length: 21 }, (_, index) => ({
      prNumber: index + 1,
      body: `Änderung ${index + 1}`,
    })))).toContain('### PR #21');
  });

  it('requires the prepared container artifact to match the source commit', () => {
    const sourceCommit = 'a'.repeat(40);
    const artifact = JSON.stringify({ sourceCommit, entries: [{ prNumber: 20, body: 'Neue Suche' }] });
    expect(() => assertPrebuiltStudioChangelog(artifact, sourceCommit)).not.toThrow();
    expect(() => assertPrebuiltStudioChangelog(artifact, 'b'.repeat(40))).toThrow(/Image-Quellcommit/u);
    expect(() => assertPrebuiltStudioChangelog(JSON.stringify({ sourceCommit, entries: [{}] }), sourceCommit))
      .toThrow(/Image-Quellcommit/u);
  });
});
