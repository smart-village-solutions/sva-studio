import {
  loadAdminExplorationStoryCatalogFromFile,
  type AdminExplorationStoryRecord,
} from '../stories/state.js';
import { buildAdminExplorationStoryClusters } from './clusters.js';
import { loadChromium } from './browser.js';
import type { AdminExplorationConfig } from './types.js';
import {
  defaultEvidenceForCluster,
  createFailedClusterEvidence,
  classifyStoryEvidence,
  type AdminExplorationStoryCluster,
  type AdminExplorationStoryEvidenceInput,
  type AdminExplorationStoryLoopResult,
  type RunAdminExplorationStoryLoopOptions,
} from './story-loop.evidence.js';
import {
  createAggregateArtifacts,
  createSummary,
  writeStoryLoopArtifacts,
} from './story-loop.reporting.js';
import {
  executeTenantUserCreateCluster,
  executeTenantIsolationCluster,
} from './story-loop.tenant-clusters.js';
import { executeRoleAndPermissionManagementCluster } from './story-loop.roles.js';

export { classifyStoryEvidence };
export type {
  AdminExplorationStoryCluster,
  AdminExplorationStoryEvidence,
  AdminExplorationStoryVerification,
  AdminExplorationStoryEvidenceInput,
  AdminExplorationStoryLoopSummary,
  AdminExplorationStoryLoopResult,
  RunAdminExplorationStoryLoopOptions,
} from './story-loop.evidence.js';

type BrowserModule = typeof import('@playwright/test');

function shouldSkipStory(
  config: AdminExplorationConfig,
  story: AdminExplorationStoryRecord
): boolean {
  if (config.storyFilters.resume && story.studioCheck.status !== 'offen') {
    return true;
  }

  if (
    config.storyFilters.storyIds.length > 0 &&
    config.storyFilters.storyIds.includes(story.id) === false
  ) {
    return true;
  }

  if (
    config.storyFilters.packageIds.length > 0 &&
    config.storyFilters.packageIds.includes(story.packageId) === false
  ) {
    return true;
  }

  return false;
}

function buildClusters(
  config: AdminExplorationConfig,
  stories: readonly AdminExplorationStoryRecord[]
): AdminExplorationStoryCluster[] {
  return buildAdminExplorationStoryClusters(
    stories.filter((story) => shouldSkipStory(config, story) === false)
  )
    .filter(
      (cluster) =>
        config.storyFilters.clusters.length === 0 ||
        config.storyFilters.clusters.includes(cluster.definition.id)
    )
    .map((cluster) => ({
      id: cluster.definition.id,
      reason: cluster.definition.reason,
      stories: cluster.stories,
    }));
}

function validateRequestedIds<T extends string | number>(
  requested: readonly T[],
  available: readonly T[],
  filterName: string
): void {
  const availableIds = new Set(available);
  const missingIds = requested.filter((id) => !availableIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(
      `AdminExploration ${filterName} filter matched no catalog entries: ${missingIds.join(', ')}`
    );
  }
}

function validateRequestedStoryFilters(
  config: AdminExplorationConfig,
  stories: readonly AdminExplorationStoryRecord[]
): void {
  validateRequestedIds(
    config.storyFilters.storyIds,
    stories.map((story) => story.id),
    'story id'
  );
  validateRequestedIds(
    config.storyFilters.packageIds,
    stories.map((story) => story.packageId),
    'package'
  );
}

async function executeDefaultCluster(
  config: AdminExplorationConfig,
  cluster: AdminExplorationStoryCluster,
  chromiumFactory: () => Promise<BrowserModule['chromium']>
): Promise<readonly AdminExplorationStoryEvidenceInput[]> {
  if (cluster.id === 'tenant-user-create') {
    return executeTenantUserCreateCluster(config, cluster, chromiumFactory);
  }

  if (cluster.id === 'tenant-isolation') {
    return executeTenantIsolationCluster(config, cluster, chromiumFactory);
  }

  if (cluster.id === 'role-and-permission-management') {
    return executeRoleAndPermissionManagementCluster(config, cluster, chromiumFactory);
  }

  return defaultEvidenceForCluster(cluster);
}

export async function runAdminExplorationStoryLoop(
  config: AdminExplorationConfig,
  options: RunAdminExplorationStoryLoopOptions
): Promise<AdminExplorationStoryLoopResult> {
  const catalog = loadAdminExplorationStoryCatalogFromFile(options.storySourcePath);
  const stories = [...catalog.storyIndex.values()].sort((left, right) => left.id - right.id);
  validateRequestedStoryFilters(config, stories);
  const eligibleStories = stories.filter((story) => shouldSkipStory(config, story) === false);
  const clusters = buildClusters(config, stories);

  if (config.storyFilters.clusters.length > 0 && clusters.length === 0) {
    throw new Error(
      `AdminExploration cluster filter matched no eligible stories: ${config.storyFilters.clusters.join(', ')}`
    );
  }

  const storiesCoveredByClusters = new Set(
    clusters.flatMap((cluster) => cluster.stories.map((story) => story.id))
  );
  const resumeSkippedStories = stories.filter((story) => shouldSkipStory(config, story)).length;
  const filteredOutStories = eligibleStories.length - storiesCoveredByClusters.size;
  const skippedStories = resumeSkippedStories + filteredOutStories;
  const chromiumFactory = options.loadChromium ?? loadChromium;
  const executeCluster =
    options.executeCluster ??
    (async ({ cluster }) => executeDefaultCluster(config, cluster, chromiumFactory));
  const evidence = (
    await Promise.all(
      clusters.map(async (cluster) => {
        try {
          return await executeCluster({ cluster, stories: cluster.stories });
        } catch (error) {
          return createFailedClusterEvidence(cluster, error);
        }
      })
    )
  )
    .flat()
    .map((entry) => classifyStoryEvidence(entry));
  const summary = createSummary(clusters, evidence, skippedStories);
  const artifacts = createAggregateArtifacts(options.reportsRoot);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  writeStoryLoopArtifacts(
    artifacts,
    generatedAt,
    evidence,
    clusters,
    summary,
    catalog.storyIndex,
    options.storySourcePath
  );

  return {
    artifacts,
    summary,
  };
}
