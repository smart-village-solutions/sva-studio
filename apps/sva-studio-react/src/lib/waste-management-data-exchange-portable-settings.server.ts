import {
  buildWasteManagementPublicConfig,
  isWasteManagementInterfaceSelected,
  readWasteManagementCalendarWebUrl,
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  readWasteManagementPdfBrandingAssetUrl,
  readWasteManagementPdfContactBlock,
  wasteManagementMasterDataContract,
  type WasteManagementDataExchangeRecord,
  type WasteHolidayStateCode,
} from '@sva/core';
import { saveExternalInterfaceRecord } from '@sva/data-repositories/server';

import { loadSelectedWasteInterfaceRecord } from './waste-management-operations.shared.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const readPortableHolidayStateCode = (
  portableRecord: WasteManagementDataExchangeRecord,
  fallback: WasteHolidayStateCode | undefined
): WasteHolidayStateCode | undefined => {
  if (!hasOwnProperty(portableRecord, 'holidayStateCode')) return fallback;
  if (portableRecord.holidayStateCode === null) return undefined;
  if (
    typeof portableRecord.holidayStateCode !== 'string' ||
    !wasteManagementMasterDataContract.isWasteHolidayStateCode(portableRecord.holidayStateCode)
  ) {
    throw new Error('invalid_portable_holiday_state_code');
  }
  return portableRecord.holidayStateCode;
};

export const persistPortableWasteSettings = async (
  deps: WasteOperationRuntimeDeps,
  portableInterface: NonNullable<Awaited<ReturnType<typeof loadSelectedWasteInterfaceRecord>>>,
  portableRecord: WasteManagementDataExchangeRecord
): Promise<void> => {
  const calendarWebUrl = hasOwnProperty(portableRecord, 'calendarWebUrl')
    ? typeof portableRecord.calendarWebUrl === 'string' ? portableRecord.calendarWebUrl : undefined
    : readWasteManagementCalendarWebUrl(portableInterface.publicConfig);
  const holidayStateCode = readPortableHolidayStateCode(
    portableRecord,
    readWasteManagementHolidayStateCode(portableInterface.publicConfig)
  );
  await (deps.saveInterfaceRecord ?? saveExternalInterfaceRecord)({
    ...portableInterface,
    publicConfig: buildWasteManagementPublicConfig(portableInterface.publicConfig, {
      selected: isWasteManagementInterfaceSelected(portableInterface),
      calendarWebUrl,
      pdfBrandingAssetUrl: readWasteManagementPdfBrandingAssetUrl(portableInterface.publicConfig),
      pdfContactBlock: readWasteManagementPdfContactBlock(portableInterface.publicConfig),
      emailReminderConfig: readWasteManagementEmailReminderConfig(portableInterface.publicConfig),
      emailReminderSigningSecret: readWasteManagementEmailReminderSigningSecret(portableInterface.publicConfig),
      holidayStateCode,
      lastHolidaySyncStatus: readWasteManagementHolidaySyncStatus(portableInterface.publicConfig),
      lastSuccessfulHolidaySyncAt: readWasteManagementLastSuccessfulHolidaySyncAt(portableInterface.publicConfig),
    }),
  });
};

export const restorePortableWasteSettings = async (
  deps: WasteOperationRuntimeDeps,
  portableInterface: NonNullable<Awaited<ReturnType<typeof loadSelectedWasteInterfaceRecord>>>
): Promise<void> => {
  await (deps.saveInterfaceRecord ?? saveExternalInterfaceRecord)(portableInterface);
};
