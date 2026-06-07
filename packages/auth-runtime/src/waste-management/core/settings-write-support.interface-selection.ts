import {
  buildWasteManagementPublicConfig,
  isWasteManagementInterfaceSelected,
  readWasteManagementCalendarWebUrl,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
  type ExternalInterfaceRecord,
  type WasteHolidayStateCode,
  type WasteHolidaySyncStatus,
  type WasteManagementSettingsRecord,
} from '@sva/core';

import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

export const resolveTargetInterfaceRecord = (
  interfaceRecords: readonly ExternalInterfaceRecord[],
  current: WasteManagementSettingsRecord,
  selectedInterfaceId?: string
): ExternalInterfaceRecord | null => {
  const explicitMatch = selectedInterfaceId
    ? interfaceRecords.find((record) => record.id === selectedInterfaceId) ?? null
    : null;
  if (explicitMatch) {
    return explicitMatch;
  }

  if (current.selectedInterfaceId) {
    const currentMatch = interfaceRecords.find((record) => record.id === current.selectedInterfaceId);
    if (currentMatch) {
      return currentMatch;
    }
  }

  return interfaceRecords.find((record) => isWasteManagementInterfaceSelected(record)) ?? null;
};

const createInterfaceSettingsRecord = (
  interfaceRecord: ExternalInterfaceRecord,
  input: {
    readonly selected: boolean;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
    readonly lastSuccessfulHolidaySyncAt?: string;
  }
): ExternalInterfaceRecord => ({
  ...interfaceRecord,
  publicConfig: buildWasteManagementPublicConfig(interfaceRecord.publicConfig, input),
});

export const persistWasteSettingsInterfaceSelection = async ({
  deps,
  interfaceRecords,
  targetInterfaceRecord,
  calendarWebUrl,
  pdfBrandingAssetUrl,
  pdfContactBlock,
  holidayStateCode,
  lastHolidaySyncStatus,
  lastSuccessfulHolidaySyncAt,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly interfaceRecords: readonly ExternalInterfaceRecord[];
  readonly targetInterfaceRecord: ExternalInterfaceRecord;
  readonly calendarWebUrl?: string;
  readonly pdfBrandingAssetUrl?: string;
  readonly pdfContactBlock?: string;
  readonly holidayStateCode?: WasteHolidayStateCode;
  readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
  readonly lastSuccessfulHolidaySyncAt?: string;
}): Promise<void> => {
  const saveExternalInterfaceRecord = requireDeps(deps.saveExternalInterfaceRecord, 'saveExternalInterfaceRecord');
  const recordsToPersist = interfaceRecords.filter(
    (record) => record.id === targetInterfaceRecord.id || isWasteManagementInterfaceSelected(record)
  );

  for (const record of recordsToPersist) {
    const isTarget = record.id === targetInterfaceRecord.id;
    await saveExternalInterfaceRecord(
      createInterfaceSettingsRecord(record, {
        selected: isTarget,
        calendarWebUrl: isTarget ? calendarWebUrl : readWasteManagementCalendarWebUrl(record.publicConfig),
        pdfBrandingAssetUrl: isTarget
          ? pdfBrandingAssetUrl
          : readWasteManagementPdfBrandingAssetUrl(record.publicConfig),
        pdfContactBlock: isTarget ? pdfContactBlock : readWasteManagementPdfContactBlock(record.publicConfig),
        holidayStateCode: isTarget ? holidayStateCode : readWasteManagementHolidayStateCode(record.publicConfig),
        lastHolidaySyncStatus: isTarget ? lastHolidaySyncStatus : readWasteManagementHolidaySyncStatus(record.publicConfig),
        lastSuccessfulHolidaySyncAt: isTarget
          ? lastSuccessfulHolidaySyncAt
          : readWasteManagementLastSuccessfulHolidaySyncAt(record.publicConfig),
      })
    );
  }
};
