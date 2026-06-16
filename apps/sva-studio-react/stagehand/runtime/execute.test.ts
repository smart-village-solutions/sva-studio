import { describe, expect, it } from 'vitest';

import { executeStagehandAdminMission } from './execute.ts';

describe('executeStagehandAdminMission', () => {
  it('creates stable artifact paths and a blocked pilot report for the selected mission', () => {
    const result = executeStagehandAdminMission(
      {
        admin: {
          password: 'secret',
          username: 'admin-user',
        },
        baseUrl: 'https://studio.example.test',
        mission: 'admin-users-overview',
        openAiApiKey: 'test-openai-key',
        runMode: 'mission',
      },
      {
        generatedAt: '2026-05-16T12:00:00.000Z',
        reportsRoot: '/tmp/stagehand-reports',
      }
    );

    expect(result).toEqual({
      artifacts: {
        reportPath: '/tmp/stagehand-reports/admin-users-overview/report.md',
        statusPath: '/tmp/stagehand-reports/admin-users-overview/status.json',
        transcriptPath: '/tmp/stagehand-reports/admin-users-overview/transcript.jsonl',
      },
      report: {
        findings: [
          'Pilotlauf vorbereitet; echte Browser-Interaktion ist in diesem Schritt noch nicht implementiert.',
          'Startpfad: /admin/users',
          'Ziel: Die Admin-Nutzeruebersicht oeffnen und bestaetigen, dass die Liste erreichbar ist.',
        ],
        generatedAt: '2026-05-16T12:00:00.000Z',
        mission: 'admin-users-overview',
        screenshots: [],
        status: 'blocked',
        stories: expect.any(Array),
        transcriptPath: '/tmp/stagehand-reports/admin-users-overview/transcript.jsonl',
      },
    });
  });
});
