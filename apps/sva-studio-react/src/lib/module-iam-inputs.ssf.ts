import { studioHostModuleIamContracts } from '@sva/studio-module-iam';

export const studioHostModuleContracts = studioHostModuleIamContracts.filter(
  ({ moduleId }) => moduleId !== 'app'
);
