import { validateProjectStatusReport, type ProjectPriority, type ProjectStatus } from './project-status';
import type { ProjectStatusReport } from './report-model';

const localProjectStatusUrl = '/__local/project-status';
const localProjectStatusWorkPackageUrl = '/__local/project-status/work-package';

export type LocalProjectStatusPatchRequest = Readonly<{
  workPackageId: string;
  milestoneId: string;
  priority: ProjectPriority;
  status: ProjectStatus;
}>;

export const parseProjectStatusReport = (value: unknown): ProjectStatusReport => {
  const validationErrors = validateProjectStatusReport(value);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid project report payload:\n${validationErrors.join('\n')}`);
  }

  return value as ProjectStatusReport;
};

export const loadLocalProjectStatusReport = async (): Promise<ProjectStatusReport> => {
  const response = await fetch(localProjectStatusUrl);

  if (!response.ok) {
    throw new Error(`Failed to load local project status: ${response.status}`);
  }

  return parseProjectStatusReport(await response.json());
};

export const saveLocalProjectStatusUpdate = async (
  payload: LocalProjectStatusPatchRequest
): Promise<ProjectStatusReport> => {
  const response = await fetch(localProjectStatusWorkPackageUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save local project status: ${response.status}`);
  }

  const body = (await response.json()) as {
    report?: unknown;
  };

  return parseProjectStatusReport(body.report);
};
