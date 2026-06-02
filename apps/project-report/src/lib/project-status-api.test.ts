import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProjectStatusReport } from './report-model';
import {
  loadLocalProjectStatusReport,
  parseProjectStatusReport,
  saveLocalProjectStatusUpdate,
  type LocalProjectStatusPatchRequest,
} from './project-status-api';

const validReportFixture: ProjectStatusReport = {
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

const patchPayload: LocalProjectStatusPatchRequest = {
  workPackageId: 'WP-1',
  milestoneId: 'M1',
  priority: 'must',
  status: 'done',
};

describe('project status api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects invalid project report payloads', () => {
    expect(() => parseProjectStatusReport({})).toThrowError(/Invalid project report payload/);
  });

  it('loads the local project status report from the fixed endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validReportFixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(loadLocalProjectStatusReport()).resolves.toEqual(validReportFixture);
    expect(fetchMock).toHaveBeenCalledWith('/__local/project-status');
  });

  it('patches the local work package endpoint and returns the validated report', async () => {
    const nextReport: ProjectStatusReport = {
      ...validReportFixture,
      milestones: [
        {
          ...validReportFixture.milestones[0],
          workPackages: [
            {
              ...validReportFixture.milestones[0].workPackages[0],
              status: 'done',
            },
          ],
        },
      ],
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ report: nextReport }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(saveLocalProjectStatusUpdate(patchPayload)).resolves.toEqual(nextReport);
    expect(fetchMock).toHaveBeenCalledWith(
      '/__local/project-status/work-package',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      })
    );
  });
});
