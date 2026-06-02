import { readFile, writeFile } from 'node:fs/promises';

import {
  validateProjectStatusReport,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectStatusReportContract,
} from './project-status';
import { updateWorkPackageAssignment } from './local-editing';

export type LocalProjectStatusPatchRequest = Readonly<{
  workPackageId: string;
  milestoneId: string;
  priority: ProjectPriority;
  status: ProjectStatus;
}>;

export type LocalProjectStatusApiRequest = Readonly<{
  method: string;
  pathname: string;
  body?: unknown;
}>;

export type LocalProjectStatusApiResponse = Readonly<{
  status: number;
  body: unknown;
}>;

export type LocalProjectStatusApi = Readonly<{
  handleRequest: (request: LocalProjectStatusApiRequest) => Promise<LocalProjectStatusApiResponse>;
}>;

const readProjectStatusReport = async (filePath: string): Promise<ProjectStatusReportContract> => {
  const fileContent = await readFile(filePath, 'utf8');
  const report = JSON.parse(fileContent) as unknown;
  const validationErrors = validateProjectStatusReport(report);

  if (validationErrors.length > 0) {
    throw new Error(`Invalid project status report file:\n${validationErrors.join('\n')}`);
  }

  return report as ProjectStatusReportContract;
};

const serializeProjectStatusReport = (report: ProjectStatusReportContract): string => `${JSON.stringify(report, null, 2)}\n`;

const isPatchRequestBody = (value: unknown): value is LocalProjectStatusPatchRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    typeof (value as Record<string, unknown>).workPackageId === 'string' &&
    typeof (value as Record<string, unknown>).milestoneId === 'string' &&
    typeof (value as Record<string, unknown>).priority === 'string' &&
    typeof (value as Record<string, unknown>).status === 'string'
  );
};

export const createLocalProjectStatusApi = (
  options: Readonly<{
    filePath: string;
  }>
): LocalProjectStatusApi => ({
  async handleRequest(request) {
    if (request.method === 'GET' && request.pathname === '/__local/project-status') {
      return {
        status: 200,
        body: await readProjectStatusReport(options.filePath),
      };
    }

    if (request.method === 'PATCH' && request.pathname === '/__local/project-status/work-package') {
      if (!isPatchRequestBody(request.body)) {
        throw new Error('Invalid patch body');
      }

      const currentReport = await readProjectStatusReport(options.filePath);
      const nextReport = updateWorkPackageAssignment(currentReport, request.body);
      await writeFile(options.filePath, serializeProjectStatusReport(nextReport), 'utf8');

      return {
        status: 200,
        body: { report: nextReport },
      };
    }

    return {
      status: 404,
      body: {
        error: 'Not found',
      },
    };
  },
});
