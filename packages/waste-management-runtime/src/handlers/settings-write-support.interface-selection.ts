import { randomBytes } from 'node:crypto';
import { type ExternalInterfaceRecord } from '@sva/core';
import {
  buildWasteManagementPublicConfig,
  isWasteManagementInterfaceSelected,
  readWasteManagementCalendarWebUrl,
  readWasteManagementEmailReminderConfig,
  readWasteManagementEmailReminderSigningSecret,
  readWasteManagementHolidayStateCode,
  readWasteManagementHolidaySyncStatus,
  readWasteManagementLastSuccessfulHolidaySyncAt,
  type WasteHolidayStateCode,
  type WasteHolidaySyncStatus,
  type WasteManagementEmailReminderConfig,
  type WasteManagementSettingsRecord,
} from '@sva/waste-management-contracts';

import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

export const resolveTargetInterfaceRecord = (
  interfaceRecords: readonly ExternalInterfaceRecord[],
  current: WasteManagementSettingsRecord,
  selectedInterfaceId?: string
): ExternalInterfaceRecord | null => {
  const explicitMatch = selectedInterfaceId
    ? (interfaceRecords.find((record) => record.id === selectedInterfaceId) ?? null)
    : null;
  if (explicitMatch) {
    return explicitMatch;
  }

  if (current.selectedInterfaceId) {
    const currentMatch = interfaceRecords.find(
      (record) => record.id === current.selectedInterfaceId
    );
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
    readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
    readonly emailReminderSigningSecret?: string;
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
    readonly lastSuccessfulHolidaySyncAt?: string;
  }
): ExternalInterfaceRecord => ({
  ...interfaceRecord,
  publicConfig: buildWasteManagementPublicConfig(interfaceRecord.publicConfig, input),
});

const createEmailReminderSigningSecret = (): string => randomBytes(32).toString('base64url');

export const persistWasteSettingsInterfaceSelection = async ({
  deps,
  interfaceRecords,
  targetInterfaceRecord,
  calendarWebUrl,
  emailReminderConfig,
  emailReminderSigningSecret,
  holidayStateCode,
  lastHolidaySyncStatus,
  lastSuccessfulHolidaySyncAt,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly interfaceRecords: readonly ExternalInterfaceRecord[];
  readonly targetInterfaceRecord: ExternalInterfaceRecord;
  readonly calendarWebUrl?: string;
  readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
  readonly emailReminderSigningSecret?: string;
  readonly holidayStateCode?: WasteHolidayStateCode;
  readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
  readonly lastSuccessfulHolidaySyncAt?: string;
}): Promise<ExternalInterfaceRecord> => {
  const saveExternalInterfaceRecord = requireDeps(
    deps.saveExternalInterfaceRecord,
    'saveExternalInterfaceRecord'
  );
  const recordsToPersist = interfaceRecords.filter(
    (record) => record.id === targetInterfaceRecord.id || isWasteManagementInterfaceSelected(record)
  );
  let savedTarget: ExternalInterfaceRecord | null = null;

  for (const record of recordsToPersist) {
    const isTarget = record.id === targetInterfaceRecord.id;
    const nextRecord = createInterfaceSettingsRecord(record, {
      selected: isTarget,
      calendarWebUrl: isTarget
        ? calendarWebUrl
        : readWasteManagementCalendarWebUrl(record.publicConfig),
      emailReminderConfig: isTarget
        ? emailReminderConfig
        : readWasteManagementEmailReminderConfig(record.publicConfig),
      emailReminderSigningSecret: isTarget
        ? (emailReminderConfig ?? readWasteManagementEmailReminderConfig(record.publicConfig))
          ? (emailReminderSigningSecret ??
            readWasteManagementEmailReminderSigningSecret(record.publicConfig) ??
            createEmailReminderSigningSecret())
          : readWasteManagementEmailReminderSigningSecret(record.publicConfig)
        : readWasteManagementEmailReminderSigningSecret(record.publicConfig),
      holidayStateCode: isTarget
        ? holidayStateCode
        : readWasteManagementHolidayStateCode(record.publicConfig),
      lastHolidaySyncStatus: isTarget
        ? lastHolidaySyncStatus
        : readWasteManagementHolidaySyncStatus(record.publicConfig),
      lastSuccessfulHolidaySyncAt: isTarget
        ? lastSuccessfulHolidaySyncAt
        : readWasteManagementLastSuccessfulHolidaySyncAt(record.publicConfig),
    });
    await saveExternalInterfaceRecord(nextRecord);
    if (isTarget) savedTarget = nextRecord;
  }
  if (!savedTarget) throw new Error('waste_selected_interface_not_persisted');
  return savedTarget;
};
