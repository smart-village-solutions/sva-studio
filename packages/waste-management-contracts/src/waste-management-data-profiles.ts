import type {
  WasteManagementDataProfileDefinition,
  WasteManagementDataProfileId,
} from './waste-management-data-exchange.js';
import { wasteManagementMasterDataProfiles } from './waste-management-data-profiles-master.js';
import { wasteManagementSchedulingDataProfiles } from './waste-management-data-profiles-scheduling.js';
import { wasteManagementSettingsDataProfiles } from './waste-management-data-profiles-settings.js';

export { wasteManagementExcludedDataDomains } from './waste-management-data-profiles-settings.js';

export const wasteManagementDataProfiles = [
  ...wasteManagementMasterDataProfiles,
  ...wasteManagementSchedulingDataProfiles,
  ...wasteManagementSettingsDataProfiles,
] as const satisfies readonly WasteManagementDataProfileDefinition[];

export const getWasteManagementDataProfile = (
  profileId: WasteManagementDataProfileId
): WasteManagementDataProfileDefinition | undefined =>
  wasteManagementDataProfiles.find((profile) => profile.profileId === profileId);
