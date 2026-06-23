import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { loadStagehandStoryCatalogFromFile, writeStagehandStoryCheckOverlay } from './state.ts';

const temporaryDirectories: string[] = [];

function createTempCatalogFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stagehand-story-state-'));
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

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('stagehand story state', () => {
  it('loads stories from a custom catalog file', () => {
    const filePath = createTempCatalogFile();

    const catalog = loadStagehandStoryCatalogFromFile(filePath);

    expect(catalog.storyIndex.get(18)?.packageId).toBe('IAM-P2');
    expect(catalog.storyIndex.get(37)?.packageId).toBe('IAM-P5');
  });

  it('falls back to the bundled snapshot when the source file is missing', () => {
    const filePath = join(tmpdir(), `stagehand-story-missing-${Date.now()}.json`);

    const catalog = loadStagehandStoryCatalogFromFile(filePath);

    expect(catalog.document.description).toBe('Bundled Stagehand story snapshot');
    expect(catalog.storyIndex.get(18)?.packageId).toBe('IAM-P2');
  });

  it('writes an overlay without mutating the source catalog', () => {
    const filePath = createTempCatalogFile();
    const overlayPath = join(dirname(filePath), 'stagehand-story-overlay.json');

    writeStagehandStoryCheckOverlay(overlayPath, {
      generatedAt: '2026-05-16T18:00:00.000Z',
      sourcePath: filePath,
      stories: [
        {
          clusterId: 'tenant-user-create',
          storyId: 18,
          studioCheck: {
            status: 'erfuellt',
            coverage: 'vorhanden',
            notes: 'Artefakt: report.md',
          },
          findings: ['Nutzer im Mandanten angelegt.'],
        },
        {
          clusterId: 'tenant-isolation',
          storyId: 37,
          studioCheck: {
            status: 'umgebung_unzureichend',
            coverage: 'nachweis_fehlend',
            notes: 'Kein lokaler Nachweis fuer tenant-uebergreifenden Negativtest.',
          },
          findings: ['Negativnachweis lokal nicht ehrlich reproduzierbar.'],
        },
      ],
    });

    const original = JSON.parse(readFileSync(filePath, 'utf8')) as {
      packages: Array<{ stories: Array<{ id: number; studioCheck: { status: string; coverage: string; notes: string } }> }>;
    };
    const overlay = JSON.parse(readFileSync(overlayPath, 'utf8')) as {
      sourcePath: string;
      stories: Array<{ storyId: number; clusterId: string; studioCheck: { status: string; coverage: string; notes: string } }>;
    };

    expect(original.packages[0]?.stories[0]?.studioCheck).toEqual({
      status: 'offen',
      coverage: 'nicht_geprueft',
      notes: '',
    });
    expect(overlay.sourcePath).toBe(filePath);
    expect(overlay.stories[1]?.studioCheck.status).toBe('umgebung_unzureichend');
  });

  it('creates snapshot metadata when the source file is missing', () => {
    const filePath = join(tmpdir(), `stagehand-story-missing-metadata-${Date.now()}.json`);

    const catalog = loadStagehandStoryCatalogFromFile(filePath);

    expect(catalog.document.packageCount).toBeGreaterThan(0);
    expect(catalog.document.totalStoryCount).toBeGreaterThan(0);
  });
});
