export {
  ProjectsApiError,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from './projects.api.js';
export type {
  ProjectAuthor,
  ProjectContentItem,
  ProjectFormInput,
  ProjectImage,
  ProjectListQuery,
  ProjectListResult,
  ProjectPagination,
  ProjectStatus,
} from './projects.api-types.js';
export {
  createDefaultProjectFormValues,
  normalizeProjectImages,
  normalizeProjectInput,
  projectToFormValues,
} from './projects.model.js';
export { ProjectsCreatePage, ProjectsEditPage, ProjectsListPage } from './projects.pages.js';
import { ProjectsCreatePage, ProjectsEditPage, ProjectsListPage } from './projects.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'projectsList', component: ProjectsListPage },
  { bindingKey: 'projectsDetail', component: ProjectsEditPage },
  { bindingKey: 'projectsEditor', component: ProjectsCreatePage },
] as const;
export { pluginProjectsActionDefinitions, pluginProjectsPermissionDefinitions } from './plugin.js';

import { pluginProjects as descriptor } from './plugin.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';
import { deleteProject } from './projects.api.js';
const contentMutations: ContentTypeMutations = {
  delete: { requiredAction: 'projects.delete', execute: deleteProject },
};
export const pluginProjects: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};
