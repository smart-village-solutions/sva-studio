import {
  studioHostModuleIamContracts,
  type StudioModuleIamContract,
} from '@sva/studio-module-iam';
import { ssfModuleIamContract } from '@sva/studio-module-iam/ssf';

export const studioHostModuleContracts = studioHostModuleIamContracts;
export const studioPluginModuleContracts: readonly StudioModuleIamContract[] =
  [ssfModuleIamContract];
