import type { AdminExplorationStoryRecord } from '../stories/state.js';
import type { AdminExplorationStoryCheckStatus, AdminExplorationStoryCoverage } from './types.js';

type BrowserModule = typeof import('@playwright/test');

export interface AdminExplorationStoryCluster {
  readonly id: string;
  readonly reason: string;
  readonly stories: readonly AdminExplorationStoryRecord[];
}

export interface AdminExplorationStoryEvidence {
  readonly coverage: AdminExplorationStoryCoverage;
  readonly findings: readonly string[];
  readonly notes: string;
  readonly status: AdminExplorationStoryCheckStatus;
  readonly storyId: number;
}

export interface AdminExplorationStoryVerification {
  readonly environment: 'adequate' | 'insufficient';
  readonly negative: 'missing' | 'verified';
  readonly positive: 'missing' | 'verified';
}

export interface AdminExplorationStoryEvidenceInput {
  readonly coverage: AdminExplorationStoryCoverage;
  readonly findings: readonly string[];
  readonly notes: string;
  readonly storyId: number;
  readonly verification: AdminExplorationStoryVerification;
}

export interface AdminExplorationStoryLoopSummary {
  readonly clusters: number;
  readonly storiesClassified: number;
  readonly storiesFailedEvidence: number;
  readonly storiesPassed: number;
  readonly storiesSkipped: number;
}

export interface AdminExplorationStoryLoopResult {
  readonly artifacts: {
    readonly overlayPath: string;
    readonly reportPath: string;
    readonly statusPath: string;
    readonly transcriptPath: string;
  };
  readonly summary: AdminExplorationStoryLoopSummary;
}

export interface RunAdminExplorationStoryLoopOptions {
  readonly executeCluster?: (input: {
    cluster: AdminExplorationStoryCluster;
    stories: readonly AdminExplorationStoryRecord[];
  }) => Promise<readonly AdminExplorationStoryEvidenceInput[]>;
  readonly generatedAt?: string;
  readonly loadChromium?: () => Promise<BrowserModule['chromium']>;
  readonly reportsRoot: string;
  readonly storySourcePath: string;
}
export function defaultEvidenceForCluster(
  cluster: AdminExplorationStoryCluster
): readonly AdminExplorationStoryEvidenceInput[] {
  return cluster.stories.map((story) => ({
    storyId: story.id,
    coverage: 'nachweis_fehlend',
    notes: `Cluster ${cluster.id}: ${cluster.reason}`,
    findings: [
      'Für diese Story existiert im aktuellen lokalen AdminExploration-Ausbau noch kein belastbarer Vollnachweis.',
      `Grund: ${cluster.reason}`,
    ],
    verification: {
      environment: 'insufficient',
      negative: 'missing',
      positive: 'missing',
    },
  }));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return 'Unbekannter Clusterfehler ohne verwertbare Fehlermeldung.';
}

export function createFailedClusterEvidence(
  cluster: AdminExplorationStoryCluster,
  error: unknown
): readonly AdminExplorationStoryEvidenceInput[] {
  const errorMessage = toErrorMessage(error);

  return cluster.stories.map((story) => ({
    storyId: story.id,
    coverage: 'nachweis_fehlend',
    notes: `Cluster ${cluster.id} konnte nicht stabil ausgefuehrt werden.`,
    findings: [
      `Cluster ${cluster.id} ist vorzeitig fehlgeschlagen.`,
      `Fehler: ${errorMessage}`,
      `Grundkontext: ${cluster.reason}`,
    ],
    verification: {
      environment: 'insufficient',
      negative: 'missing',
      positive: 'missing',
    },
  }));
}

export function classifyStoryEvidence(
  input: AdminExplorationStoryEvidenceInput
): AdminExplorationStoryEvidence {
  if (input.verification.environment === 'insufficient') {
    return {
      ...input,
      status: 'umgebung_unzureichend',
    };
  }

  if (input.verification.positive === 'verified' && input.verification.negative === 'verified') {
    return {
      ...input,
      status: 'erfuellt',
    };
  }

  return {
    ...input,
    status: 'unklar',
  };
}
