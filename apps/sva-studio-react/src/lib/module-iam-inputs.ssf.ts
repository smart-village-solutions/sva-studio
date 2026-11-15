import { studioHostModuleIamContracts } from '@sva/studio-module-iam';

import { filterModuleContractsForDistribution } from './studio-distribution.js';

export const studioHostModuleContracts = filterModuleContractsForDistribution(
  studioHostModuleIamContracts,
  'ssf'
);
