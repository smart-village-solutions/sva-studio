// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { ProjectStatusReportContract } from './project-status';
import { createLocalProjectStatusApi } from './local-dev-api';

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
      id: 'M1',
      title: 'Alpha',
      plannedEffortPt: 2,
      sortOrder: 1,
      workPackages: [
        {
          id: 'WP-010',
          title: 'Planung',
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
      title: 'Beta',
      plannedEffortPt: 1,
      sortOrder: 2,
      workPackages: [
        {
          id: 'WP-003',
          title: 'Review',
          area: 'B',
          priority: 'valuable',
          effortPt: 1,
          status: 'done',
          health: 'on_track',
          dependsOn: [],
        },
      ],
    },
  ],
};

const tempDirs: string[] = [];

const createTempReportFile = () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-report-local-api-'));
  tempDirs.push(directory);
  const filePath = join(directory, 'project-status.json');
  writeFileSync(filePath, JSON.stringify(reportFixture, null, 2) + '\n', 'utf8');
  return filePath;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('local project status api', () => {
  it('returns the current report for GET requests', async () => {
    const api = createLocalProjectStatusApi({ filePath: createTempReportFile() });

    const response = await api.handleRequest({
      method: 'GET',
      pathname: '/__local/project-status',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(reportFixture);
  });

  it('writes a patched report back to disk with trailing newline and returns the updated report', async () => {
    const filePath = createTempReportFile();
    const api = createLocalProjectStatusApi({ filePath });

    const response = await api.handleRequest({
      method: 'PATCH',
      pathname: '/__local/project-status/work-package',
      body: {
        workPackageId: 'WP-010',
        milestoneId: 'M2',
        priority: 'valuable',
        status: 'done',
      },
    });
    const patchResponse = response.body as {
      report: ProjectStatusReportContract;
    };

    expect(response.status).toBe(200);
    expect(patchResponse.report.milestones[1]?.workPackages.map((entry) => entry.id)).toEqual(['WP-003', 'WP-010']);

    const fileContent = readFileSync(filePath, 'utf8');

    expect(fileContent.endsWith('\n')).toBe(true);
    expect(fileContent).toContain('\n  "meta": {');
    expect(JSON.parse(fileContent)).toEqual(patchResponse.report);
  });
});
