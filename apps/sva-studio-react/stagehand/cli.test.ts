import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { runStagehandAdminCli } from './cli.ts';

const temporaryDirectories: string[] = [];

function createTempReportsRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stagehand-admin-cli-'));
  temporaryDirectories.push(directory);

  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('runStagehandAdminCli', () => {
  it('returns READY JSON payload, passes admin-users-overview, and writes stable artifacts for a reachable users page', async () => {
    const reportsRoot = createTempReportsRoot();
    const result = await runStagehandAdminCli(
      {
        STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test',
        STAGEHAND_ADMIN_USERNAME: 'admin-user',
        STAGEHAND_ADMIN_PASSWORD: 'super-secret',
        STAGEHAND_ADMIN_MISSION: 'admin-users-overview',
        OPENAI_API_KEY: 'test-openai-key',
      },
      {
        fetchImpl: async (input: string | URL | Request) => {
          const url = String(input);

          if (url === 'https://studio.example.test') {
            return new Response('<html><body>ready</body></html>', { status: 200 });
          }

          if (url === 'https://studio.example.test/admin/users') {
            return new Response('<main><h1>User Management</h1><table aria-label="Users table"></table></main>', {
              status: 200,
              headers: { 'content-type': 'text/html; charset=utf-8' },
            });
          }

          throw new Error(`Unexpected URL: ${url}`);
        },
        generatedAt: '2026-05-16T12:00:00.000Z',
        reportsRoot,
      }
    );

    expect(result).toEqual({
      exitCode: 0,
      stream: 'stdout',
      payload: {
        status: 'READY',
        runMode: 'mission',
        mission: 'admin-users-overview',
        baseUrl: 'https://studio.example.test',
        adminUsername: 'admin-user',
        missionStatus: 'passed',
        reportPath: join(reportsRoot, 'admin-users-overview', 'report.md'),
        startUrl: 'https://studio.example.test/admin/users',
        statusPath: join(reportsRoot, 'admin-users-overview', 'status.json'),
        transcriptPath: join(reportsRoot, 'admin-users-overview', 'transcript.jsonl'),
      },
    });

    expect(result.payload.status).toBe('READY');
    if (result.payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(existsSync(result.payload.statusPath)).toBe(true);
    expect(existsSync(result.payload.reportPath)).toBe(true);
    expect(existsSync(result.payload.transcriptPath)).toBe(true);

    expect(JSON.parse(readFileSync(result.payload.statusPath, 'utf8'))).toEqual({
      generatedAt: '2026-05-16T12:00:00.000Z',
      mission: 'admin-users-overview',
      status: 'passed',
      stories: [
        {
          id: 18,
          packageId: 'IAM-P2',
          role: 'Organisations-Admin',
          title: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
          acceptanceCriteria: [
            'Ein neuer Nutzerzugang kann im Studio angelegt werden.',
            'Der Zugang ist einer Organisation oder einem fachlichen Kontext zuordenbar.',
            'Nach dem Anlegen ist der neue Nutzer in der Verwaltungsansicht auffindbar.',
          ],
        },
        {
          id: 19,
          packageId: 'IAM-P3',
          role: 'Organisations-Admin',
          title:
            'Als Organisations-Admin möchte ich nur Nutzer, Rollen, Gruppen und Rechtstexte meines Mandanten sehen, damit Daten sauber getrennt bleiben.',
          acceptanceCriteria: [
            'Im aktiven Mandanten werden nur dessen Nutzer, Rollen, Gruppen und Rechtstexte angezeigt.',
            'Mandantenfremde Verwaltungsdaten erscheinen nicht in regulaeren Listen oder Details.',
            'Die Sicht ist fuer den Organisations-Admin ausreichend klar, um saubere Trennung zu pruefen.',
          ],
        },
      ],
      findings: [
        'Lokale Readiness erfolgreich: https://studio.example.test (HTTP 200).',
        'Start-URL geöffnet: https://studio.example.test/admin/users',
        'Story-Basis geladen: IAM-P2#18, IAM-P3#19.',
        'Benutzerverwaltung erkannt: Users table.',
      ],
      screenshots: [],
      transcriptPath: join(reportsRoot, 'admin-users-overview', 'transcript.jsonl'),
    });
    expect(readFileSync(result.payload.reportPath, 'utf8')).toContain('# Stagehand-Missionsbericht');
    expect(readFileSync(result.payload.reportPath, 'utf8')).toContain('## Story-Basis');
    expect(readFileSync(result.payload.transcriptPath, 'utf8')).toContain('stagehand mission bootstrap pending');
  });

  it('returns READY with blocked mission status when the app redirects back to Login', async () => {
    const reportsRoot = createTempReportsRoot();
    const result = await runStagehandAdminCli(
      {
        STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test',
        STAGEHAND_ADMIN_USERNAME: 'admin-user',
        STAGEHAND_ADMIN_PASSWORD: 'super-secret',
        STAGEHAND_ADMIN_MISSION: 'admin-users-overview',
        OPENAI_API_KEY: 'test-openai-key',
      },
      {
        fetchImpl: async (input: string | URL | Request) => {
          const url = String(input);

          if (url === 'https://studio.example.test') {
            return new Response('<html><body>ready</body></html>', { status: 200 });
          }

          if (url === 'https://studio.example.test/admin/users') {
            return new Response('', {
              status: 302,
              headers: { location: '/auth/login?returnTo=%2Fadmin%2Fusers' },
            });
          }

          throw new Error(`Unexpected URL: ${url}`);
        },
        generatedAt: '2026-05-16T12:00:00.000Z',
        reportsRoot,
      }
    );

    expect(result).toEqual({
      exitCode: 0,
      stream: 'stdout',
      payload: {
        status: 'READY',
        runMode: 'mission',
        mission: 'admin-users-overview',
        baseUrl: 'https://studio.example.test',
        adminUsername: 'admin-user',
        missionStatus: 'blocked',
        reportPath: join(reportsRoot, 'admin-users-overview', 'report.md'),
        startUrl: 'https://studio.example.test/admin/users',
        statusPath: join(reportsRoot, 'admin-users-overview', 'status.json'),
        transcriptPath: join(reportsRoot, 'admin-users-overview', 'transcript.jsonl'),
      },
    });

    expect(result.payload.status).toBe('READY');
    if (result.payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(JSON.parse(readFileSync(result.payload.statusPath, 'utf8'))).toEqual({
      generatedAt: '2026-05-16T12:00:00.000Z',
      mission: 'admin-users-overview',
      status: 'blocked',
      stories: [
        {
          id: 18,
          packageId: 'IAM-P2',
          role: 'Organisations-Admin',
          title: 'Als Organisations-Admin möchte ich neue Nutzer anlegen können, damit ich mein Team verwalten kann.',
          acceptanceCriteria: [
            'Ein neuer Nutzerzugang kann im Studio angelegt werden.',
            'Der Zugang ist einer Organisation oder einem fachlichen Kontext zuordenbar.',
            'Nach dem Anlegen ist der neue Nutzer in der Verwaltungsansicht auffindbar.',
          ],
        },
        {
          id: 19,
          packageId: 'IAM-P3',
          role: 'Organisations-Admin',
          title:
            'Als Organisations-Admin möchte ich nur Nutzer, Rollen, Gruppen und Rechtstexte meines Mandanten sehen, damit Daten sauber getrennt bleiben.',
          acceptanceCriteria: [
            'Im aktiven Mandanten werden nur dessen Nutzer, Rollen, Gruppen und Rechtstexte angezeigt.',
            'Mandantenfremde Verwaltungsdaten erscheinen nicht in regulaeren Listen oder Details.',
            'Die Sicht ist fuer den Organisations-Admin ausreichend klar, um saubere Trennung zu pruefen.',
          ],
        },
      ],
      findings: [
        'Lokale Readiness erfolgreich: https://studio.example.test (HTTP 200).',
        'Start-URL geöffnet: https://studio.example.test/admin/users',
        'Story-Basis geladen: IAM-P2#18, IAM-P3#19.',
        'Login-Redirect erkannt; der Pilotlauf bricht ab, statt eine Login-Schleife zu tolerieren.',
      ],
      screenshots: [],
      transcriptPath: join(reportsRoot, 'admin-users-overview', 'transcript.jsonl'),
    });
  });

  it('returns BLOCKED JSON payload and exit code 1 for a missing or unreachable readiness endpoint', async () => {
    const result = await runStagehandAdminCli(
      {
        STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test',
        STAGEHAND_ADMIN_USERNAME: 'admin-user',
        STAGEHAND_ADMIN_PASSWORD: 'super-secret',
        OPENAI_API_KEY: 'test-openai-key',
      },
      {
        fetchImpl: async () => {
          throw new TypeError('fetch failed');
        },
      }
    );

    expect(result).toEqual({
      exitCode: 1,
      stream: 'stderr',
      payload: {
        status: 'BLOCKED',
        message:
          'Stagehand admin target is not reachable: https://studio.example.test. fetch failed',
      },
    });
  });

  it('returns BLOCKED JSON payload and exit code 1 for unsupported pilot missions', async () => {
    const result = await runStagehandAdminCli(
      {
        STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test',
        STAGEHAND_ADMIN_USERNAME: 'admin-user',
        STAGEHAND_ADMIN_PASSWORD: 'super-secret',
        STAGEHAND_ADMIN_MISSION: 'admin-role-management-navigation',
        OPENAI_API_KEY: 'test-openai-key',
      },
      {
        fetchImpl: async () => new Response('<html><body>ready</body></html>', { status: 200 }),
      }
    );

    expect(result).toEqual({
      exitCode: 1,
      stream: 'stderr',
      payload: {
        status: 'BLOCKED',
        message:
          'Stagehand admin mission is not implemented in the pilot runner: admin-role-management-navigation',
      },
    });
  });

  it('returns BLOCKED JSON payload and exit code 1 for missing env', async () => {
    const result = await runStagehandAdminCli({});

    expect(result).toEqual({
      exitCode: 1,
      stream: 'stderr',
      payload: {
        status: 'BLOCKED',
        message:
          'Missing Stagehand admin config env vars: STAGEHAND_ADMIN_BASE_URL|IAM_ACCEPTANCE_BASE_URL, STAGEHAND_ADMIN_USERNAME|IAM_ACCEPTANCE_ADMIN_USERNAME, STAGEHAND_ADMIN_PASSWORD|IAM_ACCEPTANCE_ADMIN_PASSWORD, OPENAI_API_KEY',
      },
    });
  });

  it('returns BLOCKED JSON payload and exit code 1 for blank or unusable base URLs', async () => {
    const blankResult = await runStagehandAdminCli({
      STAGEHAND_ADMIN_BASE_URL: '   ',
      STAGEHAND_ADMIN_USERNAME: 'admin-user',
      STAGEHAND_ADMIN_PASSWORD: 'super-secret',
      OPENAI_API_KEY: 'test-openai-key',
    });

    expect(blankResult).toEqual({
      exitCode: 1,
      stream: 'stderr',
      payload: {
        status: 'BLOCKED',
        message: 'Missing Stagehand admin config env vars: STAGEHAND_ADMIN_BASE_URL|IAM_ACCEPTANCE_BASE_URL',
      },
    });

    const slashResult = await runStagehandAdminCli({
      STAGEHAND_ADMIN_BASE_URL: '/',
      STAGEHAND_ADMIN_USERNAME: 'admin-user',
      STAGEHAND_ADMIN_PASSWORD: 'super-secret',
      OPENAI_API_KEY: 'test-openai-key',
    });

    expect(slashResult).toEqual({
      exitCode: 1,
      stream: 'stderr',
      payload: {
        status: 'BLOCKED',
        message: 'Invalid Stagehand admin base URL: /. Expected an absolute http(s) URL.',
      },
    });
  });

  it('returns READY JSON payload and writes an overlay in story-loop mode', async () => {
    const reportsRoot = createTempReportsRoot();
    const storyDirectory = mkdtempSync(join(tmpdir(), 'stagehand-cli-story-loop-'));
    temporaryDirectories.push(storyDirectory);
    const storySourcePath = join(storyDirectory, 'user-stories.json');

    const fixtureSource = JSON.stringify(
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
        ],
      },
      null,
      2
    );

    writeFileSync(storySourcePath, fixtureSource, 'utf8');

    const result = await runStagehandAdminCli(
      {
        STAGEHAND_ADMIN_BASE_URL: 'https://studio.example.test',
        STAGEHAND_ADMIN_USERNAME: 'admin-user',
        STAGEHAND_ADMIN_PASSWORD: 'super-secret',
        STAGEHAND_RUN_MODE: 'story-loop',
        OPENAI_API_KEY: 'test-openai-key',
      },
      {
        reportsRoot,
        storySourcePath,
        executeCluster: async ({ stories }) =>
          stories.map((story) => ({
            storyId: story.id,
            coverage: 'vorhanden',
            findings: ['Loop proof created.'],
            notes: 'Artefakte unter story-loop.',
            verification: {
              environment: 'adequate',
              negative: 'verified',
              positive: 'verified',
            },
          })),
      }
    );

    expect(result).toEqual({
      exitCode: 0,
      stream: 'stdout',
      payload: {
        status: 'READY',
        runMode: 'story-loop',
        baseUrl: 'https://studio.example.test',
        adminUsername: 'admin-user',
        reportPath: join(reportsRoot, 'story-loop', 'report.md'),
        statusPath: join(reportsRoot, 'story-loop', 'status.json'),
        transcriptPath: join(reportsRoot, 'story-loop', 'transcript.jsonl'),
        summary: {
          clusters: 1,
          storiesClassified: 1,
          storiesFailedEvidence: 0,
          storiesPassed: 1,
          storiesSkipped: 0,
        },
      },
    });

    expect(JSON.parse(readFileSync(storySourcePath, 'utf8'))).toMatchObject({
      packages: [
        {
          stories: [
            {
              id: 18,
              studioCheck: {
                status: 'offen',
                coverage: 'nicht_geprueft',
                notes: '',
              },
            },
          ],
        },
      ],
    });
    expect(JSON.parse(readFileSync(join(reportsRoot, 'story-loop', 'overlay.json'), 'utf8'))).toMatchObject({
      sourcePath: storySourcePath,
      stories: [
        {
          storyId: 18,
          clusterId: 'tenant-user-create',
          studioCheck: {
            status: 'erfuellt',
            coverage: 'vorhanden',
            notes: 'Artefakte unter story-loop.',
          },
        },
      ],
    });
  });
});
