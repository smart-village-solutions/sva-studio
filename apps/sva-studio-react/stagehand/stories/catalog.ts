import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StagehandMissionName } from '../runtime/types.js';

export interface StagehandStoryReference {
  readonly id: number;
  readonly packageId: string;
  readonly role: string;
  readonly title: string;
  readonly acceptanceCriteria: readonly string[];
}

export interface StagehandStoryCatalog {
  readonly scope: string;
  readonly updatedAt: string;
  readonly missions: Readonly<Record<StagehandMissionName, readonly StagehandStoryReference[]>>;
}

interface UserStoriesFile {
  readonly scope: string;
  readonly updatedAt: string;
  readonly packages: readonly UserStoriesPackage[];
}

interface UserStoriesPackage {
  readonly id: string;
  readonly stories: readonly UserStoryEntry[];
}

interface UserStoryEntry {
  readonly id: number;
  readonly packageId: string;
  readonly role: string;
  readonly story: string;
  readonly acceptanceCriteria: readonly string[];
}

const MISSION_STORY_IDS = {
  'admin-users-overview': [18, 19],
  'admin-user-permissions-inspection': [23, 24, 25, 26],
  'admin-role-management-navigation': [20, 21, 22, 27],
} as const satisfies Record<StagehandMissionName, readonly number[]>;

const USER_STORIES_FILE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json'
);

let cachedCatalog: StagehandStoryCatalog | null = null;

function parseUserStoriesFile(): UserStoriesFile {
  return JSON.parse(readFileSync(USER_STORIES_FILE_PATH, 'utf8')) as UserStoriesFile;
}

function normalizeStoryReference(story: UserStoryEntry): StagehandStoryReference {
  return {
    id: story.id,
    packageId: story.packageId,
    role: story.role,
    title: story.story,
    acceptanceCriteria: [...story.acceptanceCriteria],
  };
}

function createStoryIndex(packages: readonly UserStoriesPackage[]): ReadonlyMap<number, UserStoryEntry> {
  return new Map(
    packages.flatMap((entry) => entry.stories).map((story) => [story.id, story] as const)
  );
}

function getRequiredStory(storyIndex: ReadonlyMap<number, UserStoryEntry>, storyId: number): StagehandStoryReference {
  const story = storyIndex.get(storyId);

  if (story === undefined) {
    throw new Error(`Missing Stagehand story mapping for user story ${storyId}.`);
  }

  return normalizeStoryReference(story);
}

function buildCatalog(file: UserStoriesFile): StagehandStoryCatalog {
  const storyIndex = createStoryIndex(file.packages);

  return {
    scope: file.scope,
    updatedAt: file.updatedAt,
    missions: {
      'admin-users-overview': MISSION_STORY_IDS['admin-users-overview'].map((storyId) =>
        getRequiredStory(storyIndex, storyId)
      ),
      'admin-user-permissions-inspection': MISSION_STORY_IDS['admin-user-permissions-inspection'].map((storyId) =>
        getRequiredStory(storyIndex, storyId)
      ),
      'admin-role-management-navigation': MISSION_STORY_IDS['admin-role-management-navigation'].map((storyId) =>
        getRequiredStory(storyIndex, storyId)
      ),
    },
  };
}

export function loadStagehandStoryCatalog(): StagehandStoryCatalog {
  cachedCatalog ??= buildCatalog(parseUserStoriesFile());

  return cachedCatalog;
}

export function getStagehandMissionStories(missionName: StagehandMissionName): readonly StagehandStoryReference[] {
  return loadStagehandStoryCatalog().missions[missionName];
}
