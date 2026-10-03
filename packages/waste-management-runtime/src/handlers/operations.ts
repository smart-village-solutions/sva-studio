import { wasteManagementImportSourceHandlers } from './operations-import-source.js';
import { wasteManagementJobHandlers } from './operations-job-handlers.js';
import { wasteManagementMaintenanceHandlers } from './operations-maintenance-handlers.js';

const {
  uploadWasteManagementImportSourceInternal,
  previewWasteManagementLocationTourPickupDateImportInternal,
} = wasteManagementImportSourceHandlers;

export const wasteManagementOperationHandlers = {
  uploadWasteManagementImportSourceInternal,
  ...wasteManagementJobHandlers,
  previewWasteManagementLocationTourPickupDateImportInternal,
  ...wasteManagementMaintenanceHandlers,
};
