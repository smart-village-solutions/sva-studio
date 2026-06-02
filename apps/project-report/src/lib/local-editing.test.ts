import { describe, expect, it } from 'vitest';

import type { ProjectStatusReportContract } from './project-status';
import {
  getEditableWorkPackageOptions,
  isLocalProjectStatusHost,
  updateWorkPackageAssignment,
} from './local-editing';

const reportFixture: ProjectStatusReportContract = {
  meta: {
    version: '1.0.0',
    updatedAt: '2026-06-02',
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
    must: '1: Muss sein',
    replacement_required: '2: Notwendig für die Ablösung des Alt-Systems',
    valuable: '3: Neu, aber sehr sinnvoll',
    requested: '4: Neu und gewünscht',
    funded_optional: '5: Nicht so wichtig, aber finanziert',
    unfunded_nice_to_have: '6: Nice to have, noch ohne Finanzierung',
    irrelevant: '7: Irrelevant',
  },
  milestones: [
    {
      id: 'M2',
      title: 'Beta',
      plannedEffortPt: 8,
      sortOrder: 2,
      workPackages: [
        {
          id: 'WP-003',
          title: 'Review',
          area: 'B',
          priority: 'valuable',
          effortPt: 2,
          status: 'done',
          health: 'on_track',
          dependsOn: [],
        },
      ],
    },
    {
      id: 'M1',
      title: 'Alpha',
      plannedEffortPt: 5,
      sortOrder: 1,
      workPackages: [
        {
          id: 'WP-010',
          title: 'Planung',
          area: 'A',
          priority: 'must',
          effortPt: 3,
          status: 'planned',
          health: 'on_track',
          dependsOn: [],
          featureSummary: 'Bleibt erhalten',
        },
        {
          id: 'WP-002',
          title: 'Umsetzung',
          area: 'A',
          priority: 'must',
          effortPt: 2,
          status: 'planned',
          health: 'needs_attention',
          dependsOn: ['WP-010'],
          todos: ['Offen'],
        },
      ],
    },
  ],
};

describe('local editing helpers', () => {
  it('detects local hosts only for localhost variants', () => {
    expect(isLocalProjectStatusHost('localhost')).toBe(true);
    expect(isLocalProjectStatusHost('127.0.0.1')).toBe(true);
    expect(isLocalProjectStatusHost('::1')).toBe(true);
    expect(isLocalProjectStatusHost('smart-village-solutions.github.io')).toBe(false);
  });

  it('derives local edit options from values that actually occur in the report', () => {
    const options = getEditableWorkPackageOptions(reportFixture);

    expect(options.milestones).toEqual([
      { id: 'M1', label: 'M1 · Alpha' },
      { id: 'M2', label: 'M2 · Beta' },
    ]);
    expect(options.statuses.map((entry) => entry.id)).toEqual(['done', 'planned']);
    expect(options.priorities.map((entry) => entry.id)).toEqual(['valuable', 'must']);
  });

  it('moves a work package to another milestone and sorts the target milestone by work package id', () => {
    const nextReport = updateWorkPackageAssignment(reportFixture, {
      workPackageId: 'WP-010',
      milestoneId: 'M2',
      priority: 'valuable',
      status: 'done',
    });

    expect(nextReport.milestones.find((entry) => entry.id === 'M1')?.workPackages.map((entry) => entry.id)).toEqual(['WP-002']);
    expect(nextReport.milestones.find((entry) => entry.id === 'M2')?.workPackages.map((entry) => entry.id)).toEqual([
      'WP-003',
      'WP-010',
    ]);

    const movedPackage = nextReport.milestones
      .find((entry) => entry.id === 'M2')
      ?.workPackages.find((entry) => entry.id === 'WP-010');

    expect(movedPackage).toEqual(
      expect.objectContaining({
        priority: 'valuable',
        status: 'done',
        featureSummary: 'Bleibt erhalten',
      })
    );
  });

  it('rejects unknown work package ids, milestones, statuses, and priorities', () => {
    expect(() =>
      updateWorkPackageAssignment(reportFixture, {
        workPackageId: 'WP-999',
        milestoneId: 'M1',
        priority: 'must',
        status: 'planned',
      })
    ).toThrow('Unknown work package id: WP-999');

    expect(() =>
      updateWorkPackageAssignment(reportFixture, {
        workPackageId: 'WP-010',
        milestoneId: 'M9',
        priority: 'must',
        status: 'planned',
      })
    ).toThrow('Unknown milestone id: M9');

    expect(() =>
      updateWorkPackageAssignment(reportFixture, {
        workPackageId: 'WP-010',
        milestoneId: 'M1',
        priority: 'urgent' as never,
        status: 'planned',
      })
    ).toThrow('Unknown priority: urgent');

    expect(() =>
      updateWorkPackageAssignment(reportFixture, {
        workPackageId: 'WP-010',
        milestoneId: 'M1',
        priority: 'must',
        status: 'rolling' as never,
      })
    ).toThrow('Unknown status: rolling');
  });
});
