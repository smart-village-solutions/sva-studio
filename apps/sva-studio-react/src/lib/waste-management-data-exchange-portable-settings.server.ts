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
  type WasteManagementDataExchangeRecord,
} from '@sva/core';
import { saveExternalInterfaceRecord } from '@sva/data-repositories/server';

import { loadSelectedWasteInterfaceRecord } from './waste-management-operations.shared.js';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const persistPortableWasteSettings = async (
  deps: WasteOperationRuntimeDeps,
  portableInterface: NonNullable<Awaited<ReturnType<typeof loadSelectedWasteInterfaceRecord>>>,
  portableRecord: WasteManagementDataExchangeRecord
): Promise<void> => {
  const calendarWebUrl = hasOwnProperty(portableRecord, 'calendarWebUrl')
    ? typeof portableRecord.calendarWebUrl === 'string' ? portableRecord.calendarWebUrl : undefined
    : readWasteManagementCalendarWebUrl(portableInterface.publicConfig);
  const holidayStateCode = hasOwnProperty(portableRecord, 'holidayStateCode')
    ? typeof portableRecord.holidayStateCode === 'string' ? portableRecord.holidayStateCode as never : undefined
    : readWasteManagementHolidayStateCode(portableInterface.publicConfig);
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
