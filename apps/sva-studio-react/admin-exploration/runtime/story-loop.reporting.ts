import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  writeAdminExplorationStoryCheckOverlay,
  type AdminExplorationStoryCheck,
  type AdminExplorationStoryRecord,
} from '../stories/state.js';
import { toPortableArtifactPath } from '../reporting/path-utils.js';
import type { AdminExplorationStoryCheckStatus, AdminExplorationStoryCoverage } from './types.js';
import type {
  AdminExplorationStoryCluster,
  AdminExplorationStoryEvidence,
  AdminExplorationStoryLoopResult,
  AdminExplorationStoryLoopSummary,
} from './story-loop.evidence.js';

interface StoryLoopAggregateStatus {
  readonly generatedAt: string;
  readonly overlayPath: string;
  readonly stories: readonly {
    readonly coverage: AdminExplorationStoryCoverage;
    readonly findings: readonly string[];
    readonly notes: string;
    readonly status: AdminExplorationStoryCheckStatus;
    readonly storyId: number;
  }[];
  readonly summary: AdminExplorationStoryLoopSummary;
  readonly transcriptPath: string;
}

export function createAggregateArtifacts(reportsRoot: string) {
  const loopDirectory = join(reportsRoot, 'story-loop');

  return {
    overlayPath: join(loopDirectory, 'overlay.json'),
    reportPath: join(loopDirectory, 'report.md'),
    statusPath: join(loopDirectory, 'status.json'),
    transcriptPath: join(loopDirectory, 'transcript.jsonl'),
  };
}

export function createSummary(
  clusters: readonly AdminExplorationStoryCluster[],
  evidence: readonly AdminExplorationStoryEvidence[],
  skippedStories: number
): AdminExplorationStoryLoopSummary {
  const storiesPassed = evidence.filter((entry) => entry.status === 'erfuellt').length;
  const storiesFailedEvidence = evidence.filter((entry) => entry.status === 'unklar').length;

  return {
    clusters: clusters.length,
    storiesClassified: evidence.length,
    storiesFailedEvidence,
    storiesPassed,
    storiesSkipped: skippedStories,
  };
}

function createAggregateMarkdown(
  generatedAt: string,
  summary: AdminExplorationStoryLoopSummary,
  evidence: readonly AdminExplorationStoryEvidence[],
  stories: ReadonlyMap<number, AdminExplorationStoryRecord>,
  transcriptPath: string
): string {
  return [
    '# AdminExploration-Story-Loop',
    '',
    `Erstellt am: \`${generatedAt}\``,
    `Verarbeitete Stories: \`${summary.storiesClassified}\``,
    `Erfüllt: \`${summary.storiesPassed}\``,
    `Unklar / Lücke: \`${summary.storiesFailedEvidence}\``,
    `Umgebung unzureichend: \`${evidence.filter((entry) => entry.status === 'umgebung_unzureichend').length}\``,
    `Übersprungen: \`${summary.storiesSkipped}\``,
    '',
    '## Story-Ergebnisse',
    ...(evidence.length === 0
      ? ['- Keine']
      : evidence.flatMap((entry) => {
          const story = stories.get(entry.storyId);
          const title = story?.story ?? `Story ${entry.storyId}`;

          return [
            `- ${story?.packageId ?? 'IAM'} / Story ${entry.storyId}: ${title}`,
            `  - Status: ${entry.status}`,
            `  - Coverage: ${entry.coverage}`,
            `  - Notes: ${entry.notes}`,
            ...entry.findings.map((finding) => `  - Finding: ${finding}`),
          ];
        })),
    '',
    '## Transkript',
    '```text',
    transcriptPath,
    '```',
  ].join('\n');
}

export function writeStoryLoopArtifacts(
  artifacts: AdminExplorationStoryLoopResult['artifacts'],
  generatedAt: string,
  evidence: readonly AdminExplorationStoryEvidence[],
  clusters: readonly AdminExplorationStoryCluster[],
  summary: AdminExplorationStoryLoopSummary,
  stories: ReadonlyMap<number, AdminExplorationStoryRecord>,
  storySourcePath: string
): void {
  const clusterByStoryId = new Map(
    clusters.flatMap((cluster) => cluster.stories.map((story) => [story.id, cluster.id] as const))
  );

  writeAdminExplorationStoryCheckOverlay(artifacts.overlayPath, {
    generatedAt,
    sourcePath: toPortableArtifactPath(storySourcePath),
    stories: evidence.map((entry) => ({
      clusterId: clusterByStoryId.get(entry.storyId) ?? 'unknown',
      storyId: entry.storyId,
      studioCheck: {
        status: entry.status,
        coverage: entry.coverage,
        notes: entry.notes,
      } satisfies AdminExplorationStoryCheck,
      findings: entry.findings,
    })),
  });

  mkdirSync(dirname(artifacts.statusPath), { recursive: true });
  mkdirSync(dirname(artifacts.reportPath), { recursive: true });
  mkdirSync(dirname(artifacts.transcriptPath), { recursive: true });

  const aggregateStatus: StoryLoopAggregateStatus = {
    generatedAt,
    overlayPath: toPortableArtifactPath(artifacts.overlayPath),
    stories: evidence.map((entry) => ({
      coverage: entry.coverage,
      findings: entry.findings,
      notes: entry.notes,
      status: entry.status,
      storyId: entry.storyId,
    })),
    summary,
    transcriptPath: toPortableArtifactPath(artifacts.transcriptPath),
  };

  writeFileSync(artifacts.statusPath, `${JSON.stringify(aggregateStatus, null, 2)}\n`, 'utf8');
  writeFileSync(
    artifacts.reportPath,
    `${createAggregateMarkdown(
      generatedAt,
      summary,
      evidence,
      stories,
      toPortableArtifactPath(artifacts.transcriptPath)
    )}\n`,
    'utf8'
  );
  writeFileSync(
    artifacts.transcriptPath,
    `${evidence
      .map((entry) =>
        JSON.stringify({
          storyId: entry.storyId,
          status: entry.status,
          coverage: entry.coverage,
          findings: entry.findings,
        })
      )
      .join('\n')}\n`,
    'utf8'
  );
}
