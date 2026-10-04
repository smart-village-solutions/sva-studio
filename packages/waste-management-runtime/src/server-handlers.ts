import {
  createWasteServerHandlerDeps,
  type WasteServerHandlerInput,
} from './server-handler-deps.js';
import {
  createWasteOverviewHandlers,
  createWasteSettingsAndTransferHandlers,
} from './server-handlers.read.js';
import {
  createWasteFractionAndRegionHandlers,
  createWasteAddressHandlers,
} from './server-handlers.master-data.js';
import {
  createWasteCollectionLocationHandlers,
  createWastePickupDateHandlers,
} from './server-handlers.locations.js';
import {
  createWasteTourHandlers,
  createWasteTourBulkHandlers,
  createWasteTourDateShiftHandlers,
  createWasteGlobalDateShiftHandlers,
} from './server-handlers.tours.js';
import { createWasteOperationHandlers } from './server-handlers.operations.js';

export const createWasteManagementHandlers = (input: WasteServerHandlerInput) => {
  const deps = createWasteServerHandlerDeps(input);
  return {
    ...createWasteOverviewHandlers(deps),
    ...createWasteSettingsAndTransferHandlers(deps),
    ...createWasteFractionAndRegionHandlers(deps),
    ...createWasteAddressHandlers(deps),
    ...createWasteCollectionLocationHandlers(deps),
    ...createWastePickupDateHandlers(deps),
    ...createWasteTourHandlers(deps),
    ...createWasteTourBulkHandlers(deps),
    ...createWasteTourDateShiftHandlers(deps),
    ...createWasteGlobalDateShiftHandlers(deps),
    ...createWasteOperationHandlers(deps),
  };
};
