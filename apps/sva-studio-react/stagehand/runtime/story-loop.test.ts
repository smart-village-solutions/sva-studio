import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import type { StagehandAdminConfig } from './types.ts';
import { runStagehandStoryLoop } from './story-loop.ts';

const temporaryDirectories: string[] = [];

function createTempCatalogFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-'));
  temporaryDirectories.push(directory);
  const filePath = join(directory, 'user-stories.json');

  writeFileSync(
    filePath,
    JSON.stringify(
      {
        version: '2.7',
        scope: 'IAM',
        updatedAt: '2026-03-19',
        description: 'fixture',
        packages: [
          {
            id: 'IAM-P2',
            title: 'Onboarding und Einladung',
            stories: [
              {
                id: 18,
                role: 'Organisations-Admin',
                story: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
                packageId: 'IAM-P2',
                relatedPackageIds: [],
                legacy: true,
                trigger: 'fixture',
                preconditions: [],
                acceptanceCriteria: ['Ein neuer Nutzerzugang kann im Studio angelegt werden.'],
                evidence: ['Admin-UI'],
                studioCheck: {
                  status: 'offen',
                  coverage: 'nicht_geprueft',
                  notes: '',
                },
                legacyId: 11,
                priority: 1,
              },
            ],
          },
          {
            id: 'IAM-P5',
            title: 'Mandantenkontext und Isolation',
            stories: [
              {
                id: 37,
                role: 'Systembetreiber',
                story: 'Als Systembetreiber möchte ich Mandanten trennen können, damit Daten isoliert bleiben.',
                packageId: 'IAM-P5',
                relatedPackageIds: [],
                legacy: true,
                trigger: 'fixture',
                preconditions: [],
                acceptanceCriteria: ['Mandanten sind fachlich und technisch voneinander getrennt sichtbar.'],
                evidence: ['Negativtest'],
                studioCheck: {
                  status: 'offen',
                  coverage: 'nicht_geprueft',
                  notes: '',
                },
                legacyId: 25,
                priority: 3,
              },
            ],
          },
        ],
      },
      null,
      2
    ),
    'utf8'
  );

  return filePath;
}

function createConfig(): StagehandAdminConfig {
  return {
    admin: {
      username: 'admin-user',
      password: 'super-secret',
    },
    baseUrl: 'https://studio.example.test',
    mission: 'admin-users-overview',
    openAiApiKey: 'test-openai-key',
    runMode: 'story-loop',
    storyFilters: {
      clusters: [],
      packageIds: [],
      resume: false,
      storyIds: [],
    },
    tenant: {
      admin: {
        username: 'tenant-admin',
        password: 'tenant-secret',
      },
      baseUrl: 'https://de-musterhausen.example.test',
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('runStagehandStoryLoop', () => {
  it('classifies filtered stories, writes reports, and emits an overlay instead of mutating the catalog source', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-reports-'));
    temporaryDirectories.push(reportsDirectory);

    const result = await runStagehandStoryLoop(createConfig(), {
      generatedAt: '2026-05-16T18:00:00.000Z',
      reportsRoot: join(reportsDirectory, 'reports'),
      storySourcePath,
      executeCluster: async ({ cluster, stories }) => {
        if (cluster.id === 'tenant-user-create') {
          return stories.map((story) => ({
            storyId: story.id,
            status: 'erfuellt',
            coverage: 'vorhanden',
            findings: ['Neuer Nutzer wurde angelegt und in der Verwaltungsansicht gefunden.'],
            notes: 'Artefakte unter story-loop/tenant-user-create.',
          }));
        }

        return stories.map((story) => ({
          storyId: story.id,
            status: 'umgebung_unzureichend',
            coverage: 'nachweis_fehlend',
            findings: ['Kein sicherer lokaler Negativnachweis fuer tenant-uebergreifende Sichtpruefung verfuegbar.'],
            notes: 'Keine beobachtbare UI/API fuer tenant-uebergreifenden Negativtest.',
        }));
      },
    });

    expect(result.summary).toEqual({
      clusters: 2,
      storiesClassified: 2,
      storiesFailedEvidence: 0,
      storiesPassed: 1,
      storiesSkipped: 0,
    });

    const original = JSON.parse(readFileSync(storySourcePath, 'utf8')) as {
      packages: Array<{ stories: Array<{ id: number; studioCheck: { status: string; coverage: string; notes: string } }> }>;
    };
    const overlay = JSON.parse(readFileSync(result.artifacts.overlayPath, 'utf8')) as {
      stories: Array<{ storyId: number; clusterId: string; studioCheck: { status: string; coverage: string; notes: string } }>;
      sourcePath: string;
    };

    expect(original.packages[0]?.stories[0]?.studioCheck).toEqual({
      status: 'offen',
      coverage: 'nicht_geprueft',
      notes: '',
    });
    expect(overlay.sourcePath).toBe(storySourcePath);
    expect(overlay.stories.map((entry) => entry.storyId)).toEqual([18, 37]);
    expect(overlay.stories[1]?.studioCheck.status).toBe('umgebung_unzureichend');

    expect(JSON.parse(readFileSync(result.artifacts.statusPath, 'utf8'))).toMatchObject({
      overlayPath: result.artifacts.overlayPath,
      summary: {
        storiesPassed: 1,
        storiesFailedEvidence: 0,
      },
    });
    expect(readFileSync(result.artifacts.reportPath, 'utf8')).toContain('## Story-Ergebnisse');
    expect(readFileSync(result.artifacts.reportPath, 'utf8')).toContain('Umgebung unzureichend');
  });

  it('supports resume mode by skipping stories that are already classified', async () => {
    const storySourcePath = createTempCatalogFile();
    const reportsDirectory = mkdtempSync(join(tmpdir(), 'stagehand-story-loop-resume-'));
    temporaryDirectories.push(reportsDirectory);

    writeFileSync(
      storySourcePath,
      JSON.stringify(
        {
          version: '2.7',
          scope: 'IAM',
          updatedAt: '2026-03-19',
          description: 'fixture',
          packages: [
            {
              id: 'IAM-P2',
              title: 'Onboarding und Einladung',
              stories: [
                {
                  id: 18,
                  role: 'Organisations-Admin',
                  story: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
                  packageId: 'IAM-P2',
                  relatedPackageIds: [],
                  legacy: true,
                  trigger: 'fixture',
                  preconditions: [],
                  acceptanceCriteria: ['Ein neuer Nutzerzugang kann im Studio angelegt werden.'],
                  evidence: ['Admin-UI'],
                  studioCheck: {
                    status: 'erfuellt',
                    coverage: 'vorhanden',
                    notes: 'Bereits geprüft',
                  },
                  legacyId: 11,
                  priority: 1,
                },
              ],
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runStagehandStoryLoop(
      {
        ...createConfig(),
        storyFilters: {
          clusters: [],
          packageIds: [],
          resume: true,
          storyIds: [],
        },
      },
      {
        generatedAt: '2026-05-16T18:00:00.000Z',
        reportsRoot: join(reportsDirectory, 'reports'),
        storySourcePath,
        executeCluster: async () => {
          throw new Error('executeCluster should not be called for resumed stories');
        },
      }
    );

    expect(result.summary).toEqual({
      clusters: 0,
      storiesClassified: 0,
      storiesFailedEvidence: 0,
      storiesPassed: 0,
      storiesSkipped: 1,
    });
  });
});
