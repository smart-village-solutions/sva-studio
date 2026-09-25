import {
  studioHostModuleIamContracts,
  studioRegularPluginModuleIamContracts,
  type StudioModuleIamContract,
} from '@sva/studio-module-iam';

export const studioHostModuleContracts = studioHostModuleIamContracts;
export const studioPluginModuleContracts: readonly StudioModuleIamContract[] =
  studioRegularPluginModuleIamContracts;
