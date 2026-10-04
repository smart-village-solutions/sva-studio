import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AdminExplorationMissionName } from '../runtime/types.js';
import { adminExplorationStoryCatalogSnapshot } from './catalog.snapshot.js';

export interface AdminExplorationStoryReference {
  readonly id: number;
  readonly packageId: string;
  readonly role: string;
  readonly title: string;
  readonly acceptanceCriteria: readonly string[];
}

export interface AdminExplorationStoryCatalog {
  readonly scope: string;
  readonly updatedAt: string;
  readonly missions: Readonly<Record<AdminExplorationMissionName, readonly AdminExplorationStoryReference[]>>;
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
} as const satisfies Record<AdminExplorationMissionName, readonly number[]>;

const USER_STORIES_FILE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../concepts/konzeption-cms-v2/02_Anforderungen/user-stories.json'
);

let cachedCatalog: AdminExplorationStoryCatalog | null = null;

function parseUserStoriesFile(filePath: string): UserStoriesFile {
  return JSON.parse(readFileSync(filePath, 'utf8')) as UserStoriesFile;
}

function resolveUserStoriesFile(filePath: string): UserStoriesFile {
  if (existsSync(filePath)) {
    return parseUserStoriesFile(filePath);
  }

  return adminExplorationStoryCatalogSnapshot satisfies UserStoriesFile;
}

function normalizeStoryReference(story: UserStoryEntry): AdminExplorationStoryReference {
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

function getRequiredStory(storyIndex: ReadonlyMap<number, UserStoryEntry>, storyId: number): AdminExplorationStoryReference {
  const story = storyIndex.get(storyId);

  if (story === undefined) {
    throw new Error(`Missing AdminExploration story mapping for user story ${storyId}.`);
  }

  return normalizeStoryReference(story);
}

function buildCatalog(file: UserStoriesFile): AdminExplorationStoryCatalog {
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

export function loadAdminExplorationStoryCatalog(): AdminExplorationStoryCatalog {
  cachedCatalog ??= buildCatalog(resolveUserStoriesFile(USER_STORIES_FILE_PATH));

  return cachedCatalog;
}

export function loadAdminExplorationStoryCatalogFromPath(filePath: string): AdminExplorationStoryCatalog {
  return buildCatalog(resolveUserStoriesFile(filePath));
}

export function getAdminExplorationMissionStories(missionName: AdminExplorationMissionName): readonly AdminExplorationStoryReference[] {
  return loadAdminExplorationStoryCatalog().missions[missionName];
}
