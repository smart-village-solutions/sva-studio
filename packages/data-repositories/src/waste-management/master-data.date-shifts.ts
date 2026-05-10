import type { SqlExecutor } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

import {
  createWasteGlobalDateShiftRepositoryPart,
  wasteGlobalDateShiftStatements,
} from './master-data.global-date-shifts.js';
import {
  createWasteTourDateShiftRepositoryPart,
  wasteTourDateShiftStatements,
} from './master-data.tour-date-shifts.js';

export const createWasteDateShiftRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteTourDateShifts'
  | 'getWasteTourDateShiftById'
  | 'upsertWasteTourDateShift'
  | 'listWasteGlobalDateShifts'
  | 'getWasteGlobalDateShiftById'
  | 'upsertWasteGlobalDateShift'
> => ({
  ...createWasteTourDateShiftRepositoryPart(executor),
  ...createWasteGlobalDateShiftRepositoryPart(executor),
});

export const wasteDateShiftStatements = {
  ...wasteTourDateShiftStatements,
  ...wasteGlobalDateShiftStatements,
} as const;
