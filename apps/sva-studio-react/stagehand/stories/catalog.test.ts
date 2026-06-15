import { describe, expect, it } from 'vitest';

import { getStagehandMissionStories, loadStagehandStoryCatalog } from './catalog.ts';

describe('stagehand story catalog', () => {
  it('loads the curated IAM story basis from user-stories.json', () => {
    const catalog = loadStagehandStoryCatalog();

    expect(catalog.updatedAt).toBe('2026-03-19');
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
});
