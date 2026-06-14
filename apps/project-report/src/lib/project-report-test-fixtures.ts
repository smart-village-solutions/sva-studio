import type { ProjectStatusReportContract } from './project-status';
import type { ProjectStatusReport } from './report-model';

const baseReportFixture: ProjectStatusReportContract = {
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
      id: 'M1',
      title: 'Alpha',
      plannedEffortPt: 3,
      sortOrder: 1,
      workPackages: [
        {
          id: 'WP-1',
          title: 'Paket',
          area: 'A',
          priority: 'must',
          effortPt: 3,
          status: 'planned',
          health: 'on_track',
          dependsOn: [],
        },
      ],
    },
  ],
};

export const createProjectStatusReportFixture = (
  overrides: Partial<ProjectStatusReportContract> = {}
): ProjectStatusReportContract => ({
  ...baseReportFixture,
  ...overrides,
  meta: {
    ...baseReportFixture.meta,
    ...overrides.meta,
  },
  statusModel: {
    ...baseReportFixture.statusModel,
    ...overrides.statusModel,
  },
  priorityModel: {
    ...baseReportFixture.priorityModel,
    ...overrides.priorityModel,
  },
  healthModel: overrides.healthModel ?? baseReportFixture.healthModel,
  milestones: overrides.milestones ?? baseReportFixture.milestones,
});

export const createLocalEditableProjectStatusReportFixture = (): ProjectStatusReport => ({
  ...createProjectStatusReportFixture({
    meta: {
      ...baseReportFixture.meta,
      source: 'local-test',
    },
    milestones: [
      {
        id: 'M1',
        title: 'Alpha Local',
        plannedEffortPt: 3,
        sortOrder: 1,
        workPackages: [
          {
            id: 'WP-201',
            title: 'Lokales Paket',
            area: 'A',
            priority: 'must',
            effortPt: 2,
            status: 'planned',
            health: 'on_track',
            dependsOn: [],
          },
        ],
      },
      {
        id: 'M2',
        title: 'Beta Local',
        plannedEffortPt: 1,
        sortOrder: 2,
        workPackages: [
          {
            id: 'WP-202',
            title: 'Zielpaket',
            area: 'B',
            priority: 'valuable',
            effortPt: 1,
            status: 'done',
            health: 'needs_attention',
            dependsOn: [],
          },
        ],
      },
    ],
  }),
});

export const createSortedLocalEditingProjectStatusReportFixture = (): ProjectStatusReportContract => ({
  ...createProjectStatusReportFixture({
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
  }),
});
