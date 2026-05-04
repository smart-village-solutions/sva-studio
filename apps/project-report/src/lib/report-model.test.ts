import { describe, expect, it } from 'vitest';

import {
  createProjectReportModel,
  deriveProgressFromStatus,
  type ProjectStatusReport,
} from './report-model';

const reportFixture: ProjectStatusReport = {
  meta: {
    version: '1.0.0',
    updatedAt: '2026-05-04',
    source: 'test',
  },
  statusModel: {
    idea: 0,
    commissioned: 0,
    planned: 10,
    prototype: 20,
    implementation: 45,
    optimization: 70,
    testing: 80,
    acceptance: 90,
    done: 100,
  },
  healthModel: ['on_track', 'needs_attention', 'at_risk', 'blocked'],
  priorityModel: {
    must: 'Must',
    replacement_required: 'Replacement',
    valuable: 'Valuable',
    requested: 'Requested',
    funded_optional: 'Funded',
    unfunded_nice_to_have: 'Nice to have',
    irrelevant: 'Irrelevant',
  },
  milestones: [
    {
      id: 'M1',
      title: 'Alpha',
      plannedEffortPt: 10,
      sortOrder: 1,
      workPackages: [
        {
          id: 'WP-1',
          title: 'Planung',
          area: 'A',
          priority: 'must',
          effortPt: 4,
          status: 'planned',
          health: 'on_track',
          dependsOn: [],
        },
        {
          id: 'WP-2',
          title: 'Umsetzung',
          area: 'A',
          priority: 'valuable',
          effortPt: 6,
          status: 'done',
          health: 'blocked',
          dependsOn: [],
        },
      ],
    },
    {
      id: 'M2',
      title: 'Beta',
      plannedEffortPt: 8,
      sortOrder: 2,
      workPackages: [
        {
          id: 'WP-3',
          title: 'Review',
          area: 'B',
          priority: 'must',
          effortPt: 8,
          status: 'implementation',
          health: 'needs_attention',
          dependsOn: [],
        },
      ],
    },
  ],
};

describe('report model', () => {
  it('derives progress exclusively from the public status model', () => {
    expect(deriveProgressFromStatus(reportFixture, 'implementation')).toBe(45);
    expect(deriveProgressFromStatus(reportFixture, 'done')).toBe(100);
  });

  it('aggregates milestone progress and health from matching work packages', () => {
    const model = createProjectReportModel(reportFixture, {
      view: 'milestones',
      milestone: 'all',
      status: 'all',
      health: 'all',
      priority: 'all',
      q: '',
    });

    expect(model.milestones).toEqual([
      expect.objectContaining({
        id: 'M1',
        workPackageCount: 2,
        completionPercent: 64,
        health: 'blocked',
      }),
      expect.objectContaining({
        id: 'M2',
        workPackageCount: 1,
        completionPercent: 45,
        health: 'needs_attention',
      }),
    ]);
  });

  it('filters work packages by URL-driven filter state', () => {
    const model = createProjectReportModel(reportFixture, {
      view: 'work-packages',
      milestone: 'M2',
      status: 'implementation',
      health: 'needs_attention',
      priority: 'must',
      q: 'review',
    });

    expect(model.workPackages.map((entry) => entry.id)).toEqual(['WP-3']);
    expect(model.availableMilestones).toEqual([
      { id: 'all', label: 'Alle Meilensteine' },
      { id: 'M1', label: 'Alpha' },
      { id: 'M2', label: 'Beta' },
    ]);
  });
});
