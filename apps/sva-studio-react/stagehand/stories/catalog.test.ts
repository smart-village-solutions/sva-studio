import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { getStagehandMissionStories, loadStagehandStoryCatalog, loadStagehandStoryCatalogFromPath } from './catalog.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('stagehand story catalog', () => {
  it('loads the curated IAM story basis from user-stories.json', () => {
    const catalog = loadStagehandStoryCatalog();

    expect(catalog.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(catalog.scope).toBe('IAM');
    expect(catalog.missions['admin-users-overview'].map((story) => story.id)).toEqual([18, 19]);
    expect(catalog.missions['admin-user-permissions-inspection'].map((story) => story.id)).toEqual([23, 24, 25, 26]);
    expect(catalog.missions['admin-role-management-navigation'].map((story) => story.id)).toEqual([20, 21, 22, 27]);
  });

  it('returns rich story metadata with acceptance criteria for each mission', () => {
    const stories = getStagehandMissionStories('admin-users-overview');

    expect(stories).toHaveLength(2);
    expect(stories[0]).toMatchObject({
      id: 18,
      packageId: 'IAM-P2',
      title: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
    });
    expect(stories[0].acceptanceCriteria).toContain('Ein neuer Nutzerzugang kann im Studio angelegt werden.');
    expect(stories[1]).toMatchObject({
      id: 19,
      packageId: 'IAM-P3',
    });
    expect(stories[1].acceptanceCriteria).toContain(
      'Mandantenfremde Verwaltungsdaten erscheinen nicht in regulaeren Listen oder Details.'
    );
  });

  it('falls back to the bundled mission snapshot when the submodule file is unavailable', () => {
    const directory = mkdtempSync(join(tmpdir(), 'stagehand-story-catalog-missing-'));
    temporaryDirectories.push(directory);

    const catalog = loadStagehandStoryCatalogFromPath(join(directory, 'missing-user-stories.json'));

    expect(catalog.scope).toBe('IAM');
    expect(catalog.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(catalog.missions['admin-users-overview'].map((story) => story.id)).toEqual([18, 19]);
    expect(catalog.missions['admin-role-management-navigation'].map((story) => story.id)).toEqual([20, 21, 22, 27]);
  });
});
