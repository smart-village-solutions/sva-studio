import { wasteManagementCityHandlers } from './core/cities.js';
import { wasteManagementCollectionLocationHandlers } from './core/collection-locations.js';
import { wasteManagementFractionHandlers } from './core/fractions.js';
import { wasteManagementGlobalDateShiftHandlers } from './core/global-date-shifts.js';
import { wasteManagementHolidayRuleHandlers } from './core/holiday-rules.js';
import { wasteManagementHouseNumberHandlers } from './core/house-numbers.js';
import { wasteManagementLocationTourLinkBulkHandlers } from './core/location-tour-links-bulk.js';
import { wasteManagementLocationTourPickupDateHandlers } from './core/location-tour-pickup-dates.js';
import { wasteManagementLocationTourLinkHandlers } from './core/location-tour-links.js';
import { wasteManagementOperationHandlers } from './core/operations.js';
import { wasteManagementReadHandlers } from './core/read-handlers.js';
import { wasteManagementRegionHandlers } from './core/regions.js';
import { wasteManagementSettingsHandlers } from './core/settings.js';
import { wasteManagementStreetHandlers } from './core/streets.js';
import { wasteManagementTourDateShiftHandlers } from './core/tour-date-shifts.js';
import { wasteManagementTourHandlers } from './core/tours.js';

export const wasteManagementCoreHandlers = {
  ...wasteManagementReadHandlers,
  ...wasteManagementSettingsHandlers,
  ...wasteManagementFractionHandlers,
  ...wasteManagementRegionHandlers,
  ...wasteManagementCityHandlers,
  ...wasteManagementStreetHandlers,
  ...wasteManagementHouseNumberHandlers,
  ...wasteManagementCollectionLocationHandlers,
  ...wasteManagementLocationTourLinkHandlers,
  ...wasteManagementLocationTourLinkBulkHandlers,
  ...wasteManagementLocationTourPickupDateHandlers,
  ...wasteManagementTourHandlers,
  ...wasteManagementTourDateShiftHandlers,
  ...wasteManagementGlobalDateShiftHandlers,
  ...wasteManagementHolidayRuleHandlers,
  ...wasteManagementOperationHandlers,
};
