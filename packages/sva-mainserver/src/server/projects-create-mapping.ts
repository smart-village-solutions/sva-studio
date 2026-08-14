import type {
  SvaMainserverGenericItem,
  SvaMainserverProject,
  SvaMainserverProjectInput,
} from '../types.js';
import { SvaMainserverError } from './errors.js';
import { mapGenericItemToProject, validateProjectProjection } from './projects-contract.js';

export const mapAndValidateProject = (item: SvaMainserverGenericItem): SvaMainserverProject => {
  const project = mapGenericItemToProject(item);
  if (validateProjectProjection(project)) {
    throw new SvaMainserverError({
      code: 'invalid_response',
      message: 'Mainserver-Projekt verletzt den FeaturedProject-Vertrag.',
      statusCode: 502,
    });
  }
  return project;
};

export const projectPayload = (input: SvaMainserverProjectInput) => ({
  language: input.language,
  status: input.status,
});

export const publishedAtForProject = (
  input: SvaMainserverProjectInput,
  current?: string
): string | undefined =>
  input.status === 'published' ? (current ?? new Date().toISOString()) : current;

export const projectCreateResponseBody = (input: {
  readonly project: SvaMainserverProject;
  readonly localContentId?: string;
  readonly reconciliationRequired?: boolean;
}) => ({
  data: {
    ...input.project,
    id: input.localContentId ?? input.project.id,
  },
  ...(input.reconciliationRequired
    ? { meta: { reconciliationStatus: 'reconciliation_required' as const } }
    : {}),
});
