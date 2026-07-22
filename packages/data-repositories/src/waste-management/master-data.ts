import type { SqlExecutor } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

import {
  createWasteCollectionLocationRepositoryPart,
  wasteCollectionLocationStatements,
} from './master-data.collection-locations.js';
import {
  createWasteHolidayRuleRepositoryPart,
  wasteHolidayRuleStatements,
} from './master-data.holiday-rules.js';
import {
  createWasteCustomRecurrencePresetRepositoryPart,
  wasteCustomRecurrencePresetStatements,
} from './master-data.custom-recurrence-presets.js';
import {
  createWasteDateShiftRepositoryPart,
  wasteDateShiftStatements,
} from './master-data.date-shifts.js';
import {
  createWasteFractionRepositoryPart,
  wasteFractionStatements,
} from './master-data.fractions.js';
import {
  createWastePdfStaticSettingsRepositoryPart,
  wastePdfStaticSettingsStatements,
} from './master-data.pdf-static-settings.js';
import {
  createWasteGlobalDateShiftRepositoryPart,
  wasteGlobalDateShiftStatements,
} from './master-data.global-date-shifts.js';
import {
  createWasteLocationTourLinkRepositoryPart,
  wasteLocationTourLinkStatements,
} from './master-data.location-tour-links.js';
import {
  createWasteLocationTourPickupDateRepositoryPart,
  wasteLocationTourPickupDateStatements,
} from './master-data.location-tour-pickup-dates.js';
import {
  createWasteTourAssignmentRepositoryPart,
  wasteTourAssignmentStatements,
} from './master-data.tour-assignments.js';
import {
  createWasteRegionCityRepositoryPart,
  wasteRegionCityStatements,
} from './master-data.regions-cities.js';
import {
  createWasteStreetHouseNumberRepositoryPart,
  wasteStreetHouseNumberStatements,
} from './master-data.streets-house-numbers.js';
import {
  createWasteTourDateShiftRepositoryPart,
  wasteTourDateShiftStatements,
} from './master-data.tour-date-shifts.js';
import { createWasteTourRepositoryPart, wasteTourStatements } from './master-data.tours.js';

export type { WasteMasterDataRepository } from './master-data.contract.js';

export const createWasteMasterDataRepository = (
  executor: SqlExecutor
): WasteMasterDataRepository => ({
  ...createWasteFractionRepositoryPart(executor),
  ...createWasteRegionCityRepositoryPart(executor),
  ...createWasteStreetHouseNumberRepositoryPart(executor),
  ...createWasteCollectionLocationRepositoryPart(executor),
  ...createWastePdfStaticSettingsRepositoryPart(executor),
  ...createWasteHolidayRuleRepositoryPart(executor),
  ...createWasteCustomRecurrencePresetRepositoryPart(executor),
  ...createWasteTourRepositoryPart(executor),
  ...createWasteLocationTourLinkRepositoryPart(executor),
  ...createWasteLocationTourPickupDateRepositoryPart(executor),
  ...createWasteTourAssignmentRepositoryPart(executor),
  ...createWasteDateShiftRepositoryPart(executor),
  ...createWasteTourDateShiftRepositoryPart(executor),
  ...createWasteGlobalDateShiftRepositoryPart(executor),
});

export const wasteMasterDataStatements = {
  ...wasteFractionStatements,
  ...wasteRegionCityStatements,
  ...wasteStreetHouseNumberStatements,
  ...wasteCollectionLocationStatements,
  ...wastePdfStaticSettingsStatements,
  ...wasteHolidayRuleStatements,
  ...wasteCustomRecurrencePresetStatements,
  ...wasteTourStatements,
  ...wasteLocationTourLinkStatements,
  ...wasteLocationTourPickupDateStatements,
  ...wasteTourAssignmentStatements,
  ...wasteDateShiftStatements,
  ...wasteTourDateShiftStatements,
  ...wasteGlobalDateShiftStatements,
} as const;
