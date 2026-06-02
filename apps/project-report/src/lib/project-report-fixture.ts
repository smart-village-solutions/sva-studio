import reportData from '../data/project-status.json';
import { validateProjectStatusReport } from './project-status';
import type { ProjectStatusReport } from './report-model';

const validationErrors = validateProjectStatusReport(reportData);

if (validationErrors.length > 0) {
  throw new Error(`Invalid project report fixture:\n${validationErrors.join('\n')}`);
}

export const projectReport = reportData as ProjectStatusReport;
