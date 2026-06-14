import type { WasteHolidayStateCode } from './waste-management/master-data-contract.js';
import type { WasteCustomRecurrencePresetRecord } from './waste-management/master-data-tours.js';
import type { WasteManagementEmailReminderConfig } from './waste-management-settings-public-config.js';

const wasteManagementDataSourceProviders = ['supabase'] as const;
const wasteManagementDataSourceStatuses = ['not_configured', 'unknown', 'ok', 'error'] as const;
const wasteManagementConnectionCheckStatuses = ['succeeded', 'failed'] as const;
const wasteHolidaySyncStatuses = ['success', 'partial_success', 'failed'] as const;
const wasteManagementTechnicalEventTypes = [
  'datasource.reconfigured',
  'connection-check.succeeded',
  'connection-check.failed',
  'migration.started',
  'migration.succeeded',
  'migration.failed',
  'import.started',
  'import.succeeded',
  'import.failed',
  'seed.started',
  'seed.succeeded',
  'seed.failed',
  'reset.started',
  'reset.succeeded',
  'reset.failed',
  'sync.started',
  'sync.succeeded',
  'sync.failed',
] as const;

export type WasteManagementDataSourceProvider = (typeof wasteManagementDataSourceProviders)[number];
export type WasteManagementDataSourceStatus = (typeof wasteManagementDataSourceStatuses)[number];
export type WasteManagementConnectionCheckStatus = (typeof wasteManagementConnectionCheckStatuses)[number];
export type WasteHolidaySyncStatus = (typeof wasteHolidaySyncStatuses)[number];
export type WasteManagementTechnicalEventType = (typeof wasteManagementTechnicalEventTypes)[number];

export type WasteManagementSettingsInterfaceOption = Readonly<{
  id: string;
  name: string;
  typeKey: string;
  enabled: boolean;
  visibleStatus: 'not_configured' | 'unknown' | 'ok' | 'error' | 'disabled';
  isSelected: boolean;
}>;

export const wasteManagementDataSourceContract = {
  providers: wasteManagementDataSourceProviders,
  statuses: wasteManagementDataSourceStatuses,
  checkStatuses: wasteManagementConnectionCheckStatuses,
  holidaySyncStatuses: wasteHolidaySyncStatuses,
  technicalEventTypes: wasteManagementTechnicalEventTypes,
  isProvider: (value: string): value is WasteManagementDataSourceProvider =>
    (wasteManagementDataSourceProviders as readonly string[]).includes(value),
  isStatus: (value: string): value is WasteManagementDataSourceStatus =>
    (wasteManagementDataSourceStatuses as readonly string[]).includes(value),
  isCheckStatus: (value: string): value is WasteManagementConnectionCheckStatus =>
    (wasteManagementConnectionCheckStatuses as readonly string[]).includes(value),
  isHolidaySyncStatus: (value: string): value is WasteHolidaySyncStatus =>
    (wasteHolidaySyncStatuses as readonly string[]).includes(value),
  isTechnicalEventType: (value: string): value is WasteManagementTechnicalEventType =>
    (wasteManagementTechnicalEventTypes as readonly string[]).includes(value),
} as const;

export type WasteManagementSettingsRecord = {
  readonly instanceId: string;
  readonly provider: WasteManagementDataSourceProvider;
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly selectedInterfaceId?: string;
  readonly selectedInterfaceName?: string;
  readonly selectedInterfaceTypeKey?: string;
  readonly availableInterfaces?: readonly WasteManagementSettingsInterfaceOption[];
  readonly calendarWebUrl?: string;
  readonly pdfBrandingAssetUrl?: string;
  readonly pdfContactBlock?: string;
  readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
  readonly databaseUrlConfigured: boolean;
  readonly serviceRoleKeyConfigured: boolean;
  readonly visibleStatus: WasteManagementDataSourceStatus;
  readonly lastCheckedAt?: string;
  readonly lastCheckStatus?: WasteManagementConnectionCheckStatus;
  readonly lastCheckErrorCode?: string;
  readonly lastCheckErrorMessage?: string;
  readonly holidayStateCode?: WasteHolidayStateCode;
  readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
  readonly lastSuccessfulHolidaySyncAt?: string;
  readonly updatedAt?: string;
  readonly customRecurrencePresets?: readonly WasteCustomRecurrencePresetRecord[];
};

export type WasteManagementDataSourceRecord = WasteManagementSettingsRecord & {
  readonly databaseUrlCiphertext?: string;
  readonly serviceRoleKeyCiphertext?: string;
};

export type WasteManagementConnectionCheckRecord = {
  readonly instanceId: string;
  readonly checkedAt: string;
  readonly checkStatus: WasteManagementConnectionCheckStatus;
  readonly visibleStatus: WasteManagementDataSourceStatus;
  readonly errorCode?: string;
  readonly errorMessage?: string;
};
