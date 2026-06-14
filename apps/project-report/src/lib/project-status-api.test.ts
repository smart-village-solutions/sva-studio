import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadLocalProjectStatusReport,
  parseProjectStatusReport,
  saveLocalProjectStatusUpdate,
  type LocalProjectStatusPatchRequest,
} from './project-status-api';
import { createProjectStatusReportFixture } from './project-report-test-fixtures';

const validReportFixture = createProjectStatusReportFixture();

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
    const nextReport = {
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
