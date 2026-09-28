import { wasteManagementCityHandlers } from './handlers/cities.js';
import { wasteManagementCollectionLocationHandlers } from './handlers/collection-locations.js';
import { wasteManagementFractionHandlers } from './handlers/fractions.js';
import { wasteManagementGlobalDateShiftHandlers } from './handlers/global-date-shifts.js';
import { wasteManagementHolidayRuleHandlers } from './handlers/holiday-rules.js';
import { wasteManagementHouseNumberHandlers } from './handlers/house-numbers.js';
import { wasteManagementLocationTourLinkBulkHandlers } from './handlers/location-tour-links-bulk.js';
import { wasteManagementLocationTourPickupDateHandlers } from './handlers/location-tour-pickup-dates.js';
import { wasteManagementLocationTourLinkHandlers } from './handlers/location-tour-links.js';
import { wasteManagementOperationHandlers } from './handlers/operations.js';
import { wasteManagementReadHandlers } from './handlers/read-handlers.js';
import { wasteManagementRegionHandlers } from './handlers/regions.js';
import { wasteManagementSettingsHandlers } from './handlers/settings.js';
import { wasteManagementStreetHandlers } from './handlers/streets.js';
import { wasteManagementTourDateShiftHandlers } from './handlers/tour-date-shifts.js';
import { wasteManagementTourHandlers } from './handlers/tours.js';
import { wasteManagementTourValidityBulkHandlers } from './handlers/tour-validity-bulk.js';
import { wasteManagementTourStatusBulkHandlers } from './handlers/tour-status-bulk.js';
import { wasteManagementTourAssignmentHandlers } from './handlers/tour-assignments.js';
import { wasteManagementAnnualTourTransferHandlers } from './handlers/annual-tour-transfer.js';

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
  ...wasteManagementTourValidityBulkHandlers,
  ...wasteManagementTourStatusBulkHandlers,
  ...wasteManagementTourAssignmentHandlers,
  ...wasteManagementAnnualTourTransferHandlers,
  ...wasteManagementTourDateShiftHandlers,
  ...wasteManagementGlobalDateShiftHandlers,
  ...wasteManagementHolidayRuleHandlers,
  ...wasteManagementOperationHandlers,
};
