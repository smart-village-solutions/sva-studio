import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateProjectStatusReport } from './project-status';

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/project-status.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;
const fixtureReport = fixture as {
  meta: Record<string, unknown>;
  statusModel: Record<string, unknown>;
  healthModel: unknown[];
  priorityModel: Record<string, unknown>;
  milestones: Record<string, unknown>[];
};

describe('project status report fixture', () => {
  it('matches the public schema contract', () => {
    expect(validateProjectStatusReport(fixture)).toEqual([]);
  });

  it('rejects non-object top-level reports and invalid meta payloads', () => {
    expect(validateProjectStatusReport(null)).toEqual(['project status report must be an object']);

    const invalidReport = {
      ...fixtureReport,
      meta: {
        version: '',
        updatedAt: '04.05.2026',
        source: '',
      },
    };

    expect(validateProjectStatusReport(invalidReport)).toEqual([
      'meta.version must be a non-empty string',
      'meta.updatedAt must be a YYYY-MM-DD string',
      'meta.source must be a non-empty string',
    ]);
  });

  it('rejects status, health, and priority model drift', () => {
    const invalidReport = {
      ...fixtureReport,
      statusModel: {
        ...fixtureReport.statusModel,
        planned: 11,
      },
      healthModel: ['on_track', 'blocked', 'at_risk', 'needs_attention'],
      priorityModel: {
        ...fixtureReport.priorityModel,
        requested: '4: Anders',
      },
    };

    expect(validateProjectStatusReport(invalidReport)).toEqual([
      'statusModel must exactly match the approved public progress mapping',
      'healthModel must exactly match the approved public health mapping',
      'priorityModel must exactly match the approved public priority mapping',
    ]);
  });

  it('rejects invalid and duplicate milestones', () => {
    const invalidReport = {
      ...fixtureReport,
      milestones: [
        {
          id: 'M1',
          title: '',
          plannedEffortPt: -1,
          sortOrder: 0,
          workPackages: [],
        },
        {
          id: 'M1',
          title: 'Duplikat',
          plannedEffortPt: 1,
          sortOrder: 2,
          workPackages: [],
        },
      ],
    };

    expect(validateProjectStatusReport(invalidReport)).toEqual([
      'milestones[0].title must be a non-empty string',
      'milestones[0].plannedEffortPt must be a non-negative number',
      'milestones[0].sortOrder must be a positive integer',
      'milestones[1].id must be unique',
    ]);
  });

  it('rejects invalid work package references and value types', () => {
    const invalidReport = {
      ...fixtureReport,
      milestones: [
        {
          ...(fixtureReport.milestones[0] ?? {}),
          id: 'M1',
          workPackages: [
            {
              id: 'WP-001',
              title: '',
              area: '',
              priority: 'urgent',
              effortPt: -1,
              status: 'rolling',
              health: 'unknown',
              dependsOn: [42],
              notes: 7,
            },
            {
              id: 'WP-001',
              title: 'Duplikat',
              area: 'Test',
              priority: 'must',
              effortPt: 1,
              status: 'planned',
              health: 'on_track',
              dependsOn: [],
            },
          ],
        },
      ],
    };

    expect(validateProjectStatusReport(invalidReport)).toEqual([
      'milestones[0].workPackages[0].title must be a non-empty string',
      'milestones[0].workPackages[0].area must be a non-empty string',
      'milestones[0].workPackages[0].priority must use a known public priority key',
      'milestones[0].workPackages[0].effortPt must be a non-negative number',
      'milestones[0].workPackages[0].status must use a known public status key',
      'milestones[0].workPackages[0].health must use a known public health key',
      'milestones[0].workPackages[0].dependsOn must be an array of work package ids',
      'milestones[0].workPackages[0].notes must be a string when provided',
      'milestones[0].workPackages[1].id must be unique',
    ]);
  });
});
