import { createMainserverCrudClient, createMainserverJsonRequestHeaders } from '@sva/plugin-sdk';
import type { MainserverActingPrincipalType } from '@sva/plugin-sdk';

import type {
  ProjectContentItem,
  ProjectFormInput,
  ProjectListQuery,
  ProjectListResult,
} from './projects.api-types.js';

export class ProjectsApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'ProjectsApiError';
  }
}

const projectsClient = createMainserverCrudClient<
  ProjectContentItem,
  ProjectFormInput,
  ProjectListResult,
  ProjectListResult,
  ProjectsApiError
>({
  basePath: '/api/v1/mainserver/projects',
  errorFactory: (code, message) => new ProjectsApiError(code, message),
  mapListResponse: (response) => response,
  createHeaders: () =>
    createMainserverJsonRequestHeaders({
      'Idempotency-Key': globalThis.crypto.randomUUID(),
    }),
});

export const listProjects = (query: ProjectListQuery): Promise<ProjectListResult> =>
  projectsClient.list(query);

export const getProject = (contentId: string): Promise<ProjectContentItem> =>
  projectsClient.get(contentId);

export const createProject = (
  input: ProjectFormInput,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<ProjectContentItem> => projectsClient.create(input, actingPrincipalType);

export const updateProject = (
  contentId: string,
  input: ProjectFormInput,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<ProjectContentItem> => projectsClient.update(contentId, input, actingPrincipalType);

export const deleteProject = (
  contentId: string,
  actingPrincipalType: MainserverActingPrincipalType
): Promise<void> => projectsClient.remove(contentId, actingPrincipalType);
