import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { adminExplorationStoryCatalogSnapshot } from './catalog.snapshot.js';
import type { AdminExplorationStoryCheckStatus, AdminExplorationStoryCoverage } from '../runtime/types.js';

export interface AdminExplorationStoryCheck {
  readonly coverage: AdminExplorationStoryCoverage;
  readonly notes: string;
  readonly status: AdminExplorationStoryCheckStatus;
}

export interface AdminExplorationStoryRecord {
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
  readonly studioCheck: AdminExplorationStoryCheck;
  readonly trigger: string;
}

export interface AdminExplorationStoryCatalogDocument {
  readonly description: string;
  readonly packageCount?: number;
  readonly packages: readonly AdminExplorationStoryPackage[];
  readonly scope: string;
  readonly totalStoryCount?: number;
  readonly updatedAt: string;
  readonly version: string;
}

interface AdminExplorationStoryPackage {
  readonly id: string;
  readonly stories: readonly AdminExplorationStoryPackageStory[];
  readonly title: string;
}

interface AdminExplorationStoryPackageStory {
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
  readonly studioCheck: AdminExplorationStoryCheck;
  readonly trigger: string;
}

export interface LoadedAdminExplorationStoryCatalog {
  readonly document: AdminExplorationStoryCatalogDocument;
  readonly storyIndex: ReadonlyMap<number, AdminExplorationStoryRecord>;
}

export interface AdminExplorationStoryCheckUpdate {
  readonly storyId: number;
  readonly studioCheck: AdminExplorationStoryCheck;
}

export interface AdminExplorationStoryCheckOverlayEntry extends AdminExplorationStoryCheckUpdate {
  readonly clusterId: string;
  readonly findings: readonly string[];
}

export interface AdminExplorationStoryCheckOverlayDocument {
  readonly generatedAt: string;
  readonly sourcePath: string;
  readonly stories: readonly AdminExplorationStoryCheckOverlayEntry[];
}

function createSnapshotDocument(): AdminExplorationStoryCatalogDocument {
  return {
    version: '2.7',
    scope: adminExplorationStoryCatalogSnapshot.scope,
    updatedAt: adminExplorationStoryCatalogSnapshot.updatedAt,
    description: 'Bundled AdminExploration story snapshot',
    packageCount: adminExplorationStoryCatalogSnapshot.packages.length,
    totalStoryCount: adminExplorationStoryCatalogSnapshot.packages.reduce((count, pkg) => count + pkg.stories.length, 0),
    packages: adminExplorationStoryCatalogSnapshot.packages.map((pkg) => ({
      id: pkg.id,
      title: pkg.id,
      stories: pkg.stories.map((story) => ({
        acceptanceCriteria: [...story.acceptanceCriteria],
        evidence: [],
        id: story.id,
        legacy: true,
        legacyId: story.id,
        packageId: story.packageId,
        preconditions: [],
        priority: 0,
        relatedPackageIds: [],
        role: story.role,
        story: story.story,
        studioCheck: {
          status: 'offen',
          coverage: 'nicht_geprueft',
          notes: '',
        },
        trigger: 'snapshot',
      })),
    })),
  };
}

function normalizeStoryRecord(
  packageTitle: string,
  story: AdminExplorationStoryPackageStory
): AdminExplorationStoryRecord {
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

export function loadAdminExplorationStoryCatalogFromFile(filePath: string): LoadedAdminExplorationStoryCatalog {
  const document = existsSync(filePath)
    ? (JSON.parse(readFileSync(filePath, 'utf8')) as AdminExplorationStoryCatalogDocument)
    : createSnapshotDocument();
  const storyIndex = new Map<number, AdminExplorationStoryRecord>();

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

export function writeAdminExplorationStoryCheckOverlay(
  filePath: string,
  overlay: AdminExplorationStoryCheckOverlayDocument
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(overlay, null, 2)}\n`, 'utf8');
}
