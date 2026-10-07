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
export {
  pluginProjects,
  pluginProjectsActionDefinitions,
  pluginProjectsPermissionDefinitions,
} from './plugin.js';
