export * from './contract.js';
export {
  pluginJobs,
  pluginJobsActionDefinitions,
  pluginJobsPermissionDefinitions,
} from './plugin.js';

import { JobsCreatePage, JobsEditPage } from './jobs.pages.js';
import { JobsListPage } from './jobs.list.js';
export const pluginViewBindings = [
  { bindingKey: 'jobsList', component: JobsListPage },
  { bindingKey: 'jobsDetail', component: JobsEditPage },
  { bindingKey: 'jobsEditor', component: JobsCreatePage },
] as const;
