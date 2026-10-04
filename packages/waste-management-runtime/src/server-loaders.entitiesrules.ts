import type {
  WasteTourRecord,
  WasteTourDateShiftRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
} from '@sva/waste-management-contracts';
import type { WasteRepository } from './server-loaders.context.js';
import type { WasteLoaderContext } from './server-loaders.context.js';

export const createEntitiesRules = (context: WasteLoaderContext) => {
  const { createLoader } = context;
  const loadWasteTourById = createLoader('load_waste_tour_by_id', (repository, tourId: string) =>
    repository.getWasteTourById(tourId)
  );
  const saveWasteTour = createLoader(
    'save_waste_tour',
    (repository, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteTour(input)
  );
  const deleteWasteTour = createLoader('delete_waste_tour', (repository, tourId: string) =>
    repository.deleteWasteTour(tourId)
  );
  const loadWasteTourDateShiftById = createLoader(
    'load_waste_tour_date_shift_by_id',
    (repository, shiftId: string) => repository.getWasteTourDateShiftById(shiftId)
  );
  const listWasteTourDateShiftsByTourId = createLoader(
    'list_waste_tour_date_shifts_by_tour_id',
    (repository, tourId: string) => repository.listWasteTourDateShiftsByTourId(tourId)
  );
  const deleteWasteTourDateShift = createLoader(
    'delete_waste_tour_date_shift',
    (repository, shiftId: string) => repository.deleteWasteTourDateShift(shiftId)
  );
  const saveWasteTourDateShift = createLoader(
    'save_waste_tour_date_shift',
    (repository, input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteTourDateShift(input)
  );
  const createWasteTourDateShift = createLoader(
    'create_waste_tour_date_shift',
    (repository, input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>) =>
      repository.insertWasteTourDateShift(input)
  );
  const loadWasteGlobalDateShiftById = createLoader(
    'load_waste_global_date_shift_by_id',
    (repository, shiftId: string) => repository.getWasteGlobalDateShiftById(shiftId)
  );
  const deleteWasteGlobalDateShift = createLoader(
    'delete_waste_global_date_shift',
    (repository, shiftId: string) => repository.deleteWasteGlobalDateShift(shiftId)
  );
  const saveWasteGlobalDateShift = createLoader(
    'save_waste_global_date_shift',
    (repository, input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteGlobalDateShift(input)
  );
  const saveWasteHolidayRule = createLoader(
    'save_waste_holiday_rule',
    (repository, input: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>) =>
      repository.upsertWasteHolidayRule(input)
  );
  const deleteWasteHolidayRule = createLoader(
    'delete_waste_holiday_rule',
    (repository, ruleId: string) => repository.deleteWasteHolidayRule(ruleId)
  );
  const saveWastePdfStaticSettings = createLoader(
    'save_waste_pdf_static_settings',
    (repository, input: Parameters<WasteRepository['upsertWastePdfStaticSettings']>[0]) =>
      repository.upsertWastePdfStaticSettings(input)
  );

  return {
    loadWasteTourById,
    saveWasteTour,
    deleteWasteTour,
    loadWasteTourDateShiftById,
    listWasteTourDateShiftsByTourId,
    deleteWasteTourDateShift,
    saveWasteTourDateShift,
    createWasteTourDateShift,
    loadWasteGlobalDateShiftById,
    deleteWasteGlobalDateShift,
    saveWasteGlobalDateShift,
    saveWasteHolidayRule,
    deleteWasteHolidayRule,
    saveWastePdfStaticSettings,
  };
};
