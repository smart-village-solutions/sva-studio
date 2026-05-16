import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { StagehandStoryCheckStatus, StagehandStoryCoverage } from '../runtime/types.js';

export interface StagehandStoryCheck {
  readonly coverage: StagehandStoryCoverage;
  readonly notes: string;
  readonly status: StagehandStoryCheckStatus;
}

export interface StagehandStoryRecord {
  readonly acceptanceCriteria: readonly string[];
  readonly evidence: readonly string[];
  readonly id: number;
  readonly legacy: boolean;
  readonly legacyId: number;
  readonly packageId: string;
  readonly packageTitle: string;
  readonly preconditions: readonly string[];
  readonly priority: number;
  readonly relatedPackageIds: readonly string[];
  readonly role: string;
  readonly story: string;
  readonly studioCheck: StagehandStoryCheck;
  readonly trigger: string;
}

export interface StagehandStoryCatalogDocument {
  readonly description: string;
  readonly packageCount?: number;
  readonly packages: readonly StagehandStoryPackage[];
  readonly scope: string;
  readonly totalStoryCount?: number;
  readonly updatedAt: string;
  readonly version: string;
}

interface StagehandStoryPackage {
  readonly id: string;
  readonly stories: readonly StagehandStoryPackageStory[];
  readonly title: string;
}

interface StagehandStoryPackageStory {
  readonly acceptanceCriteria: readonly string[];
  readonly evidence: readonly string[];
  readonly id: number;
  readonly legacy: boolean;
  readonly legacyId: number;
  readonly packageId: string;
  readonly preconditions: readonly string[];
  readonly priority: number;
  readonly relatedPackageIds: readonly string[];
  readonly role: string;
  readonly story: string;
  readonly studioCheck: StagehandStoryCheck;
  readonly trigger: string;
}

export interface LoadedStagehandStoryCatalog {
  readonly document: StagehandStoryCatalogDocument;
  readonly storyIndex: ReadonlyMap<number, StagehandStoryRecord>;
}

export interface StagehandStoryCheckUpdate {
  readonly storyId: number;
  readonly studioCheck: StagehandStoryCheck;
}

export interface StagehandStoryCheckOverlayEntry extends StagehandStoryCheckUpdate {
  readonly clusterId: string;
  readonly findings: readonly string[];
}

export interface StagehandStoryCheckOverlayDocument {
  readonly generatedAt: string;
  readonly sourcePath: string;
  readonly stories: readonly StagehandStoryCheckOverlayEntry[];
}

function normalizeStoryRecord(
  packageTitle: string,
  story: StagehandStoryPackageStory
): StagehandStoryRecord {
  return {
    acceptanceCriteria: [...story.acceptanceCriteria],
    evidence: [...story.evidence],
    id: story.id,
    legacy: story.legacy,
    legacyId: story.legacyId,
    packageId: story.packageId,
    packageTitle,
    preconditions: [...story.preconditions],
    priority: story.priority,
    relatedPackageIds: [...story.relatedPackageIds],
    role: story.role,
    story: story.story,
    studioCheck: {
      ...story.studioCheck,
    },
    trigger: story.trigger,
  };
}

export function loadStagehandStoryCatalogFromFile(filePath: string): LoadedStagehandStoryCatalog {
  const document = JSON.parse(readFileSync(filePath, 'utf8')) as StagehandStoryCatalogDocument;
  const storyIndex = new Map<number, StagehandStoryRecord>();

  for (const pkg of document.packages) {
    for (const story of pkg.stories) {
      storyIndex.set(story.id, normalizeStoryRecord(pkg.title, story));
    }
  }

  return {
    document,
    storyIndex,
  };
}

export function writeStagehandStoryCheckOverlay(
  filePath: string,
  overlay: StagehandStoryCheckOverlayDocument
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(overlay, null, 2)}\n`, 'utf8');
}
